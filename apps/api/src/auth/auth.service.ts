import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { promisify } from 'node:util';
import { AccountRole, AuditEventType } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser, RequestLike, requestCookie, requestUserAgent } from './auth.types';
import { EmailDeliveryService } from './email-delivery.service';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'netslet_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;

interface CredentialInput {
  email: string;
  password: string;
}

interface SessionResult {
  user: AuthenticatedUser;
  token?: string;
  requiresEmailVerification?: boolean;
}

interface RateEntry { count: number; resetAt: number; }

@Injectable()
export class AuthService {
  private readonly rateEntries = new Map<string, RateEntry>();
  private redis: Redis | undefined;

  constructor(private readonly database: PrismaService, private readonly emailDelivery: EmailDeliveryService = new EmailDeliveryService()) {}

  async register(input: unknown, request: RequestLike): Promise<SessionResult> {
    const credentials = this.parseCredentials(input);
    await this.checkRate('register', request.ip ?? 'unknown');
    const production = process.env.NODE_ENV === 'production';
    if (production && !process.env.EMAIL_VERIFICATION_PROVIDER) throw new ServiceUnavailableException('Email verification is not configured');
    const existing = await this.database.account.findUnique({ where: { email: credentials.email } });
    if (existing) throw new ConflictException('An account with that email already exists');

    const now = new Date();
    const account = await this.database.account.create({
      data: {
        email: credentials.email,
        passwordHash: await this.hashPassword(credentials.password),
        role: AccountRole.STUDENT,
        // External email delivery is intentionally not configured for Sprint 1A.
        emailVerifiedAt: production ? null : now,
      },
    });
    if (production) {
      try {
        await this.issueEmailVerification(account.id, account.email);
      } catch (error) {
        await this.database.account.delete({ where: { id: account.id } });
        throw error;
      }
      await this.database.auditEvent.create({ data: { type: AuditEventType.ACCOUNT_REGISTERED, accountId: account.id, ipAddress: request.ip } });
      return { user: this.toUser(account), requiresEmailVerification: true };
    }
    const result = await this.createSession(account, request);
    await this.database.auditEvent.create({ data: { type: AuditEventType.ACCOUNT_REGISTERED, accountId: account.id, ipAddress: request.ip } });
    return result;
  }

  async verifyEmail(input: unknown, request: RequestLike): Promise<AuthenticatedUser> {
    const token = this.parseToken(input);
    const record = await this.database.emailVerificationToken.findUnique({ where: { tokenHash: this.hashToken(token) }, include: { account: true } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw new BadRequestException('Invalid or expired verification token');
    const account = await this.database.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      return transaction.account.update({ where: { id: record.accountId }, data: { emailVerifiedAt: new Date() } });
    });
    await this.database.auditEvent.create({ data: { type: AuditEventType.ACCOUNT_EMAIL_VERIFIED, accountId: account.id, ipAddress: request.ip } });
    return this.toUser(account);
  }

