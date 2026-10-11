import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('reports liveness without requiring database readiness', () => {
    const service = { liveness: () => ({ status: 'ok' }) } as unknown as HealthService;
    expect(new HealthController(service).live()).toEqual({ status: 'ok' });
  });
  it('returns ready when both dependencies are healthy', async () => {
    const service = { readiness: async () => ({ status: 'ready', dependencies: { postgres: 'up', redis: 'up' } }) } as unknown as HealthService;
    await expect(new HealthController(service).ready()).resolves.toMatchObject({ status: 'ready' });
  });
  it('responds with 503 when a dependency is down', async () => {
    const service = { readiness: async () => ({ status: 'not_ready', dependencies: { postgres: 'down', redis: 'up' } }) } as unknown as HealthService;
    await expect(new HealthController(service).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
