import crypto from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const api = process.env.STAGE_B_API_URL ?? 'http://127.0.0.1:4400/api/v1';
const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.STAGE_B_REHEARSAL !== '1') throw new Error('CBT HTTP integration requires STAGE_B_REHEARSAL=1 and an isolated DATABASE_URL');
const parsedUrl = new URL(connectionString);
const client = new Client({ connectionString });
await client.connect();
let accountId;
let sessionCookie;
let attemptId;
const ids = Object.fromEntries(['organizer', 'examination', 'cycle', 'pattern', 'question', 'version', 'optionA', 'optionB', 'answerKey', 'form', 'formQuestion'].map((name) => [name, crypto.randomUUID()]));

async function request(path, init = {}) {
  const headers = { 'content-type': 'application/json', ...(sessionCookie ? { cookie: sessionCookie } : {}), ...(init.headers ?? {}) };
  const response = await fetch(`${api}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

try {
  const identity = await client.query('SELECT current_database() AS name, inet_server_port() AS port');
  if (!identity.rows[0]?.name?.startsWith('netslet_stageb_') || parsedUrl.port !== '55434' || identity.rows[0]?.port !== 5432) throw new Error('Refusing CBT HTTP integration outside the disposable Stage B database');

  const registered = await request('/auth/register', { method: 'POST', body: JSON.stringify({ email: `cbt-${ids.form}@integration.test`, password: 'IntegrationOnlyPassword123!' }) });
  accountId = registered.account.id;
  // Node exposes Set-Cookie on the response; registration is repeated here to retain the response headers.
  const authResponse = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `cbt-${ids.form}@integration.test`, password: 'IntegrationOnlyPassword123!' }) });
  const authBody = await authResponse.json();
  if (!authResponse.ok) throw new Error(`POST /auth/login returned ${authResponse.status}: ${JSON.stringify(authBody)}`);
  sessionCookie = authResponse.headers.get('set-cookie')?.split(';')[0];
  if (!sessionCookie) throw new Error('Authenticated session cookie was not returned');

  const snapshot = {
    snapshotId: ids.form, snapshotHash: 'stage-b-http-fixture', generatedAt: new Date().toISOString(), seed: 'stage-b-http',
    blueprint: { examCode: 'UGC_NET', cycleCode: 'STAGE-B-HTTP', subjectCode: 'INTEGRATION', sections: [{ key: 'part-a', sequence: 0, questionVersionIds: [ids.version] }] },
    sessions: [{ key: 'session-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds: 600, sections: [{ key: 'part-a', answerPolicy: 'SINGLE_SELECT' }] }],
    sections: [{ key: 'part-a', sequence: 0, questions: [{ questionVersionId: ids.version, type: 'SINGLE_CHOICE', prompt: 'Integration-only question', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], languageCode: 'en' }] }],
    scoringPolicy: { policyId: 'STAGE-B-HTTP-FIXTURE', version: '1', provenance: 'RESEARCH_ONLY', positiveMarksScaled: 100, wrongMarksScaled: 25, unattemptedMarksScaled: 0, scale: 100, excessAttemptPolicy: 'ALL_RESPONSES_COUNT', countsUnansweredAsAttempt: false },
    publication: { qaOnly: true },
  };
  await client.query('INSERT INTO "ExamOrganizer" (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [ids.organizer, `STAGE_B_${ids.form.slice(0, 8)}`, 'Stage B integration organizer']);
  await client.query('INSERT INTO "Examination" (id, code, name, family, "organizerId", "updatedAt") VALUES ($1, $2, $3, \'UGC_NET\', $4, CURRENT_TIMESTAMP)', [ids.examination, `STAGE_B_${ids.form.slice(0, 8)}`, 'Stage B integration examination', ids.organizer]);
  await client.query('INSERT INTO "ExamCycle" (id, "examinationId", code) VALUES ($1, $2, $3)', [ids.cycle, ids.examination, `STAGE_B_${ids.form.slice(0, 8)}`]);
  await client.query('INSERT INTO "ExamPatternVersion" (id, "examCycleId", "subjectCode", version, status, rules, "ruleHash", "publishedAt") VALUES ($1, $2, \'INTEGRATION\', 1, \'PUBLISHED\', $3::jsonb, \'stage-b-http\', CURRENT_TIMESTAMP)', [ids.pattern, ids.cycle, JSON.stringify({ sessions: [] })]);
  await client.query('INSERT INTO "Question" (id, "examCycleId", "subjectCode", "createdById", "updatedAt") VALUES ($1, $2, \'INTEGRATION\', $3, CURRENT_TIMESTAMP)', [ids.question, ids.cycle, accountId]);
  await client.query('INSERT INTO "QuestionVersion" (id, "questionId", version, status, type, prompt, "authoredById", "updatedAt") VALUES ($1, $2, 1, \'DRAFT\', \'SINGLE_CHOICE\', $3::jsonb, $4, CURRENT_TIMESTAMP)', [ids.version, ids.question, JSON.stringify({ text: 'Integration-only question' }), accountId]);
  await client.query('INSERT INTO "QuestionOption" (id, "questionVersionId", "optionKey", "optionText", sequence, "updatedAt") VALUES ($1, $2, \'A\', $3::jsonb, 0, CURRENT_TIMESTAMP), ($4, $2, \'B\', $5::jsonb, 1, CURRENT_TIMESTAMP)', [ids.optionA, ids.version, JSON.stringify({ text: 'A' }), ids.optionB, JSON.stringify({ text: 'B' })]);
  await client.query('INSERT INTO "QuestionAnswerKeyVersion" (id, "questionVersionId", version, "correctAnswers", "createdById") VALUES ($1, $2, 1, $3::jsonb, $4)', [ids.answerKey, ids.version, JSON.stringify(['a']), accountId]);
  await client.query('INSERT INTO "TestForm" (id, "examCycleId", "patternVersionId", "subjectCode", version, status, snapshot, "snapshotHash", "createdById", "publishedAt", "updatedAt") VALUES ($1, $2, $3, \'INTEGRATION\', 1, \'PUBLISHED\', $4::jsonb, \'stage-b-http-fixture\', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [ids.form, ids.cycle, ids.pattern, JSON.stringify(snapshot), accountId]);
  await client.query('INSERT INTO "TestFormQuestion" (id, "testFormId", "questionVersionId", "sessionKey", "sectionKey", sequence, snapshot) VALUES ($1, $2, $3, \'session-1\', \'part-a\', 0, $4::jsonb)', [ids.formQuestion, ids.form, ids.version, JSON.stringify(snapshot.sections[0].questions[0])]);

  const started = await request('/attempts', { method: 'POST', body: JSON.stringify({ testFormId: ids.form, idempotencyKey: 'stage-b-http-start' }) });
  attemptId = started.attemptId;
  const sessionId = started.state.sessions[0].id;
  const resumed = await request(`/attempts/${attemptId}/form`);
  const activated = await request(`/attempts/${attemptId}/sessions/${sessionId}/start`, { method: 'POST' });
  const saved = await request(`/attempts/${attemptId}/answers/${ids.version}`, { method: 'PUT', body: JSON.stringify({ selectedOptionIds: ['a'], expectedRevision: activated.revision, idempotencyKey: 'stage-b-http-answer' }) });
  await request(`/attempts/${attemptId}/sessions/${sessionId}/submit`, { method: 'POST' });
  const result = await request(`/attempts/${attemptId}/submit`, { method: 'POST' });
  const duplicate = await request(`/attempts/${attemptId}/submit`, { method: 'POST' });
  const persisted = await request(`/attempts/${attemptId}/result`);
  const learning = await request(`/attempts/${attemptId}/learning-summary`);
  const durableEvidence = await client.query('SELECT COUNT(*)::int AS count FROM "LearningEvidence" WHERE "attemptId" = $1', [attemptId]);
  const durableMistakes = await client.query('SELECT COUNT(*)::int AS count FROM "MistakeMineEntry" WHERE "attemptId" = $1', [attemptId]);
  if (resumed.form.snapshotId !== ids.form || saved.attemptRevision <= activated.revision || result.correct !== 1 || persisted.scoreRunReference !== result.scoreRunReference || duplicate.scoreRunReference !== result.scoreRunReference || learning.analytics.overall.correct !== 1 || durableEvidence.rows[0].count !== 1 || durableMistakes.rows[0].count !== 0) throw new Error('Persistent CBT HTTP assertions failed');
  console.log('CBT HTTP integration checks passed: authenticated start, resume, server session, durable answer, atomic submission, deterministic scoring and durable learning projection.');
} finally {
  if (accountId) {
    await client.query('DELETE FROM "AuditEvent" WHERE "accountId" = $1', [accountId]);
    if (attemptId) await client.query('DELETE FROM "Attempt" WHERE id = $1', [attemptId]);
    await client.query('DELETE FROM "TestForm" WHERE id = $1', [ids.form]);
    await client.query('DELETE FROM "Question" WHERE id = $1', [ids.question]);
    await client.query('DELETE FROM "ExamPatternVersion" WHERE id = $1', [ids.pattern]);
    await client.query('DELETE FROM "ExamCycle" WHERE id = $1', [ids.cycle]);
    await client.query('DELETE FROM "Examination" WHERE id = $1', [ids.examination]);
    await client.query('DELETE FROM "ExamOrganizer" WHERE id = $1', [ids.organizer]);
    await client.query('DELETE FROM "Account" WHERE id = $1', [accountId]);
  }
  await client.end();
}
