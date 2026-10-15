import { createHash } from 'node:crypto';
import process from 'node:process';
const targetUrl = process.env.MIGRATION_TARGET_URL;
const expectedDatabase = process.env.MIGRATION_TARGET_DATABASE;
const expectedPort = Number(process.env.MIGRATION_TARGET_PORT ?? '0');
const mode = process.argv.includes('--verify') ? 'verify' : 'plan';

function fail(message) {
  console.error(`MIGRATION TARGET REJECTED: ${message}`);
  process.exitCode = 2;
}

if (!targetUrl) fail('MIGRATION_TARGET_URL is required; DATABASE_URL is never accepted for reconciliation');
if (targetUrl && targetUrl === process.env.DATABASE_URL) fail('MIGRATION_TARGET_URL must not equal DATABASE_URL');
if (process.env.NODE_ENV === 'production' && process.env.MIGRATION_RECONCILIATION_AUTHORIZED !== '1') fail('production reconciliation requires an explicit approval flag');

let parsed;
try { parsed = new URL(targetUrl ?? ''); } catch { fail('MIGRATION_TARGET_URL must be a valid PostgreSQL URL'); }
if (parsed) {
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) fail('target must use PostgreSQL');
  const localHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  if (localHost && process.env.MIGRATION_TARGET_ISOLATED !== '1') fail('local host targets require MIGRATION_TARGET_ISOLATED=1');
  if (parsed.pathname.slice(1) === 'netslet_dev') fail('netslet_dev is a protected active database');
  if (parsed.port === '5432' || expectedPort === 5432) fail('port 5432 is reserved and forbidden');
  if (!expectedDatabase || parsed.pathname.slice(1) !== expectedDatabase) fail('target database identity does not match MIGRATION_TARGET_DATABASE');
  if (!Number.isInteger(expectedPort) || expectedPort < 1024 || Number(parsed.port || 5432) !== expectedPort) fail('target port does not match MIGRATION_TARGET_PORT');
}

if (process.exitCode) process.exit();
const targetFingerprint = createHash('sha256').update(`${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.slice(1)}`).digest('hex').slice(0, 16);
console.log(JSON.stringify({ mode, targetDatabase: expectedDatabase, targetPort: expectedPort, targetFingerprint, mutation: 'not-performed' }));

if (mode === 'verify') {
  const { default: pg } = await import('pg');
  const { Client } = pg;
  const client = new Client({ connectionString: targetUrl, ssl: parsed.protocol === 'postgresql:' && process.env.MIGRATION_TARGET_SSL === 'require' ? { rejectUnauthorized: true } : undefined });
  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS database, current_user AS user_name, inet_server_port() AS port, version() AS version');
    const identity = result.rows[0];
    if (identity.database !== expectedDatabase || Number(identity.port) !== expectedPort) fail('connected server identity does not match the approved target');
    console.log(JSON.stringify({ connected: true, database: identity.database, port: Number(identity.port), serverVersion: String(identity.version).split(' ').slice(0, 2).join(' ') }));
  } finally {
    await client.end().catch(() => undefined);
  }
}
