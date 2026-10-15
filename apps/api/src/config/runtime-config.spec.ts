import { RuntimeConfigurationError, loadRuntimeConfig } from './runtime-config';

function validProduction(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    APP_ENV: 'production',
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:password@db.internal:5432/netslet',
    REDIS_URL: 'rediss://:password@redis.internal:6380',
    WEB_ORIGINS: 'https://app.example.test',
    NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test/api/v1',
    SESSION_SECRET: 'a'.repeat(48),
    SECURE_COOKIES: 'true',
    TRUSTED_PROXY: '1',
    EMAIL_VERIFICATION_PROVIDER: 'webhook',
    EMAIL_PROVIDER_URL: 'https://mail.example.test/send',
    EMAIL_PROVIDER_API_KEY: 'provider-key',
    EMAIL_FROM: 'no-reply@example.test',
    ...overrides,
  };
}

describe('runtime configuration', () => {
  it('accepts a complete production contract without exposing secrets', () => {
    const config = loadRuntimeConfig(validProduction());
    expect(config).toMatchObject({ applicationEnvironment: 'production', secureCookies: true, trustedProxy: 1 });
    expect(config).not.toHaveProperty('emailProviderApiKey');
  });

  it('rejects insecure production defaults and TLS bypasses', () => {
    expect(() => loadRuntimeConfig(validProduction({ DATABASE_URL: 'postgresql://app:password@localhost:5432/netslet', NODE_TLS_REJECT_UNAUTHORIZED: '0' }))).toThrow(RuntimeConfigurationError);
    try {
      loadRuntimeConfig(validProduction({ DATABASE_URL: 'postgresql://app:password@localhost:5432/netslet', NODE_TLS_REJECT_UNAUTHORIZED: '0' }));
    } catch (error) {
      expect((error as RuntimeConfigurationError).issues).toEqual(expect.arrayContaining([
        'DATABASE_URL must not target a local host in staging or production',
        'NODE_TLS_REJECT_UNAUTHORIZED=0 is forbidden',
      ]));
    }
  });

  it('requires explicit release cookie, proxy, origin, secret, email and API settings', () => {
    expect(() => loadRuntimeConfig({ APP_ENV: 'production', DATABASE_URL: 'postgresql://app:password@db/netslet', REDIS_URL: 'rediss://redis:6380' })).toThrow(RuntimeConfigurationError);
  });

  it('supports local development without imposing production endpoints', () => {
    const config = loadRuntimeConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://netslet:local@127.0.0.1:5432/netslet_dev', REDIS_URL: 'redis://127.0.0.1:6379', WEB_ORIGIN: 'http://localhost:3000' });
    expect(config.applicationEnvironment).toBe('development');
    expect(config.secureCookies).toBe(false);
  });
});
