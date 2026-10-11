import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccountRole } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { EmailDeliveryService } from './email-delivery.service';

describe('authentication lifecycle controls', () => {
  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const account = { id: 'account-1', email: 'student@example.test', role: AccountRole.STUDENT, emailVerifiedAt: null };

  function setup(record: Record<string, unknown> | null) {
    const transaction = {
      emailVerificationToken: { update: jest.fn() },
      account: { update: jest.fn(async () => ({ ...account, emailVerifiedAt: new Date() })) },
    };
    const database = {
      emailVerificationToken: { findUnique: jest.fn(async () => record) },
      account: { update: jest.fn(), findUnique: jest.fn(async () => account), delete: jest.fn() },
      passwordResetToken: { create: jest.fn(), delete: jest.fn() },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    };
    return { database, transaction, service: new AuthService(database as never, new EmailDeliveryService()) };
  }

  it('accepts a valid verification token and consumes it once', async () => {
    const record = { id: 'token-1', accountId: account.id, tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null, account };
    const { database, transaction, service } = setup(record);
    await expect(service.verifyEmail({ token }, { ip: '127.0.0.1' })).resolves.toMatchObject({ email: account.email, emailVerified: true });
    expect(transaction.emailVerificationToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: record.id }, data: { usedAt: expect.any(Date) } }));
    expect(database.auditEvent.create).toHaveBeenCalled();
    database.emailVerificationToken.findUnique.mockResolvedValueOnce({ ...record, usedAt: new Date() });
    await expect(service.verifyEmail({ token }, { ip: '127.0.0.1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expired verification token', async () => {
    const { service } = setup({ id: 'token-1', accountId: account.id, tokenHash, expiresAt: new Date(Date.now() - 1), usedAt: null, account });
    await expect(service.verifyEmail({ token }, { ip: '127.0.0.1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes a reset token when delivery fails', async () => {
    const { database, service } = setup(null);
    database.passwordResetToken.create.mockResolvedValue({});
    const delivery = { sendPasswordReset: jest.fn().mockRejectedValue(new ServiceUnavailableException('provider down')) } as unknown as EmailDeliveryService;
    const failingService = new AuthService(database as never, delivery);
    await expect(failingService.requestPasswordReset({ email: account.email }, { ip: '127.0.0.1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(database.passwordResetToken.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: expect.any(String) } }));
    void service;
  });
});
