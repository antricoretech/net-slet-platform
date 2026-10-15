export type ApplicationEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface RuntimeConfig {
  applicationEnvironment: ApplicationEnvironment;
  databaseUrl: string;
  redisUrl: string;
  allowedOrigins: string[];
  nextPublicApiBaseUrl?: string;
  sessionSecret?: string;
  secureCookies: boolean;
  trustedProxy: boolean | number;
  emailVerificationProvider?: string;
  objectStorageEnabled: boolean;
}

export class RuntimeConfigurationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid runtime configuration: ${issues.join('; ')}`);
    this.name = 'RuntimeConfigurationError';
  }
}

type Environment = Record<string, string | undefined>;

const RELEASE_ENVIRONMENTS = new Set<ApplicationEnvironment>(['staging', 'production']);

function required(environment: Environment, name: string, issues: string[]): string {
  const value = environment[name]?.trim();
  if (!value) issues.push(`${name} is required`);
  return value ?? '';
}

function booleanValue(environment: Environment, name: string, fallback: boolean, issues: string[]): boolean {
  const raw = environment[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  issues.push(`${name} must be true or false`);
  return fallback;
}

function originList(environment: Environment, issues: string[]): string[] {
  const raw = environment.WEB_ORIGINS ?? environment.WEB_ORIGIN ?? '';
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) issues.push('WEB_ORIGIN or WEB_ORIGINS is required');
  for (const value of values) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.pathname !== '/' || url.search || url.hash) {
        issues.push(`WEB_ORIGIN contains an invalid origin: ${value}`);
      }
      if (value === '*') issues.push('WEB_ORIGIN must not use a wildcard');
    } catch {
      issues.push(`WEB_ORIGIN contains an invalid origin: ${value}`);
    }
  }
  return values;
}

function assertUrl(name: string, value: string, protocols: string[], issues: string[]): URL | undefined {
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) issues.push(`${name} must use ${protocols.join(' or ')}`);
    if (!parsed.hostname) issues.push(`${name} must include a hostname`);
    return parsed;
  } catch {
    issues.push(`${name} must be a valid URL`);
    return undefined;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === 'host.docker.internal';
}

function trustedProxyValue(environment: Environment, release: boolean, issues: string[]): boolean | number {
  const raw = environment.TRUSTED_PROXY?.trim();
  if (!raw) {
    if (release) issues.push('TRUSTED_PROXY must be explicitly set in staging and production');
    return false;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  issues.push('TRUSTED_PROXY must be true, false, or a non-negative hop count');
  return false;
}

export function loadRuntimeConfig(environment: Environment = process.env): RuntimeConfig {
  const issues: string[] = [];
  const rawEnvironment = (environment.APP_ENV ?? environment.NODE_ENV ?? 'development').trim().toLowerCase();
  const applicationEnvironment = rawEnvironment as ApplicationEnvironment;
  if (!['development', 'test', 'staging', 'production'].includes(applicationEnvironment)) {
    issues.push('APP_ENV/NODE_ENV must be development, test, staging, or production');
  }
  const release = RELEASE_ENVIRONMENTS.has(applicationEnvironment);
  const databaseUrl = required(environment, 'DATABASE_URL', issues);
  const redisUrl = required(environment, 'REDIS_URL', issues);
  const allowedOrigins = originList(environment, issues);
  const nextPublicApiBaseUrl = environment.NEXT_PUBLIC_API_BASE_URL?.trim();
  const sessionSecret = environment.SESSION_SECRET?.trim();
  const secureCookies = booleanValue(environment, 'SECURE_COOKIES', applicationEnvironment === 'production', issues);
  const trustedProxy = trustedProxyValue(environment, release, issues);
  const objectStorageEnabled = booleanValue(environment, 'OBJECT_STORAGE_ENABLED', false, issues);

  if (environment.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    issues.push('NODE_TLS_REJECT_UNAUTHORIZED=0 is forbidden');
  }

  const database = databaseUrl ? assertUrl('DATABASE_URL', databaseUrl, ['postgres:', 'postgresql:'], issues) : undefined;
  const redis = redisUrl ? assertUrl('REDIS_URL', redisUrl, ['redis:', 'rediss:'], issues) : undefined;
  if (release && database && isLocalHost(database.hostname)) issues.push('DATABASE_URL must not target a local host in staging or production');
  if (release && redis && isLocalHost(redis.hostname)) issues.push('REDIS_URL must not target a local host in staging or production');
  if (applicationEnvironment === 'production' && redis?.protocol !== 'rediss:') issues.push('REDIS_URL must use TLS (rediss:) in production');

  if (release) {
    if (!nextPublicApiBaseUrl) issues.push('NEXT_PUBLIC_API_BASE_URL is required in staging and production');
    else {
      const apiUrl = assertUrl('NEXT_PUBLIC_API_BASE_URL', nextPublicApiBaseUrl, ['https:'], issues);
      if (apiUrl?.pathname.endsWith('/')) issues.push('NEXT_PUBLIC_API_BASE_URL must not end with a slash');
    }
    if (!sessionSecret || sessionSecret.length < 32 || /change[_-]?me|example|development|test-secret/i.test(sessionSecret)) {
      issues.push('SESSION_SECRET must be a non-placeholder value of at least 32 characters');
    }
    if (!secureCookies) issues.push('SECURE_COOKIES must be true in staging and production');
    if (allowedOrigins.some((origin) => !origin.startsWith('https://'))) issues.push('WEB_ORIGIN(S) must use HTTPS in staging and production');

    const provider = environment.EMAIL_VERIFICATION_PROVIDER?.trim().toLowerCase();
    if (!provider || provider === 'console') issues.push('EMAIL_VERIFICATION_PROVIDER must be a non-console provider in staging and production');
    if (provider && provider !== 'console') {
      required(environment, 'EMAIL_PROVIDER_URL', issues);
      required(environment, 'EMAIL_PROVIDER_API_KEY', issues);
      required(environment, 'EMAIL_FROM', issues);
    }
  }

  if (objectStorageEnabled) {
    for (const name of ['OBJECT_STORAGE_ENDPOINT', 'OBJECT_STORAGE_BUCKET', 'OBJECT_STORAGE_ACCESS_KEY', 'OBJECT_STORAGE_SECRET_KEY']) required(environment, name, issues);
  }

  if (issues.length > 0) throw new RuntimeConfigurationError(issues);
  return {
    applicationEnvironment,
    databaseUrl,
    redisUrl,
    allowedOrigins,
    nextPublicApiBaseUrl,
    sessionSecret,
    secureCookies,
    trustedProxy,
    emailVerificationProvider: environment.EMAIL_VERIFICATION_PROVIDER?.trim(),
    objectStorageEnabled,
  };
}
