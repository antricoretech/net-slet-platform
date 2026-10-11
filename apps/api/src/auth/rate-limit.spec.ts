import { ServiceUnavailableException, HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('distributed authentication rate limiting', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('fails closed when Redis is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://unavailable.test';
    const service = new AuthService({} as never) as unknown as { checkRate: (action: string, key: string) => Promise<void>; redis: { incr: jest.Mock; expire: jest.Mock } };
    service.redis = { incr: jest.fn().mockRejectedValue(new Error('connection refused')), expire: jest.fn() };
    await expect(service.checkRate('login', '127.0.0.1:test@example.test')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects the eleventh attempt in a distributed window', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://available.test';
    const service = new AuthService({} as never) as unknown as { checkRate: (action: string, key: string) => Promise<void>; redis: { incr: jest.Mock; expire: jest.Mock } };
    service.redis = { incr: jest.fn().mockResolvedValue(11), expire: jest.fn() };
    await expect(service.checkRate('login', '127.0.0.1:test@example.test')).rejects.toBeInstanceOf(HttpException);
  });
});
