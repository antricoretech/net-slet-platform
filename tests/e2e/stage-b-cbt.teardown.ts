import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { FullConfig } from '@playwright/test';

const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => DbClient };
interface DbClient { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; }

export default async function globalTeardown(_config: FullConfig) {
  const fixturePath = path.resolve('test-results/stage-b-e2e/fixture.json');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !fs.existsSync(fixturePath)) return;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { studentA: { id: string }; studentB: { id: string }; admin: { id: string }; examinationId: string; cycleId: string; forms: Array<{ formId: string; patternId: string; questionId: string; syllabusVersionId: string; subjectUnitId: string; topicId: string }> };
  const parsed = new URL(databaseUrl);
  const isLocalStageB = parsed.port === '55434';
  const isCiStageB = process.env.STAGE_B_CI === '1' && parsed.port === '5432' && parsed.pathname === '/netslet_stageb_ci';
  if (!isLocalStageB && !isCiStageB) throw new Error('E2E teardown refuses a database URL outside the isolated Stage B targets');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
  if (!String(identity.rows[0]?.name).startsWith('netslet_stageb_') || identity.rows[0]?.port !== 5432) throw new Error('E2E teardown refuses a non-disposable Stage B database');
  const accountIds = [fixture.studentA.id, fixture.studentB.id, fixture.admin.id];
  const publishedContent = await client.query('SELECT EXISTS (SELECT 1 FROM "QuestionVersion" qv JOIN "Question" q ON q.id = qv."questionId" WHERE q."examCycleId" = $1 AND qv.status = \'PUBLISHED\') AS present', [fixture.cycleId]);
  // Published fixtures are intentionally immutable. The CI database is disposable,
  // so retain that content rather than bypassing the production trigger in teardown.
  const retainPublishedContent = Boolean(publishedContent.rows[0]?.present);
  for (const form of fixture.forms) {
    await client.query('DELETE FROM "Attempt" WHERE "testFormId" = $1', [form.formId]);
    await client.query('DELETE FROM "TestForm" WHERE id = $1', [form.formId]);
    if (!retainPublishedContent) await client.query('DELETE FROM "Question" WHERE id = $1', [form.questionId]);
    await client.query('DELETE FROM "ExamPatternVersion" WHERE id = $1', [form.patternId]);
  }
  if (retainPublishedContent) { await client.end(); return; }
  const syllabusVersionIds = [...new Set(fixture.forms.map((form) => form.syllabusVersionId))];
  const subjectUnitIds = [...new Set(fixture.forms.map((form) => form.subjectUnitId))];
  const topicIds = [...new Set(fixture.forms.map((form) => form.topicId))];
  await client.query('DELETE FROM "SyllabusTopic" WHERE id = ANY($1::uuid[])', [topicIds]);
  await client.query('DELETE FROM "SubjectUnit" WHERE id = ANY($1::uuid[])', [subjectUnitIds]);
  await client.query('DELETE FROM "SyllabusVersion" WHERE id = ANY($1::uuid[])', [syllabusVersionIds]);
  await client.query('DELETE FROM "AuditEvent" WHERE "accountId" = ANY($1::uuid[])', [accountIds]);
  await client.query('DELETE FROM "Account" WHERE id = ANY($1::uuid[])', [accountIds]);
  await client.query('DELETE FROM "ExamCycle" WHERE id = $1', [fixture.cycleId]);
  await client.query('DELETE FROM "Examination" WHERE id = $1', [fixture.examinationId]);
  await client.query('DELETE FROM "ExamOrganizer" WHERE code LIKE \'STAGE_B_E2E_ORG_%\' AND NOT EXISTS (SELECT 1 FROM "Examination" WHERE "organizerId" = "ExamOrganizer".id)');
  await client.end();
}
