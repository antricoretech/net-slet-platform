import { BadRequestException, ConflictException } from '@nestjs/common';
import { AttemptSessionStatus, AttemptStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttemptsService } from './attempts.service';

const snapshot = {
  snapshotId: 'form-1',
  snapshotHash: 'hash-1',
  generatedAt: '2026-10-15T00:00:00.000Z',
  seed: 'seed-1',
  blueprint: { examCode: 'UGC_NET', cycleCode: '2026-JUNE', subjectCode: 'CS', sections: [{ key: 'part-a', sequence: 0, questionVersionIds: ['question-1'] }] },
  sessions: [{ key: 'session-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds: 3600, sections: [{ key: 'part-a', answerPolicy: 'SINGLE_SELECT' }] }],
  sections: [{ key: 'part-a', sequence: 0, questions: [{ questionVersionId: 'question-1', type: 'SINGLE_CHOICE', prompt: 'Prompt', options: [{ id: 'option-a', label: 'A' }, { id: 'option-b', label: 'B' }], languageCode: 'en' }] }],
  publication: { qaOnly: true },
} as const;

function formRecord() {
  return { id: 'form-1', snapshot: snapshot as unknown as Prisma.JsonValue, snapshotHash: 'hash-1', status: 'PUBLISHED' as const };
}

function attemptRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1', accountId: 'account-1', testFormId: 'form-1', status: AttemptStatus.IN_PROGRESS, revision: 0,
    sessions: [{ id: 'session-1', key: 'session-1', sequence: 0, status: AttemptSessionStatus.IN_PROGRESS, timingPolicy: 'CONTINUOUS', durationSeconds: 3600, deadlineAt: new Date(Date.now() + 60_000), startedAt: new Date(), submittedAt: null, expiredAt: null }],
    answers: [],
    testForm: { ...formRecord(), questions: [{ id: 'form-question-1', questionVersionId: 'question-1', sessionKey: 'session-1', sectionKey: 'part-a', sequence: 0, snapshot: snapshot.sections[0].questions[0] as unknown as Prisma.JsonValue }] },
    ...overrides,
  };
}

