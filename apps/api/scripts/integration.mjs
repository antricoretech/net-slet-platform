import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for database integration checks');

const client = new Client({ connectionString });
await client.connect();
try {
  const expectedTables = ['EmailVerificationToken', 'PasswordResetToken', 'ExamSubject', 'SubjectPatternOverride', 'ExamSessionConfig', 'ExamSectionConfig', 'ScoringPolicy', 'LanguagePolicy', 'ExamRuleSource'];
  const tableResult = await client.query('SELECT "table_name" FROM information_schema.tables WHERE table_schema = current_schema() AND "table_name" = ANY($1)', [expectedTables]);
  const actualTables = new Set(tableResult.rows.map((row) => row.table_name));
  for (const table of expectedTables) if (!actualTables.has(table)) throw new Error(`Missing normalized table: ${table}`);

  const migration = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
  if (migration.rows[0].count < 11) throw new Error('Expected all additive migrations to be applied');

  const triggerResult = await client.query("SELECT COUNT(*)::int AS count FROM information_schema.triggers WHERE trigger_name IN ('exam_pattern_version_immutability', 'pattern_session_immutability', 'pattern_scoring_immutability')");
  if (triggerResult.rows[0].count < 3) throw new Error('Pattern immutability triggers are not installed');

  await client.query('BEGIN');
  const accountId = crypto.randomUUID();
  const organizerId = crypto.randomUUID();
  const examId = crypto.randomUUID();
  const cycleId = crypto.randomUUID();
  const patternId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  await client.query('INSERT INTO "Account" (id, email, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, \'STUDENT\', CURRENT_TIMESTAMP)', [accountId, `${accountId}@integration.test`, 'integration-only']);
  const sessionIdForAuth = crypto.randomUUID();
  await client.query('INSERT INTO "Session" (id, "accountId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL \'1 hour\')', [sessionIdForAuth, accountId, crypto.createHash('sha256').update(sessionIdForAuth).digest('hex')]);
  await client.query('UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP WHERE id = $1', [sessionIdForAuth]);
  const revoked = await client.query('SELECT "revokedAt" IS NOT NULL AS revoked FROM "Session" WHERE id = $1', [sessionIdForAuth]);
  if (!revoked.rows[0]?.revoked) throw new Error('Session revocation was not persisted');
  await client.query('INSERT INTO "ExamOrganizer" (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [organizerId, `TEST_${accountId.slice(0, 8)}`, 'Integration Test Organizer']);
  await client.query('INSERT INTO "Examination" (id, code, name, family, "organizerId", "updatedAt") VALUES ($1, $2, $3, \'UGC_NET\', $4, CURRENT_TIMESTAMP)', [examId, `TEST_${accountId.slice(0, 8)}`, 'Integration Test Examination', organizerId]);
  await client.query('INSERT INTO "ExamCycle" (id, "examinationId", code) VALUES ($1, $2, $3)', [cycleId, examId, 'INTEGRATION']);
  await client.query('INSERT INTO "ExamPatternVersion" (id, "examCycleId", "subjectCode", version, status, rules, "ruleHash") VALUES ($1, $2, $3, 1, \'DRAFT\', $4::jsonb, $5)', [patternId, cycleId, 'TEST', '{"sessions":[]}', 'integration-hash']);
  await client.query('INSERT INTO "ExamSessionConfig" (id, "patternVersionId", key, "deliveryMode", "timingPolicy", "durationSeconds", sequence) VALUES ($1, $2, $3, \'CBT\', \'CONTINUOUS\', 60, 0)', [sessionId, patternId, 'MAIN']);
  await client.query('UPDATE "ExamPatternVersion" SET status = \'PUBLISHED\', "publishedAt" = CURRENT_TIMESTAMP, "publishedSnapshot" = rules WHERE id = $1', [patternId]);

  await client.query('SAVEPOINT immutability_check');
  let parentBlocked = false;
  try { await client.query('UPDATE "ExamPatternVersion" SET rules = \'{"changed":true}\'::jsonb WHERE id = $1', [patternId]); } catch { parentBlocked = true; await client.query('ROLLBACK TO SAVEPOINT immutability_check'); }
  if (!parentBlocked) throw new Error('Published pattern mutation was not blocked');

  await client.query('SAVEPOINT child_immutability_check');
  let childBlocked = false;
  try { await client.query('UPDATE "ExamSessionConfig" SET "durationSeconds" = 120 WHERE id = $1', [sessionId]); } catch { childBlocked = true; await client.query('ROLLBACK TO SAVEPOINT child_immutability_check'); }
  if (!childBlocked) throw new Error('Published child configuration mutation was not blocked');

  await client.query('UPDATE "ExamPatternVersion" SET status = \'SUPERSEDED\' WHERE id = $1', [patternId]);
  await client.query('ROLLBACK');
  console.log('Database integration checks passed: normalized tables, migrations, audit-safe triggers and published immutability.');
} finally {
  await client.end();
}
