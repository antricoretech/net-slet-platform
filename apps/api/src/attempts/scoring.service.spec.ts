import { ConflictException } from '@nestjs/common';
import { AttemptStatus, Prisma, ResultReleaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ScoringService } from './scoring.service';

const snapshot = {
  snapshotId: 'form-1', snapshotHash: 'snapshot-hash', generatedAt: '2026-10-15T00:00:00.000Z', seed: 'seed-1',
  blueprint: { examCode: 'UGC_NET', cycleCode: '2026-JUNE', subjectCode: 'CS', sections: [{ key: 'part-a', sequence: 0, questionVersionIds: ['q-1', 'q-2', 'q-3'] }] },
  sessions: [{ key: 'session-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds: 3600, sections: [{ key: 'part-a', answerPolicy: 'SINGLE_SELECT' }] }],
  sections: [{ key: 'part-a', sequence: 0, questions: [
    { questionVersionId: 'q-1', type: 'SINGLE_CHOICE', prompt: 'One', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], languageCode: 'en' },
    { questionVersionId: 'q-2', type: 'SINGLE_CHOICE', prompt: 'Two', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], languageCode: 'en' },
    { questionVersionId: 'q-3', type: 'SINGLE_CHOICE', prompt: 'Three', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], languageCode: 'en' },
  ]}],
  scoringPolicy: { policyId: 'fixture-policy', version: '1', provenance: 'RESEARCH_ONLY', positiveMarksScaled: 100, wrongMarksScaled: 25, unattemptedMarksScaled: 0, scale: 100, excessAttemptPolicy: 'ALL_RESPONSES_COUNT', countsUnansweredAsAttempt: false },
  publication: { qaOnly: true },
} as const;

function submittedAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1', accountId: 'account-1', status: AttemptStatus.SUBMITTED, result: null,
    answers: [],
    answerEvents: [
      { sequence: 1, questionVersionId: 'q-1', selectedOptionIds: ['a'], occurredAt: new Date('2026-10-15T00:01:00Z'), idempotencyKey: 'a-1' },
      { sequence: 2, questionVersionId: 'q-2', selectedOptionIds: ['b'], occurredAt: new Date('2026-10-15T00:02:00Z'), idempotencyKey: 'a-2' },
    ],
    testForm: {
      snapshot: snapshot as unknown as Prisma.JsonValue, snapshotHash: snapshot.snapshotHash,
      questions: [
        { questionVersionId: 'q-1', sessionKey: 'session-1', sectionKey: 'part-a', snapshot: snapshot.sections[0].questions[0] as unknown as Prisma.JsonValue, questionVersion: { answerKeys: [{ correctAnswers: ['a'] }] } },
        { questionVersionId: 'q-2', sessionKey: 'session-1', sectionKey: 'part-a', snapshot: snapshot.sections[0].questions[1] as unknown as Prisma.JsonValue, questionVersion: { answerKeys: [{ correctAnswers: ['a'] }] } },
        { questionVersionId: 'q-3', sessionKey: 'session-1', sectionKey: 'part-a', snapshot: snapshot.sections[0].questions[2] as unknown as Prisma.JsonValue, questionVersion: { answerKeys: [{ correctAnswers: ['a'] }] } },
      ],
    },
    ...overrides,
  };
}

function databaseFor(attempt: unknown) {
  const tx = {
    attempt: { findFirst: jest.fn().mockResolvedValue(attempt) },
    scoreRun: { count: jest.fn().mockResolvedValue(0), create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'run-1', ...data })) },
    attemptResult: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'result-1', ...data })) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  return { tx, database: { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)), attemptResult: { findFirst: jest.fn() } } };
}

describe('ScoringService', () => {
  it('creates a deterministic score run and candidate-safe aggregate result', async () => {
    const { tx, database } = databaseFor(submittedAttempt());
    const result = await new ScoringService(database as unknown as PrismaService).score('account-1', 'attempt-1');
    expect(result).toMatchObject({ attemptId: 'attempt-1', status: ResultReleaseStatus.PENDING, totalMarksScaled: 75, maximumMarksScaled: 300, correct: 1, incorrect: 1, unattempted: 1, attempted: 2 });
    expect(result).not.toHaveProperty('answerKeys');
    expect(result).not.toHaveProperty('selectedOptionIds');
    expect(tx.scoreRun.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ policyId: 'fixture-policy', inputSnapshotHash: 'snapshot-hash' }) }));
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it('returns the existing result without creating a second score run', async () => {
    const existing = { attemptId: 'attempt-1', status: ResultReleaseStatus.PENDING, summary: { scoreRunReference: 'hash-1', totalMarksScaled: 100, maximumMarksScaled: 100, correct: 1, incorrect: 0, unattempted: 0, attempted: 1, dropped: 0, scale: 100, papers: [] }, scoreRun: { scoreRunHash: 'hash-1' } };
    const { tx, database } = databaseFor(submittedAttempt({ result: existing }));
    const result = await new ScoringService(database as unknown as PrismaService).score('account-1', 'attempt-1');
    expect(result.scoreRunReference).toBe('hash-1');
    expect(tx.scoreRun.create).not.toHaveBeenCalled();
  });

  it('fails closed when a section answer policy is absent', async () => {
    const invalid = submittedAttempt({ testForm: { ...submittedAttempt().testForm, snapshot: { ...snapshot, sessions: [{ ...snapshot.sessions[0], sections: [{ key: 'part-a' }] }] } } });
    const { database } = databaseFor(invalid);
    await expect(new ScoringService(database as unknown as PrismaService).score('account-1', 'attempt-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
