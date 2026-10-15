import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AttemptsService } from './attempts.service';
import { LearningService } from './learning.service';
import { ScoringService } from './scoring.service';

const enabled = process.env.R1_INTEGRITY_DB_TEST === '1' || process.env.STAGE_B_CI === '1';
const databaseDescribe = enabled ? describe : describe.skip;

databaseDescribe('AttemptsService PostgreSQL transaction integrity', () => {
  jest.setTimeout(30_000);
  const ids = Object.fromEntries(['organizer', 'examination', 'cycle', 'pattern', 'account', 'otherAccount', 'question', 'version', 'optionA', 'optionB', 'answerKey', 'form', 'formQuestion', 'attempt', 'session'].map((key) => [key, randomUUID()])) as Record<string, string>;
  let database: PrismaService;
  let fixtureCreated = false;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('R1 integrity integration requires DATABASE_URL');
    const parsed = new URL(connectionString);
    const local = parsed.port === '55434' && parsed.pathname === '/netslet_stageb_r1_integrity';
    const ci = process.env.STAGE_B_CI === '1' && parsed.port === '5432' && parsed.pathname === '/netslet_stageb_ci';
    if (!local && !ci) throw new Error('R1 integrity integration refuses a non-disposable database');
    database = new PrismaService();
    const identity = await database.$queryRawUnsafe<Array<{ name: string; port: number }>>('SELECT current_database() AS name, inet_server_port() AS port');
    if (!identity[0]?.name.startsWith('netslet_stageb_') || identity[0].port !== 5432) throw new Error('R1 integrity integration database identity failed');

    const snapshot = {
      snapshotId: ids.form, snapshotHash: 'r1-integrity-transaction-fixture', generatedAt: new Date().toISOString(), seed: 'r1-integrity',
      blueprint: { examCode: 'R1_INTEGRITY', cycleCode: 'SYNTHETIC', subjectCode: 'TEST', sections: [{ key: 'part-a', sequence: 0, questionVersionIds: [ids.version] }] },
      sessions: [{ key: 'session-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds: 1, sections: [{ key: 'part-a', answerPolicy: 'SINGLE_SELECT' }] }],
      sections: [{ key: 'part-a', sequence: 0, questions: [{ questionVersionId: ids.version, type: 'SINGLE_CHOICE', prompt: 'Synthetic integrity question', options: [{ id: ids.optionA, label: 'A' }, { id: ids.optionB, label: 'B' }], languageCode: 'en' }] }],
      scoringPolicy: { policyId: 'R1-INTEGRITY', version: '1', provenance: 'RESEARCH_ONLY', positiveMarksScaled: 100, wrongMarksScaled: 25, unattemptedMarksScaled: 0, scale: 100, excessAttemptPolicy: 'ALL_RESPONSES_COUNT', countsUnansweredAsAttempt: false },
      publication: { qaOnly: true },
    };
    const execute = (sql: string, ...values: unknown[]) => database.$executeRawUnsafe(sql, ...values);
    await execute('INSERT INTO "Account" (id, email, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, \'STUDENT\', CURRENT_TIMESTAMP), ($4, $5, $3, \'STUDENT\', CURRENT_TIMESTAMP)', ids.account, `${ids.account}@integration.test`, 'integration-only', ids.otherAccount, `${ids.otherAccount}@integration.test`);
    await execute('INSERT INTO "ExamOrganizer" (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', ids.organizer, `R1_${ids.organizer.slice(0, 8)}`, 'R1 integrity fixture organizer');
    await execute('INSERT INTO "Examination" (id, code, name, family, "organizerId", "updatedAt") VALUES ($1, $2, $3, \'UGC_NET\', $4, CURRENT_TIMESTAMP)', ids.examination, `R1_${ids.examination.slice(0, 8)}`, 'R1 integrity fixture examination', ids.organizer);
    await execute('INSERT INTO "ExamCycle" (id, "examinationId", code) VALUES ($1, $2, $3)', ids.cycle, ids.examination, 'R1-INTEGRITY');
    await execute('INSERT INTO "ExamPatternVersion" (id, "examCycleId", "subjectCode", version, status, rules, "ruleHash", "publishedAt") VALUES ($1, $2, \'TEST\', 1, \'PUBLISHED\', $3::jsonb, $4, CURRENT_TIMESTAMP)', ids.pattern, ids.cycle, JSON.stringify({ sessions: [] }), 'r1-integrity');
    await execute('INSERT INTO "Question" (id, "examCycleId", "subjectCode", "createdById", "updatedAt") VALUES ($1, $2, \'TEST\', $3, CURRENT_TIMESTAMP)', ids.question, ids.cycle, ids.account);
    await execute('INSERT INTO "QuestionVersion" (id, "questionId", version, status, type, prompt, "authoredById", "updatedAt") VALUES ($1, $2, 1, \'DRAFT\', \'SINGLE_CHOICE\', $3::jsonb, $4, CURRENT_TIMESTAMP)', ids.version, ids.question, JSON.stringify({ text: 'Synthetic integrity question' }), ids.account);
    await execute('INSERT INTO "QuestionOption" (id, "questionVersionId", "optionKey", "optionText", sequence, "updatedAt") VALUES ($1, $2, \'A\', $3::jsonb, 0, CURRENT_TIMESTAMP), ($4, $2, \'B\', $5::jsonb, 1, CURRENT_TIMESTAMP)', ids.optionA, ids.version, JSON.stringify({ text: 'A' }), ids.optionB, JSON.stringify({ text: 'B' }));
    await execute('INSERT INTO "QuestionAnswerKeyVersion" (id, "questionVersionId", version, "correctAnswers", "createdById") VALUES ($1, $2, 1, $3::jsonb, $4)', ids.answerKey, ids.version, JSON.stringify([ids.optionA]), ids.account);
    await execute('INSERT INTO "TestForm" (id, "examCycleId", "patternVersionId", "subjectCode", version, status, snapshot, "snapshotHash", "createdById", "publishedAt", "updatedAt") VALUES ($1, $2, $3, \'TEST\', 1, \'PUBLISHED\', $4::jsonb, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', ids.form, ids.cycle, ids.pattern, JSON.stringify(snapshot), 'r1-integrity-transaction-fixture', ids.account);
    await execute('INSERT INTO "TestFormQuestion" (id, "testFormId", "questionVersionId", "answerKeyVersionId", "sessionKey", "sectionKey", sequence, snapshot) VALUES ($1, $2, $3, $4, \'session-1\', \'part-a\', 0, $5::jsonb)', ids.formQuestion, ids.form, ids.version, ids.answerKey, JSON.stringify(snapshot.sections[0].questions[0]));
    await execute('INSERT INTO "Attempt" (id, "accountId", "testFormId", status, revision, "startIdempotencyKey", "startedAt", "updatedAt") VALUES ($1, $2, $3, \'IN_PROGRESS\', 1, $4, CURRENT_TIMESTAMP - INTERVAL \'2 seconds\', CURRENT_TIMESTAMP)', ids.attempt, ids.account, ids.form, 'r1-integrity-start');
    await execute('INSERT INTO "AttemptSession" (id, "attemptId", key, sequence, status, "timingPolicy", "durationSeconds", "deadlineAt", "startedAt", "updatedAt") VALUES ($1, $2, \'session-1\', 0, \'IN_PROGRESS\', \'CONTINUOUS\', 1, CURRENT_TIMESTAMP - INTERVAL \'1 second\', CURRENT_TIMESTAMP - INTERVAL \'2 seconds\', CURRENT_TIMESTAMP)', ids.session, ids.attempt);
    fixtureCreated = true;
  });

  afterAll(async () => {
    if (!database) return;
    if (fixtureCreated) {
      await database.$executeRawUnsafe('DELETE FROM "AuditEvent" WHERE "accountId" IN ($1::uuid, $2::uuid)', ids.account, ids.otherAccount);
      await database.$executeRawUnsafe('DELETE FROM "Attempt" WHERE id = $1::uuid', ids.attempt);
      await database.$executeRawUnsafe('DELETE FROM "TestForm" WHERE id = $1::uuid', ids.form);
      await database.$executeRawUnsafe('DELETE FROM "Question" WHERE id = $1::uuid', ids.question);
      await database.$executeRawUnsafe('DELETE FROM "ExamPatternVersion" WHERE id = $1::uuid', ids.pattern);
      await database.$executeRawUnsafe('DELETE FROM "ExamCycle" WHERE id = $1::uuid', ids.cycle);
      await database.$executeRawUnsafe('DELETE FROM "Examination" WHERE id = $1::uuid', ids.examination);
      await database.$executeRawUnsafe('DELETE FROM "ExamOrganizer" WHERE id = $1::uuid', ids.organizer);
      await database.$executeRawUnsafe('DELETE FROM "Account" WHERE id IN ($1::uuid, $2::uuid)', ids.account, ids.otherAccount);
    }
    await database.$disconnect();
  });

  it('commits exactly one expiry before concurrent late-write conflicts and finalizes exactly once', async () => {
    const attempts = new AttemptsService(database);
    const lateWrites = await Promise.allSettled([
      attempts.saveAnswer(ids.account, ids.attempt, ids.version, { selectedOptionIds: [ids.optionA], expectedRevision: 1, idempotencyKey: 'late-write-1' }),
      attempts.saveAnswer(ids.account, ids.attempt, ids.version, { selectedOptionIds: [ids.optionA], expectedRevision: 1, idempotencyKey: 'late-write-2' }),
    ]);
    expect(lateWrites.every((item) => item.status === 'rejected' && item.reason instanceof ConflictException)).toBe(true);
    await expect(attempts.saveAnswer(ids.otherAccount, ids.attempt, ids.version, { selectedOptionIds: [ids.optionA], expectedRevision: 1, idempotencyKey: 'cross-owner' })).rejects.toThrow('Attempt not found');

    const committed = await database.$queryRawUnsafe<Array<{ attemptStatus: string; sessionStatus: string; answerEvents: number; expiryEvents: number }>>('SELECT a.status AS "attemptStatus", s.status AS "sessionStatus", (SELECT COUNT(*)::int FROM "AttemptAnswerEvent" e WHERE e."attemptId" = a.id) AS "answerEvents", (SELECT COUNT(*)::int FROM "AuditEvent" u WHERE u."attemptId" = a.id AND u.type = \'ATTEMPT_EXPIRED\') AS "expiryEvents" FROM "Attempt" a JOIN "AttemptSession" s ON s."attemptId" = a.id WHERE a.id = $1::uuid', ids.attempt);
    expect(committed[0]).toEqual({ attemptStatus: 'EXPIRED', sessionStatus: 'EXPIRED', answerEvents: 0, expiryEvents: 1 });

    const learning = new LearningService(database);
    const scoring = new ScoringService(database, learning, attempts);
    const results = await Promise.all([scoring.finalize(ids.account, ids.attempt), scoring.finalize(ids.account, ids.attempt), scoring.finalize(ids.account, ids.attempt)]);
    expect(new Set(results.map((result) => result.scoreRunReference)).size).toBe(1);
    const counts = await database.$queryRawUnsafe<Array<{ scoreRuns: number; results: number }>>('SELECT (SELECT COUNT(*)::int FROM "ScoreRun" WHERE "attemptId" = $1::uuid) AS "scoreRuns", (SELECT COUNT(*)::int FROM "AttemptResult" WHERE "attemptId" = $1::uuid) AS results', ids.attempt);
    expect(counts[0]).toEqual({ scoreRuns: 1, results: 1 });
  });
});
