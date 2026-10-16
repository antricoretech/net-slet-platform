import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import type { FullConfig } from '@playwright/test';

const requireFromApi = createRequire(path.resolve('apps/api/package.json'));
const { Client } = requireFromApi('pg') as { Client: new (options: { connectionString: string }) => DbClient };
interface DbClient { connect(): Promise<void>; end(): Promise<void>; query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>; }

const api = process.env.STAGE_B_API_URL ?? `http://127.0.0.1:${process.env.STAGE_B_API_PORT ?? '4000'}/api/v1`;
const outputPath = path.resolve('test-results/stage-b-e2e/fixture.json');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Stage B E2E requires DATABASE_URL for the isolated fixture');

const uuid = () => crypto.randomUUID();
async function register(email: string, password: string) {
  const response = await fetch(`${api}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await response.json().catch(() => ({})) as { account?: { id: string } };
  if (!response.ok || !body.account?.id) throw new Error(`E2E fixture registration failed: ${response.status}`);
  return body.account.id;
}

export default async function globalSetup(_config: FullConfig) {
  const parsed = new URL(databaseUrl!);
  const isLocalStageB = parsed.port === '55434';
  const isCiStageB = process.env.STAGE_B_CI === '1' && parsed.port === '5432' && parsed.pathname === '/netslet_stageb_ci';
  if (!isLocalStageB && !isCiStageB) throw new Error('E2E fixture refuses a database URL outside the isolated Stage B targets');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
  if (!String(identity.rows[0]?.name).startsWith('netslet_stageb_') || identity.rows[0]?.port !== 5432) throw new Error('E2E fixture refuses a non-disposable Stage B database');

  const password = 'StageB-E2E-Only-Password-123!';
  const suffix = uuid().slice(0, 8);
  const studentA = { email: `stageb-e2e-a-${suffix}@example.test`, id: await register(`stageb-e2e-a-${suffix}@example.test`, password) };
  const studentB = { email: `stageb-e2e-b-${suffix}@example.test`, id: await register(`stageb-e2e-b-${suffix}@example.test`, password) };
  const admin = { email: `stageb-e2e-admin-${suffix}@example.test`, id: await register(`stageb-e2e-admin-${suffix}@example.test`, password) };
  await client.query('UPDATE "Account" SET role = \'ADMIN\' WHERE id = $1', [admin.id]);
  const organizerId = uuid();
  const examinationId = uuid();
  const cycleId = uuid();
  const entities: Array<{ formId: string; patternId: string; questionId: string; versionId: string; answerKeyVersionId: string; optionA: string; optionB: string; formQuestionId: string; subjectCode: string; durationSeconds: number; syllabusVersionId: string; subjectUnitId: string; topicId: string }> = [];

  await client.query('INSERT INTO "ExamOrganizer" (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [organizerId, `STAGE_B_E2E_ORG_${suffix}`, 'Stage B E2E fixture organizer']);
  await client.query('INSERT INTO "Examination" (id, code, name, family, "organizerId", "updatedAt") VALUES ($1, $2, $3, \'UGC_NET\', $4, CURRENT_TIMESTAMP)', [examinationId, `STAGE_B_E2E_${suffix}`, 'Stage B E2E fixture examination', organizerId]);
  await client.query('INSERT INTO "ExamCycle" (id, "examinationId", code) VALUES ($1, $2, $3)', [cycleId, examinationId, `E2E_${suffix}`]);

  for (const [subjectCode, durationSeconds, questionCount] of [['PERSISTENT', 600, 2], ['EXPIRED', 1, 1] ] as const) {
    const patternId = uuid(); const formId = uuid();
    const syllabusVersionId = uuid(); const subjectUnitId = uuid(); const topicId = uuid();
    await client.query('INSERT INTO "SyllabusVersion" (id, "examCycleId", "subjectCode", version, title, status, "createdById", "updatedAt") VALUES ($1, $2, $3, 1, $4, \'DRAFT\', $5, CURRENT_TIMESTAMP)', [syllabusVersionId, cycleId, subjectCode, `${subjectCode} E2E syllabus`, studentA.id]);
    await client.query('INSERT INTO "SubjectUnit" (id, "syllabusVersionId", code, title, sequence, "updatedAt") VALUES ($1, $2, \'UNIT-1\', \'E2E unit\', 0, CURRENT_TIMESTAMP)', [subjectUnitId, syllabusVersionId]);
    await client.query('INSERT INTO "SyllabusTopic" (id, "subjectUnitId", code, title, sequence, "updatedAt") VALUES ($1, $2, \'TOPIC-1\', \'E2E topic\', 0, CURRENT_TIMESTAMP)', [topicId, subjectUnitId]);
    const questionIds: string[] = []; const questions: Array<Record<string, unknown>> = [];
    for (let index = 0; index < questionCount; index += 1) {
      const questionId = uuid(); const versionId = uuid(); const answerKeyVersionId = uuid(); const optionA = uuid(); const optionB = uuid(); const formQuestionId = uuid();
      questionIds.push(questionId);
      const question = { questionVersionId: versionId, type: 'SINGLE_CHOICE', prompt: `${subjectCode} fixture question ${index + 1}`, options: [{ id: optionA, label: 'Correct option' }, { id: optionB, label: 'Other option' }], languageCode: 'en' };
      questions.push(question);
      await client.query('INSERT INTO "Question" (id, "examCycleId", "subjectCode", "createdById", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)', [questionId, cycleId, subjectCode, studentA.id]);
      await client.query('INSERT INTO "QuestionVersion" (id, "questionId", version, status, type, prompt, "authoredById", "updatedAt") VALUES ($1, $2, 1, \'PUBLISHED\', \'SINGLE_CHOICE\', $3::jsonb, $4, CURRENT_TIMESTAMP)', [versionId, questionId, JSON.stringify({ text: question.prompt }), studentA.id]);
      await client.query('INSERT INTO "QuestionOption" (id, "questionVersionId", "optionKey", "optionText", sequence, "updatedAt") VALUES ($1, $2, \'A\', $3::jsonb, 0, CURRENT_TIMESTAMP), ($4, $2, \'B\', $5::jsonb, 1, CURRENT_TIMESTAMP)', [optionA, versionId, JSON.stringify({ text: 'Correct option' }), optionB, JSON.stringify({ text: 'Other option' })]);
      await client.query('INSERT INTO "QuestionAnswerKeyVersion" (id, "questionVersionId", version, "correctAnswers", "createdById") VALUES ($1, $2, 1, $3::jsonb, $4)', [answerKeyVersionId, versionId, JSON.stringify([optionA]), studentA.id]);
      await client.query('INSERT INTO "QuestionSyllabusMapping" (id, "questionVersionId", "syllabusTopicId") VALUES ($1, $2, $3)', [uuid(), versionId, topicId]);
      entities.push({ formId, patternId, questionId, versionId, answerKeyVersionId, optionA, optionB, formQuestionId, subjectCode, durationSeconds, syllabusVersionId, subjectUnitId, topicId });
    }
    const snapshot = { snapshotId: formId, snapshotHash: `stage-b-e2e-${subjectCode.toLowerCase()}`, generatedAt: new Date().toISOString(), seed: 'stage-b-e2e', blueprint: { examCode: `STAGE_B_E2E_${suffix}`, cycleCode: `E2E_${suffix}`, subjectCode, sections: [{ key: 'part-a', sequence: 0, questionVersionIds: questions.map((question) => question.questionVersionId) }] }, sessions: [{ key: 'session-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds, sections: [{ key: 'part-a', answerPolicy: 'SINGLE_SELECT' }] }], sections: [{ key: 'part-a', sequence: 0, questions }], scoringPolicy: { policyId: 'STAGE-B-E2E', version: '1', provenance: 'RESEARCH_ONLY', positiveMarksScaled: 100, wrongMarksScaled: 25, unattemptedMarksScaled: 0, scale: 100, excessAttemptPolicy: 'ALL_RESPONSES_COUNT', countsUnansweredAsAttempt: false }, publication: { qaOnly: true } };
    await client.query('INSERT INTO "ExamPatternVersion" (id, "examCycleId", "subjectCode", version, status, rules, "ruleHash", "publishedAt") VALUES ($1, $2, $3, 1, \'PUBLISHED\', $4::jsonb, \'stage-b-e2e\', CURRENT_TIMESTAMP)', [patternId, cycleId, subjectCode, JSON.stringify({ sessions: [] })]);
    await client.query('INSERT INTO "TestForm" (id, "examCycleId", "patternVersionId", "subjectCode", version, status, snapshot, "snapshotHash", "createdById", "publishedAt", "updatedAt") VALUES ($1, $2, $3, $4, 1, \'PUBLISHED\', $5::jsonb, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [formId, cycleId, patternId, subjectCode, JSON.stringify(snapshot), snapshot.snapshotHash, studentA.id]);
    for (const [index, question] of questions.entries()) await client.query('INSERT INTO "TestFormQuestion" (id, "testFormId", "questionVersionId", "answerKeyVersionId", "sessionKey", "sectionKey", sequence, snapshot) VALUES ($1, $2, $3, $4, \'session-1\', \'part-a\', $5, $6::jsonb)', [uuid(), formId, question.questionVersionId, entities.find((entity) => entity.formId === formId && entity.versionId === question.questionVersionId)?.answerKeyVersionId, index, JSON.stringify(question)]);
  }
  await client.end();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ api, password, studentA, studentB, admin, examinationId, cycleId, forms: entities }, null, 2));
}
