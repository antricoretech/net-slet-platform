import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const api = process.env.HISTORICAL_PYQ_API_URL ?? 'http://127.0.0.1:4000/api/v1';
const connectionString = process.env.DATABASE_URL;
if (process.env.HISTORICAL_PYQ_HTTP_ACCEPTANCE !== '1' || !connectionString) throw new Error('Historical PYQ HTTP acceptance requires HISTORICAL_PYQ_HTTP_ACCEPTANCE=1 and DATABASE_URL');
const databaseUrl = new URL(connectionString);
if (databaseUrl.hostname !== 'localhost' && databaseUrl.hostname !== '127.0.0.1') throw new Error('Refusing HTTP acceptance outside a local disposable database');
if (databaseUrl.pathname !== '/netslet_stageb_ci') throw new Error('Refusing HTTP acceptance outside netslet_stageb_ci');

const client = new Client({ connectionString });
await client.connect();
const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
if (identity.rows[0]?.name !== 'netslet_stageb_ci' || identity.rows[0]?.port !== 5432) throw new Error('Database identity guard failed');

const ids = [randomUUID(), randomUUID(), randomUUID()];
const emails = ids.map((id) => `pyq-http-${id}@integration.test`);
const password = 'IntegrationOnlyPassword123!';
const cookies = new Map();

async function request(path, init = {}, cookie) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
async function expectStatus(path, expected, init, cookie) {
  const result = await request(path, init, cookie);
  if (result.response.status !== expected) throw new Error(`${init?.method ?? 'GET'} ${path}: expected ${expected}, got ${result.response.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}
async function register(index) {
  const result = await expectStatus('/auth/register', 201, { method: 'POST', body: JSON.stringify({ email: emails[index], password }) });
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: emails[index], password }) });
  if (!login.response.ok) throw new Error(`Login failed for ${emails[index]}`);
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error(`No session cookie for ${emails[index]}`);
  cookies.set(index, cookie);
  return result.account.id;
}
function checksum(records) {
  const canonical = records.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'sourceChecksum')));
  const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value && typeof value === 'object' ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}` : JSON.stringify(value ?? null);
  return createHash('sha256').update(stable(canonical)).digest('hex');
}

let accountIds;
try {
  accountIds = await Promise.all([0, 1, 2].map(register));
  await client.query('UPDATE "Account" SET role = $1 WHERE id = $2', ['ADMIN', accountIds[0]]);
  await client.query('UPDATE "Account" SET role = $1 WHERE id = $2', ['SME', accountIds[1]]);
  // Existing sessions resolve the current account role on every request; no session recreation is needed.
  const unauthenticated = await request('/admin/preparation/historical-pyq-governance/queue');
  if (unauthenticated.response.status !== 401) throw new Error(`Unauthenticated governance access returned ${unauthenticated.response.status}`);
  await expectStatus('/admin/preparation/historical-pyq-governance/queue', 200, undefined, cookies.get(0));
  await expectStatus('/admin/preparation/historical-pyq-governance/queue', 200, undefined, cookies.get(1));
  await expectStatus('/admin/preparation/historical-pyq-governance/queue', 403, undefined, cookies.get(2));

  const records = Array.from({ length: 21 }, (_, index) => ({ questionVersionId: randomUUID(), sourceChecksum: '', examCycleId: randomUUID(), examinationFamily: 'UGC_NET', authority: 'Synthetic acceptance fixture', sourceYear: 2025, historicalCycle: `HTTP-${index}`, session: 'JUNE', paper: 'PAPER_I', subjectCode: 'INTEGRATION', languageCode: 'en', sourceReference: `synthetic://${index}`, rightsStatus: 'UNKNOWN', rightsScope: { allowedUses: ['QUESTION_DISPLAY'], languages: ['en'] } }));
  const sourceChecksum = checksum(records);
  for (const record of records) record.sourceChecksum = sourceChecksum;
  const payload = { sourceName: 'synthetic-http-acceptance', sourceChecksum, format: 'JSON', records };
  const [first, second, third] = await Promise.all([0, 1, 2].map((index) => request('/admin/preparation/historical-pyq-imports/dry-run', { method: 'POST', body: JSON.stringify(payload) }, cookies.get(index))));
  if (![first, second, third].every((result) => result.response.status === 201 || result.response.status === 200)) throw new Error(`Concurrent dry-run failed: ${JSON.stringify([first.body, second.body, third.body])}`);
  const manifestIds = new Set([first.body.manifestId, second.body.manifestId, third.body.manifestId]);
  if (manifestIds.size !== 1 || first.body.rowCount !== 21 || first.body.rejectedCount !== 21) throw new Error('Concurrent import idempotency or dataset assertions failed');
  await expectStatus(`/admin/preparation/historical-pyq-imports/${first.body.manifestId}/commit`, 403, { method: 'POST' }, cookies.get(1));
  const committed = await expectStatus(`/admin/preparation/historical-pyq-imports/${first.body.manifestId}/commit`, 201, { method: 'POST' }, cookies.get(0));
  if (committed.idempotent || committed.status !== 'PARTIAL_REJECTED') throw new Error('Rejected-manifest commit did not produce the expected terminal result');

  const csv = 'questionVersionId,sourceChecksum,sourceReference\n"not-a-uuid","' + sourceChecksum + '","quoted, source"';
  const csvHash = checksum([{ questionVersionId: 'not-a-uuid', sourceChecksum, sourceReference: 'quoted, source' }]);
  await expectStatus('/admin/preparation/historical-pyq-imports/dry-run', 400, { method: 'POST', body: JSON.stringify({ sourceName: 'malformed-csv', sourceChecksum: csvHash, format: 'CSV', csv: `${csv},extra` }) }, cookies.get(0));
  console.log('Historical PYQ HTTP acceptance passed: authenticated governance access, role separation, 21-row concurrent dry-run idempotency, commit ownership, and CSV hardening.');
} finally {
  if (accountIds?.length) {
    await client.query('DELETE FROM "AuditEvent" WHERE "accountId" = ANY($1::uuid[])', [accountIds]);
    await client.query('DELETE FROM "Session" WHERE "accountId" = ANY($1::uuid[])', [accountIds]);
    await client.query('DELETE FROM "Account" WHERE id = ANY($1::uuid[])', [accountIds]);
  }
  await client.end();
}
