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
  if (process.env.STAGE_A_REHEARSAL === '1') {
    const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
    const expectedServerPort = Number(process.env.STAGE_A_REHEARSAL_SERVER_PORT ?? 5432);
    const expectedUrlPort = Number(process.env.STAGE_A_REHEARSAL_PORT ?? 55432);
    if (!identity.rows[0]?.name?.startsWith('stage_a_') || identity.rows[0]?.port !== expectedServerPort || Number(new URL(connectionString).port || 5432) !== expectedUrlPort) {
      throw new Error('Stage A rehearsal must target the isolated PostgreSQL instance');
    }
  } else if (process.env.STAGE_B_REHEARSAL === '1') {
    const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
    const expectedUrlPort = Number(process.env.STAGE_B_REHEARSAL_PORT ?? 55434);
    if (!identity.rows[0]?.name?.startsWith('netslet_stageb_') || Number(new URL(connectionString).port || 5432) !== expectedUrlPort || identity.rows[0]?.port !== 5432) {
      throw new Error('Stage B rehearsal must target the newly provisioned disposable PostgreSQL instance');
    }
  }
  const stageBValidation = process.env.STAGE_B_REHEARSAL === '1' || process.env.STAGE_B_CI === '1';
  const expectedTables = ['EmailVerificationToken', 'PasswordResetToken', 'ExamSubject', 'SyllabusVersion', 'SubjectUnit', 'SyllabusTopic', 'Question', 'QuestionVersion', 'QuestionOption', 'QuestionAnswerKeyVersion', 'QuestionExplanationVersion', 'QuestionSyllabusMapping', 'ContentProvenance', 'ContentLicence', 'QuestionReview', 'QuestionPublication', 'QuestionChallenge', 'SubjectPatternOverride', 'ExamSessionConfig', 'ExamSectionConfig', 'ScoringPolicy', 'LanguagePolicy', 'ExamRuleSource', ...(stageBValidation ? ['TestForm', 'TestFormQuestion', 'Attempt', 'AttemptSession', 'AttemptAnswer', 'AttemptAnswerEvent', 'AttemptSubmissionEvent', 'AttemptCommand', 'ScoreRun', 'AttemptResult', 'ResultExplanation', 'LearningEvidence', 'MistakeMineEntry', 'LearningTopicPerformance', 'LearningRecommendation'] : [])];
  const tableResult = await client.query('SELECT "table_name" FROM information_schema.tables WHERE table_schema = current_schema() AND "table_name" = ANY($1)', [expectedTables]);
  const actualTables = new Set(tableResult.rows.map((row) => row.table_name));
  for (const table of expectedTables) if (!actualTables.has(table)) throw new Error(`Missing normalized table: ${table}`);

  const migration = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
  const minimumMigrations = process.env.STAGE_A_REHEARSAL === '1' ? 1 : stageBValidation ? 3 : 15;
  if (migration.rows[0].count < minimumMigrations) throw new Error(`Expected at least ${minimumMigrations} migrations to be applied`);

  const triggerResult = await client.query("SELECT COUNT(*)::int AS count FROM information_schema.triggers WHERE trigger_name IN ('exam_pattern_version_immutability', 'pattern_session_immutability', 'pattern_scoring_immutability', 'question_revision_immutability', 'question_revision_delete_immutability', 'question_option_immutability', 'question_answer_key_immutability', 'question_explanation_immutability', 'question_mapping_immutability', 'question_translation_immutability', 'question_provenance_immutability', 'question_licence_immutability')");
  if (triggerResult.rows[0].count < 12) throw new Error('Content immutability triggers are not installed');

  await client.query('BEGIN');
  const accountId = crypto.randomUUID();
  const organizerId = crypto.randomUUID();
  const examId = crypto.randomUUID();
  const cycleId = crypto.randomUUID();
  const patternId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const syllabusId = crypto.randomUUID();
  const unitId = crypto.randomUUID();
  const topicId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  const questionVersionId = crypto.randomUUID();
  await client.query('INSERT INTO "Account" (id, email, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, \'STUDENT\', CURRENT_TIMESTAMP)', [accountId, `${accountId}@integration.test`, 'integration-only']);
  const sessionIdForAuth = crypto.randomUUID();
  await client.query('INSERT INTO "Session" (id, "accountId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL \'1 hour\')', [sessionIdForAuth, accountId, crypto.createHash('sha256').update(sessionIdForAuth).digest('hex')]);
  await client.query('UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP WHERE id = $1', [sessionIdForAuth]);
  const revoked = await client.query('SELECT "revokedAt" IS NOT NULL AS revoked FROM "Session" WHERE id = $1', [sessionIdForAuth]);
  if (!revoked.rows[0]?.revoked) throw new Error('Session revocation was not persisted');
  await client.query('INSERT INTO "ExamOrganizer" (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [organizerId, `TEST_${accountId.slice(0, 8)}`, 'Integration Test Organizer']);
  await client.query('INSERT INTO "Examination" (id, code, name, family, "organizerId", "updatedAt") VALUES ($1, $2, $3, \'UGC_NET\', $4, CURRENT_TIMESTAMP)', [examId, `TEST_${accountId.slice(0, 8)}`, 'Integration Test Examination', organizerId]);
  await client.query('INSERT INTO "ExamCycle" (id, "examinationId", code) VALUES ($1, $2, $3)', [cycleId, examId, 'INTEGRATION']);
  await client.query('INSERT INTO "ExamSubject" (id, "examCycleId", code, name, status) VALUES ($1, $2, $3, $4, \'RESEARCH_ONLY\')', [crypto.randomUUID(), cycleId, 'TEST', 'Integration Subject']);
  await client.query('INSERT INTO "SyllabusVersion" (id, "examCycleId", "subjectCode", version, title, status, "createdById", "updatedAt") VALUES ($1, $2, $3, 1, $4, \'DRAFT\', $5, CURRENT_TIMESTAMP)', [syllabusId, cycleId, 'TEST', 'Research-only integration syllabus', accountId]);
  await client.query('INSERT INTO "SubjectUnit" (id, "syllabusVersionId", code, title, sequence, "updatedAt") VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)', [unitId, syllabusId, 'UNIT_1', 'Integration foundations']);
  await client.query('INSERT INTO "SyllabusTopic" (id, "subjectUnitId", code, title, sequence, "updatedAt") VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)', [topicId, unitId, 'TOPIC_1', 'Integration topic']);
  const taxonomy = await client.query('SELECT sv.id, su.id AS unit_id, st.id AS topic_id FROM "SyllabusVersion" sv JOIN "SubjectUnit" su ON su."syllabusVersionId" = sv.id JOIN "SyllabusTopic" st ON st."subjectUnitId" = su.id WHERE sv.id = $1', [syllabusId]);
  if (taxonomy.rows[0]?.unit_id !== unitId || taxonomy.rows[0]?.topic_id !== topicId) throw new Error('Syllabus taxonomy hierarchy is not scoped correctly');
  await client.query('INSERT INTO "Question" (id, "examCycleId", "subjectCode", "createdById", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)', [questionId, cycleId, 'TEST', accountId]);
  await client.query('INSERT INTO "QuestionVersion" (id, "questionId", version, status, type, prompt, "authoredById", "updatedAt") VALUES ($1, $2, 1, \'DRAFT\', \'SINGLE_CHOICE\', $3::jsonb, $4, CURRENT_TIMESTAMP)', [questionVersionId, questionId, '{"text":"Integration-only research question"}', accountId]);
  await client.query('INSERT INTO "QuestionOption" (id, "questionVersionId", "optionKey", "optionText", sequence, "updatedAt") VALUES ($1, $2, $3, $4::jsonb, 0, CURRENT_TIMESTAMP)', [crypto.randomUUID(), questionVersionId, 'A', '{"text":"Option A"}']);
  await client.query('INSERT INTO "QuestionSyllabusMapping" (id, "questionVersionId", "syllabusTopicId") VALUES ($1, $2, $3)', [crypto.randomUUID(), questionVersionId, topicId]);
  await client.query('UPDATE "QuestionVersion" SET status = \'PUBLISHED\' WHERE id = $1', [questionVersionId]);
  await client.query('SAVEPOINT question_immutability_check');
  let questionBlocked = false;
  try { await client.query('UPDATE "QuestionVersion" SET prompt = \'{"changed":true}\'::jsonb WHERE id = $1', [questionVersionId]); } catch { questionBlocked = true; await client.query('ROLLBACK TO SAVEPOINT question_immutability_check'); }
  if (!questionBlocked) throw new Error('Published question revision mutation was not blocked');
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
