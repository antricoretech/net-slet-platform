import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('denies a student from an admin-only route and records the event', async () => {
    const request = { ip: '127.0.0.1', user: { id: 'student-1', email: 'student@example.com', role: AccountRole.STUDENT, emailVerified: true } };
    const context = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    const reflector = { getAllAndOverride: jest.fn(() => [AccountRole.ADMIN]) } as unknown as Reflector;
    const database = { auditEvent: { create: jest.fn(async () => undefined) } };
    const guard = new RolesGuard(reflector, database as unknown as PrismaService);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('allows a matching role', async () => {
    const request = { user: { id: 'admin-1', email: 'admin@example.com', role: AccountRole.ADMIN, emailVerified: true } };
    const context = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    const reflector = { getAllAndOverride: jest.fn(() => [AccountRole.ADMIN]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector, { auditEvent: { create: jest.fn() } } as unknown as PrismaService);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
