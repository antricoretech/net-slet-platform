import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('attaches the authenticated user to the request', async () => {
    const request: { user?: { id: string } } = {};
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
    const guard = new AuthGuard({ authenticate: jest.fn(async () => ({ id: 'a', email: 'student@example.com', role: 'STUDENT', emailVerified: true })) } as unknown as import('./auth.service').AuthService);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeDefined();
    expect(request.user?.id).toBe('a');
  });

  it('rejects requests without an active session', async () => {
    const context = { switchToHttp: () => ({ getRequest: () => ({}) }) } as unknown as ExecutionContext;
    const guard = new AuthGuard({ authenticate: jest.fn(async () => undefined) } as unknown as import('./auth.service').AuthService);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