  async requestPasswordReset(input: unknown, request: RequestLike): Promise<void> {
    const email = this.parseEmail(input);
    await this.checkRate('password-reset', `${request.ip ?? 'unknown'}:${email}`);
    const account = await this.database.account.findUnique({ where: { email } });
    if (!account) return;
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    await this.database.passwordResetToken.create({ data: { accountId: account.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    try {
      await this.emailDelivery.sendPasswordReset(account.email, token);
    } catch (error) {
      await this.database.passwordResetToken.delete({ where: { tokenHash } });
      throw error;
    }
    await this.database.auditEvent.create({ data: { type: AuditEventType.PASSWORD_RESET_REQUESTED, accountId: account.id, ipAddress: request.ip } });
  }

  async completePasswordReset(input: unknown, request: RequestLike): Promise<void> {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid password reset request');
    const value = input as Record<string, unknown>;
    const token = this.parseToken({ token: value.token });
    const password = typeof value.password === 'string' ? value.password : '';
    if (password.length < PASSWORD_MIN_LENGTH || password.length > 128) throw new BadRequestException('Invalid password');
    const record = await this.database.passwordResetToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw new BadRequestException('Invalid or expired password reset token');
    await this.database.$transaction(async (transaction) => {
      await transaction.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await transaction.account.update({ where: { id: record.accountId }, data: { passwordHash: await this.hashPassword(password), emailVerifiedAt: new Date() } });
      await transaction.session.updateMany({ where: { accountId: record.accountId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.database.auditEvent.create({ data: { type: AuditEventType.PASSWORD_RESET_COMPLETED, accountId: record.accountId, ipAddress: request.ip } });
  }

  async login(input: unknown, request: RequestLike): Promise<SessionResult> {
    const credentials = this.parseCredentials(input);
    await this.checkRate('login', `${request.ip ?? 'unknown'}:${credentials.email}`);
    const account = await this.database.account.findUnique({ where: { email: credentials.email } });
    if (!account || !(await this.verifyPassword(credentials.password, account.passwordHash))) {
      await this.database.auditEvent.create({ data: { type: AuditEventType.LOGIN_FAILED, accountId: account?.id, ipAddress: request.ip } });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!account.emailVerifiedAt) throw new UnauthorizedException('Email verification is required');
    const result = await this.createSession(account, request);
    await this.database.auditEvent.create({ data: { type: AuditEventType.LOGIN_SUCCEEDED, accountId: account.id, ipAddress: request.ip } });
    return result;
  }

  async logout(request: RequestLike): Promise<void> {
    const token = requestCookie(request, SESSION_COOKIE);
    if (!token) return;
    const tokenHash = this.hashToken(token);
    const session = await this.database.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) return;
    await this.database.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await this.database.auditEvent.create({ data: { type: AuditEventType.SESSION_REVOKED, accountId: session.accountId, ipAddress: request.ip } });
  }

  async authenticate(request: RequestLike): Promise<AuthenticatedUser | undefined> {
    const token = requestCookie(request, SESSION_COOKIE);
    if (!token) return undefined;
    const session = await this.database.session.findUnique({ where: { tokenHash: this.hashToken(token) }, include: { account: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    await this.database.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return this.toUser(session.account);
  }

  toUser(account: { id: string; email: string; role: AccountRole; emailVerifiedAt: Date | null }): AuthenticatedUser {
    return { id: account.id, email: account.email, role: account.role, emailVerified: Boolean(account.emailVerifiedAt) };
  }

  sessionCookie(token: string): string {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_MS / 1000}; Path=/; HttpOnly; SameSite=Lax${secure}`;
  }

  clearSessionCookie(): string {
    return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
  }

  private async createSession(account: { id: string; email: string; role: AccountRole; emailVerifiedAt: Date | null }, request: RequestLike): Promise<SessionResult> {
    const token = randomBytes(32).toString('hex');
    await this.database.session.create({
      data: {
        accountId: account.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ipAddress: request.ip,
        userAgent: requestUserAgent(request),
      },
    });
    return { user: this.toUser(account), token };
  }

  private parseCredentials(input: unknown): CredentialInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid credentials');
    const value = input as Record<string, unknown>;
    const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
    const password = typeof value.password === 'string' ? value.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
      throw new BadRequestException('Invalid credentials');
    }
    return { email, password };
  }

  private parseEmail(input: unknown): string {
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>).email : undefined;
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new BadRequestException('Invalid email');
    return email;
  }

  private parseToken(input: unknown): string {
    const value = input && typeof input === 'object' ? (input as Record<string, unknown>).token : undefined;
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new BadRequestException('Invalid token');
    return value;
  }

  private async issueEmailVerification(accountId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('hex');
    await this.database.emailVerificationToken.create({ data: { accountId, tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    await this.emailDelivery.sendVerification(email, token);
  }

  private async checkRate(action: string, key: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.REDIS_URL) throw new ServiceUnavailableException('Authentication protection is unavailable');
      try {
        if (!this.redis) this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null, connectTimeout: 1500 });
        const redisKey = `netslet:auth-rate:${action}:${createHash('sha256').update(key).digest('hex')}`;
        const count = await this.redis.incr(redisKey);
        if (count === 1) await this.redis.expire(redisKey, 60);
        if (count > 10) throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
        return;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException('Authentication protection is unavailable');
      }
    }
    const now = Date.now();
    const current = this.rateEntries.get(`${action}:${key}`);
    if (!current || current.resetAt <= now) {
      this.rateEntries.set(`${action}:${key}`, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (current.count >= 10) throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    current.count += 1;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [, salt, expectedHex] = encoded.split('$');
    if (!salt || !expectedHex || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
    const actual = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

  async onModuleDestroy(): Promise<void> { this.redis?.disconnect(); }
}
