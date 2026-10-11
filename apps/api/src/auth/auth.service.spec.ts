import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const account: { id: string; email: string; passwordHash: string; role: AccountRole; emailVerifiedAt: Date | null } = {
    id: 'account-1',
    email: 'student@example.com',
    passwordHash: '',
    role: AccountRole.STUDENT,
    emailVerifiedAt: new Date(),
  };
  let storedAccount = { ...account };
  let storedSession: Record<string, unknown> | undefined;
  let database: {
    account: { findUnique: jest.Mock; create: jest.Mock };
    session: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    auditEvent: { create: jest.Mock };
  };
  let service: AuthService;

  beforeEach(() => {
    storedAccount = { ...account };
    storedSession = undefined;
    database = {
      account: {
        findUnique: jest.fn(async () => storedAccount),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          storedAccount = { ...account, email: data.email as string, passwordHash: data.passwordHash as string, role: data.role as AccountRole, emailVerifiedAt: data.emailVerifiedAt as Date | null };
          return storedAccount;
        }),
      },
      session: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { storedSession = { id: 'session-1', ...data, revokedAt: null }; return storedSession; }),
        findUnique: jest.fn(async () => storedSession ? { ...storedSession, account: storedAccount } : null),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { storedSession = { ...storedSession, ...data }; return storedSession; }),
      },
      auditEvent: { create: jest.fn(async () => undefined) },
    };
    service = new AuthService(database as unknown as PrismaService);
  });

  it('registers a student and creates a database-backed session', async () => {
    database.account.findUnique.mockResolvedValueOnce(null);
    const result = await service.register({ email: ' Student@Example.com ', password: 'CorrectHorseBattery1' }, { ip: '127.0.0.1' });
    expect(result.user).toMatchObject({ email: 'student@example.com', role: AccountRole.STUDENT, emailVerified: true });
    expect(database.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: AccountRole.STUDENT }) }));
    expect(database.session.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate registration without changing the account', async () => {
    await expect(service.register({ email: account.email, password: 'CorrectHorseBattery1' }, { ip: '127.0.0.1' })).rejects.toBeInstanceOf(ConflictException);
    expect(database.account.create).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials with a generic login error', async () => {
    database.account.findUnique.mockResolvedValueOnce(null);
    await expect(service.login({ email: account.email, password: 'CorrectHorseBattery1' }, { ip: '127.0.0.1' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(database.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'LOGIN_FAILED' }) }));
  });

  it('authenticates an active session and rejects a revoked session', async () => {
    database.account.findUnique.mockResolvedValueOnce(null);
    const result = await service.register({ email: account.email, password: 'CorrectHorseBattery1' }, { ip: '127.0.0.1' });
    const request = { headers: { cookie: `netslet_session=${result.token}` } };
    await expect(service.authenticate(request)).resolves.toMatchObject({ id: account.id, role: AccountRole.STUDENT });
    storedSession = { ...storedSession, revokedAt: new Date() };
    await expect(service.authenticate(request)).resolves.toBeUndefined();
  });
});
