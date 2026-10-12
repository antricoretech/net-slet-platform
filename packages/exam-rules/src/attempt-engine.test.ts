import { describe, expect, it } from 'vitest';
import { activateSession, clearAnswer, createAttempt, initializeAttempt, markForReview, saveAnswer, submitAttempt, submitSession, type AttemptQuestionRule, type TrustedClock } from './attempt-engine';
import { scoreAttempt } from './scoring';
import type { TestFormSnapshot } from './contracts';

const form = { snapshotId: 'form-1' } as TestFormSnapshot;
const question: AttemptQuestionRule = { questionVersionId: 'q-1', sessionId: 'paper-1', policy: 'SINGLE_SELECT', optionIds: ['A', 'B'] };
const clock = (value = '2026-01-01T00:00:00.000Z'): TrustedClock => ({ now: () => new Date(value) });
function active() { return activateSession(initializeAttempt(createAttempt({ id: 'attempt-1', ownerId: 'student-1', form, sessions: [{ id: 'paper-1', sequence: 0, timingPolicy: 'CONTINUOUS', durationSeconds: 60 }], now: new Date('2026-01-01T00:00:00.000Z') }), 'student-1'), 'student-1', 'paper-1', clock()); }

describe('persistence-independent attempt engine', () => {
  it('creates, initializes and activates with a trusted deadline', () => { const attempt = active(); expect(attempt.status).toBe('IN_PROGRESS'); expect(attempt.sessions[0].deadlineAt).toBe('2026-01-01T00:01:00.000Z'); });
  it('enforces ownership, stale revisions and idempotent answer retries', () => {
    const attempt = active(); expect(() => saveAnswer(attempt, { actorId: 'other', question, selectedOptionIds: ['A'], idempotencyKey: 'k1', expectedRevision: attempt.revision, clock: clock() })).toThrow('ownership');
    const saved = saveAnswer(attempt, { actorId: 'student-1', question, selectedOptionIds: ['A'], idempotencyKey: 'k1', expectedRevision: attempt.revision, clock: clock() });
    expect(saveAnswer(saved, { actorId: 'student-1', question, selectedOptionIds: ['A'], idempotencyKey: 'k1', expectedRevision: attempt.revision, clock: clock() })).toBe(saved);
    expect(() => saveAnswer(saved, { actorId: 'student-1', question, selectedOptionIds: ['B'], idempotencyKey: 'k1', expectedRevision: saved.revision, clock: clock() })).toThrow('Idempotency key');
    expect(() => saveAnswer(saved, { actorId: 'student-1', question, selectedOptionIds: ['B'], idempotencyKey: 'k2', expectedRevision: attempt.revision, clock: clock() })).toThrow('Attempt has changed');
  });
  it('supports clear and review without exposing keys', () => { const attempt = active(); const saved = saveAnswer(attempt, { actorId: 'student-1', question, selectedOptionIds: ['A'], idempotencyKey: 'save', expectedRevision: attempt.revision, clock: clock() }); const reviewed = markForReview(saved, { actorId: 'student-1', question, marked: true, expectedRevision: saved.revision, clock: clock() }); const cleared = clearAnswer(reviewed, { actorId: 'student-1', question, idempotencyKey: 'clear', expectedRevision: reviewed.revision, clock: clock() }); expect(cleared.answers['q-1'].selectedOptionIds).toEqual([]); expect(cleared.answers['q-1'].markedForReview).toBe(true); expect(JSON.stringify(cleared)).not.toContain('correct'); });
  it('rejects invalid selections and expired writes', () => { const attempt = active(); expect(() => saveAnswer(attempt, { actorId: 'student-1', question, selectedOptionIds: ['A', 'B'], idempotencyKey: 'bad', expectedRevision: attempt.revision, clock: clock() })).toThrow('Single-select'); expect(() => saveAnswer(attempt, { actorId: 'student-1', question, selectedOptionIds: ['A'], idempotencyKey: 'late', expectedRevision: attempt.revision, clock: clock('2026-01-01T00:01:00.000Z') })).toThrow('deadline'); });
  it('requires sessions before final submission and makes finalization replay-safe', () => { const attempt = active(); expect(() => submitAttempt(attempt, { actorId: 'student-1', idempotencyKey: 'submit', clock: clock() })).toThrow('sessions'); const session = submitSession(attempt, { actorId: 'student-1', sessionId: 'paper-1', idempotencyKey: 'session-submit', clock: clock() }); const submitted = submitAttempt(session, { actorId: 'student-1', idempotencyKey: 'submit', clock: clock() }); expect(submitted.status).toBe('SUBMITTED'); expect(submitAttempt(submitted, { actorId: 'student-1', idempotencyKey: 'submit', clock: clock() })).toBe(submitted); });
});

describe('versioned integer scoring', () => {
  it('scores exact-match multi-select, penalties, dropped items and section ceilings reproducibly', () => {
    const questions = [{ questionVersionId: 'q1', sectionKey: 'A', policy: 'SINGLE_SELECT' as const, correctOptionIds: ['A'], marksCorrectScaled: 200, marksWrongScaled: 0 }, { questionVersionId: 'q2', sectionKey: 'A', policy: 'EXACT_MATCH' as const, correctOptionIds: ['A', 'C'], acceptedCorrectOptionSets: [['A', 'C']], marksCorrectScaled: 300, marksWrongScaled: 100 }, { questionVersionId: 'q3', sectionKey: 'A', policy: 'SINGLE_SELECT' as const, correctOptionIds: ['B'], marksCorrectScaled: 200, marksWrongScaled: 50 }, { questionVersionId: 'q4', sectionKey: 'A', policy: 'SINGLE_SELECT' as const, correctOptionIds: ['A'], marksCorrectScaled: 200, marksWrongScaled: 0, dropped: true }];
    const events = [{ sequence: 1, questionVersionId: 'q1', selectedOptionIds: ['A'], occurredAt: '2026-01-01T00:00:01Z', idempotencyKey: '1' }, { sequence: 2, questionVersionId: 'q2', selectedOptionIds: ['C', 'A'], occurredAt: '2026-01-01T00:00:02Z', idempotencyKey: '2' }, { sequence: 3, questionVersionId: 'q3', selectedOptionIds: ['A'], occurredAt: '2026-01-01T00:00:03Z', idempotencyKey: '3' }];
    const result = scoreAttempt({ questions, events, attemptCeilings: { A: 2 }, scale: 100 }); expect(result).toMatchObject({ scaledUnits: 500, attempted: 2, correct: 2, wrong: 0, dropped: 1 }); expect(scoreAttempt({ questions, events, attemptCeilings: { A: 2 }, scale: 100 })).toEqual(result);
  });
});