describe('AttemptsService', () => {
  it('creates a durable attempt from a published candidate-safe snapshot', async () => {
    const created = { ...attemptRecord(), status: AttemptStatus.READY, sessions: [{ ...attemptRecord().sessions[0], status: AttemptSessionStatus.READY }] };
    const tx = {
      attempt: { create: jest.fn().mockResolvedValue(created) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const database = { testForm: { findFirst: jest.fn().mockResolvedValue({ ...formRecord(), questions: [] }) }, attempt: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const result = await new AttemptsService(database as unknown as PrismaService).start('account-1', { testFormId: 'form-1', idempotencyKey: 'start-1' });
    expect(result.attemptId).toBe('attempt-1');
    expect(result.form).not.toHaveProperty('answerKey');
    expect(tx.attempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accountId: 'account-1', status: AttemptStatus.READY }) }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attemptId: 'attempt-1' }) }));
  });

  it('acknowledges a valid answer only after the transaction writes the answer event', async () => {
    const attempt = attemptRecord();
    const tx = {
      attempt: { findFirst: jest.fn().mockResolvedValue(attempt), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptAnswerEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      attemptAnswer: { upsert: jest.fn().mockResolvedValue({ markedForReview: false }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const database = { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const result = await new AttemptsService(database as unknown as PrismaService).saveAnswer('account-1', 'attempt-1', 'question-1', { selectedOptionIds: ['option-a'], expectedRevision: 0, idempotencyKey: 'answer-1' });
    expect(result).toEqual({ accepted: true, attemptRevision: 1, answer: { questionVersionId: 'question-1', selectedOptionIds: ['option-a'], markedForReview: false } });
    expect(tx.attemptAnswer.upsert).toHaveBeenCalled();
    expect(tx.attemptAnswerEvent.create).toHaveBeenCalled();
  });

  it('rejects invalid options and stale revisions without acknowledging a mutation', async () => {
    const attempt = attemptRecord();
    const tx = { attempt: { findFirst: jest.fn().mockResolvedValue(attempt), updateMany: jest.fn() }, attemptSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, attemptAnswerEvent: { findUnique: jest.fn().mockResolvedValue(null) } };
    const database = { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const service = new AttemptsService(database as unknown as PrismaService);
    await expect(service.saveAnswer('account-1', 'attempt-1', 'question-1', { selectedOptionIds: ['secret-option'], expectedRevision: 0, idempotencyKey: 'answer-1' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saveAnswer('account-1', 'attempt-1', 'question-1', { selectedOptionIds: ['option-a'], expectedRevision: 1, idempotencyKey: 'answer-2' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.attempt.updateMany).not.toHaveBeenCalled();
  });

  it('persists review state and allows a review-only answer mutation', async () => {
    const attempt = attemptRecord();
    const tx = {
      attempt: { findFirst: jest.fn().mockResolvedValue(attempt), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptAnswerEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      attemptAnswer: { upsert: jest.fn().mockResolvedValue({ markedForReview: true }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const database = { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const service = new AttemptsService(database as unknown as PrismaService);
    const result = await service.saveAnswer('account-1', 'attempt-1', 'question-1', { selectedOptionIds: [], markedForReview: true, expectedRevision: 0, idempotencyKey: 'review-1' });
    expect(result.answer).toMatchObject({ selectedOptionIds: [], markedForReview: true });
    expect(tx.attemptAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ create: expect.objectContaining({ markedForReview: true }), update: expect.objectContaining({ markedForReview: true }) }) }));
  });

  it('commits a due-session expiry before rejecting a late answer without writing it', async () => {
    const attempt = attemptRecord({ sessions: [{ ...attemptRecord().sessions[0], deadlineAt: new Date(Date.now() - 1_000) }] });
    const tx = {
      attempt: { findFirst: jest.fn().mockResolvedValue(attempt), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptSession: { updateMany: jest.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }), findMany: jest.fn().mockResolvedValue([{ ...attempt.sessions[0], status: AttemptSessionStatus.EXPIRED }]) },
      attemptAnswerEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      attemptAnswer: { upsert: jest.fn() },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    let transactionCommitted = false;
    const database = { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => { const result = await callback(tx); transactionCommitted = true; return result; }) };
    await expect(new AttemptsService(database as unknown as PrismaService).saveAnswer('account-1', 'attempt-1', 'question-1', { selectedOptionIds: ['option-a'], expectedRevision: 0, idempotencyKey: 'late-answer' })).rejects.toBeInstanceOf(ConflictException);
    expect(transactionCommitted).toBe(true);
    expect(tx.attemptAnswer.upsert).not.toHaveBeenCalled();
    expect(tx.attemptAnswerEvent.create).not.toHaveBeenCalled();
    expect(tx.attempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: AttemptStatus.EXPIRED }) }));
  });

  it('commits an existing-deadline expiry before rejecting session reactivation', async () => {
    const attempt = attemptRecord({ sessions: [{ ...attemptRecord().sessions[0], deadlineAt: new Date(Date.now() - 1_000) }] });
    const tx = {
      attempt: { findFirst: jest.fn().mockResolvedValue(attempt), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      attemptSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn().mockResolvedValue([{ ...attempt.sessions[0], status: AttemptSessionStatus.EXPIRED }]) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    let transactionCommitted = false;
    const database = { $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => { const result = await callback(tx); transactionCommitted = true; return result; }) };
    await expect(new AttemptsService(database as unknown as PrismaService).activateSession('account-1', 'attempt-1', 'session-1')).rejects.toBeInstanceOf(ConflictException);
    expect(transactionCommitted).toBe(true);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });
});
