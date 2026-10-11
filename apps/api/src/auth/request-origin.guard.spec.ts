import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestOriginGuard } from './request-origin.guard';

function context(method: string, origin?: string): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ method, headers: origin ? { origin } : {} }) }) } as unknown as ExecutionContext;
}

describe('RequestOriginGuard', () => {
  const originalOrigins = process.env.WEB_ORIGINS;

  afterEach(() => { process.env.WEB_ORIGINS = originalOrigins; });

  it('allows configured browser origins for state-changing requests', () => {
    process.env.WEB_ORIGINS = 'http://localhost:3000';
    expect(new RequestOriginGuard().canActivate(context('POST', 'http://localhost:3000'))).toBe(true);
  });

  it('rejects unapproved browser origins', () => {
    process.env.WEB_ORIGINS = 'http://localhost:3000';
    expect(() => new RequestOriginGuard().canActivate(context('POST', 'https://evil.example'))).toThrow(ForbiddenException);
  });

  it('allows safe reads and non-browser requests', () => {
    process.env.WEB_ORIGINS = 'http://localhost:3000';
    expect(new RequestOriginGuard().canActivate(context('GET', 'https://evil.example'))).toBe(true);
    expect(new RequestOriginGuard().canActivate(context('POST'))).toBe(true);
  });
});
