import type { AnswerPolicy, SessionTimingPolicy } from './index';
import type { TestFormSnapshot } from './contracts';

export type AttemptLifecycle = 'CREATED' | 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type SessionLifecycle = 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export interface AttemptSessionDefinition { readonly id: string; readonly sequence: number; readonly timingPolicy: SessionTimingPolicy; readonly durationSeconds: number; readonly allowReturn?: boolean; readonly submitSeparately?: boolean; }
export interface AttemptSessionState { readonly id: string; readonly sequence: number; readonly status: SessionLifecycle; readonly timingPolicy: SessionTimingPolicy; readonly durationSeconds: number; readonly deadlineAt?: string; readonly startedAt?: string; readonly submittedAt?: string; }
export interface AnswerState { readonly questionVersionId: string; readonly selectedOptionIds: readonly string[]; readonly markedForReview: boolean; readonly updatedAt: string; readonly revision: number; }
export interface AnswerSelectionEvent { readonly sequence: number; readonly questionVersionId: string; readonly selectedOptionIds: readonly string[]; readonly occurredAt: string; readonly idempotencyKey: string; }
export interface AttemptAggregate { readonly id: string; readonly ownerId: string; readonly formId: string; readonly status: AttemptLifecycle; readonly revision: number; readonly createdAt: string; readonly sessions: readonly AttemptSessionState[]; readonly answers: Readonly<Record<string, AnswerState>>; readonly answerEvents: readonly AnswerSelectionEvent[]; readonly processedCommands: Readonly<Record<string, string>>; }
export interface AttemptQuestionRule { readonly questionVersionId: string; readonly sessionId: string; readonly policy: AnswerPolicy; readonly optionIds: readonly string[]; }
export interface TrustedClock { now(): Date; }
export class AttemptDomainError extends Error { readonly code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
export class AttemptConflictError extends AttemptDomainError {}

const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value as Record<string, unknown>).forEach((item) => freeze(item)); Object.freeze(value); } return value; };
const iso = (date: Date): string => date.toISOString();
const sessionStatus = (definition: AttemptSessionDefinition, index: number): SessionLifecycle => definition.timingPolicy === 'SEQUENTIAL_LOCKED' && index > 0 ? 'LOCKED' : 'READY';
const copy = (attempt: AttemptAggregate, changes: Partial<AttemptAggregate>): AttemptAggregate => freeze({ ...attempt, ...changes, revision: attempt.revision + 1 });
const sessionIndex = (attempt: AttemptAggregate, id: string): number => attempt.sessions.findIndex((session) => session.id === id);
const requireOwner = (attempt: AttemptAggregate, actorId: string): void => { if (attempt.ownerId !== actorId) throw new AttemptDomainError('ATTEMPT_OWNERSHIP_DENIED', 'Attempt ownership check failed'); };
const activeSession = (attempt: AttemptAggregate): AttemptSessionState => { const session = attempt.sessions.find((item) => item.status === 'IN_PROGRESS'); if (!session) throw new AttemptDomainError('NO_ACTIVE_SESSION', 'No active examination session'); return session; };
const ensureNotExpired = (attempt: AttemptAggregate, now: Date): void => { const session = attempt.sessions.find((item) => item.status === 'IN_PROGRESS'); if (session?.deadlineAt && now.getTime() >= Date.parse(session.deadlineAt)) throw new AttemptDomainError('SESSION_EXPIRED', 'Examination session deadline has passed'); };
const commandKey = (kind: string, idempotencyKey: string): string => `${kind}:${idempotencyKey}`;

export function createAttempt(input: { id: string; ownerId: string; form: TestFormSnapshot; sessions: readonly AttemptSessionDefinition[]; now: Date }): AttemptAggregate {
  if (!input.id || !input.ownerId || !input.form.snapshotId || input.sessions.length === 0) throw new AttemptDomainError('INVALID_ATTEMPT', 'Attempt identity, owner, form and sessions are required');
  const ordered = [...input.sessions].sort((a, b) => a.sequence - b.sequence);
  if (new Set(ordered.map((session) => session.id)).size !== ordered.length || ordered.some((session) => session.durationSeconds <= 0)) throw new AttemptDomainError('INVALID_SESSIONS', 'Session identities and durations must be valid');
  return freeze({ id: input.id, ownerId: input.ownerId, formId: input.form.snapshotId, status: 'CREATED', revision: 0, createdAt: iso(input.now), sessions: ordered.map((session, index) => ({ id: session.id, sequence: session.sequence, status: sessionStatus(session, index), timingPolicy: session.timingPolicy, durationSeconds: session.durationSeconds })), answers: {}, answerEvents: [], processedCommands: {} });
}

export function initializeAttempt(attempt: AttemptAggregate, actorId: string): AttemptAggregate { requireOwner(attempt, actorId); if (attempt.status !== 'CREATED') throw new AttemptDomainError('INVALID_TRANSITION', 'Only created attempts can be initialized'); return copy(attempt, { status: 'READY' }); }

export function activateSession(attempt: AttemptAggregate, actorId: string, sessionId: string, clock: TrustedClock): AttemptAggregate {
  requireOwner(attempt, actorId); const index = sessionIndex(attempt, sessionId); if (index < 0) throw new AttemptDomainError('SESSION_NOT_FOUND', 'Session not found'); const session = attempt.sessions[index];
  if (attempt.status !== 'READY' && attempt.status !== 'IN_PROGRESS') throw new AttemptDomainError('INVALID_TRANSITION', 'Attempt is not ready for session activation');
  if (session.status === 'LOCKED') { const prior = attempt.sessions.slice(0, index); if (prior.some((item) => item.status !== 'SUBMITTED')) throw new AttemptDomainError('SESSION_LOCKED', 'Previous session must be submitted first'); }
  if (session.status === 'SUBMITTED' || session.status === 'EXPIRED') throw new AttemptDomainError('SESSION_CLOSED', 'Session is already closed');
  const now = clock.now(); const nextSession = session.startedAt ? session : { ...session, status: 'IN_PROGRESS' as const, startedAt: iso(now), deadlineAt: iso(new Date(now.getTime() + session.durationSeconds * 1000)) };
  const sessions = attempt.sessions.map((item) => item.id === sessionId ? nextSession : item);
  return copy(attempt, { status: 'IN_PROGRESS', sessions });
}

function checkQuestion(attempt: AttemptAggregate, question: AttemptQuestionRule, actorId: string, clock: TrustedClock): AttemptSessionState {
  requireOwner(attempt, actorId); ensureNotExpired(attempt, clock.now()); const session = activeSession(attempt); if (session.id !== question.sessionId) throw new AttemptDomainError('SESSION_NOT_ACTIVE', 'Question belongs to a different session'); return session;
}
function validateSelection(question: AttemptQuestionRule, selection: readonly string[]): string[] {
  const unique = [...new Set(selection)]; if (unique.some((option) => !question.optionIds.includes(option))) throw new AttemptDomainError('INVALID_OPTION', 'Selected option is not available for this question');
  if (question.policy === 'SINGLE_SELECT' && unique.length > 1) throw new AttemptDomainError('INVALID_SELECTION', 'Single-select questions accept at most one option');
  return unique;
}
function idempotent(attempt: AttemptAggregate, kind: string, key: string, fingerprint: string): AttemptAggregate | undefined { const previous = attempt.processedCommands[commandKey(kind, key)]; if (previous === undefined) return undefined; if (previous !== fingerprint) throw new AttemptConflictError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different content'); return attempt; }

export function saveAnswer(attempt: AttemptAggregate, input: { actorId: string; question: AttemptQuestionRule; selectedOptionIds: readonly string[]; idempotencyKey: string; expectedRevision: number; clock: TrustedClock }): AttemptAggregate {
  requireOwner(attempt, input.actorId); const selection = validateSelection(input.question, input.selectedOptionIds); const fingerprint = JSON.stringify({ question: input.question.questionVersionId, selection }); const replay = idempotent(attempt, 'answer', input.idempotencyKey, fingerprint); if (replay) return replay;
  checkQuestion(attempt, input.question, input.actorId, input.clock); if (attempt.revision !== input.expectedRevision) throw new AttemptConflictError('STALE_ATTEMPT_REVISION', 'Attempt has changed; reload before retrying'); const now = iso(input.clock.now());
  const previous = attempt.answers[input.question.questionVersionId]; const answer: AnswerState = { questionVersionId: input.question.questionVersionId, selectedOptionIds: selection, markedForReview: previous?.markedForReview ?? false, updatedAt: now, revision: attempt.revision + 1 }; const event: AnswerSelectionEvent = { sequence: attempt.answerEvents.length + 1, questionVersionId: input.question.questionVersionId, selectedOptionIds: selection, occurredAt: now, idempotencyKey: input.idempotencyKey };
  return copy(attempt, { answers: { ...attempt.answers, [answer.questionVersionId]: answer }, answerEvents: [...attempt.answerEvents, event], processedCommands: { ...attempt.processedCommands, [commandKey('answer', input.idempotencyKey)]: fingerprint } });
}

export function clearAnswer(attempt: AttemptAggregate, input: { actorId: string; question: AttemptQuestionRule; idempotencyKey: string; expectedRevision: number; clock: TrustedClock }): AttemptAggregate { return saveAnswer(attempt, { ...input, selectedOptionIds: [] }); }
export function markForReview(attempt: AttemptAggregate, input: { actorId: string; question: AttemptQuestionRule; marked: boolean; expectedRevision: number; clock: TrustedClock }): AttemptAggregate { checkQuestion(attempt, input.question, input.actorId, input.clock); if (attempt.revision !== input.expectedRevision) throw new AttemptConflictError('STALE_ATTEMPT_REVISION', 'Attempt has changed; reload before retrying'); const previous = attempt.answers[input.question.questionVersionId]; if (!previous) throw new AttemptDomainError('ANSWER_NOT_FOUND', 'Select or clear an answer before changing review status'); const answer = { ...previous, markedForReview: input.marked, updatedAt: iso(input.clock.now()), revision: attempt.revision + 1 }; return copy(attempt, { answers: { ...attempt.answers, [answer.questionVersionId]: answer } }); }

export function expireSession(attempt: AttemptAggregate, actorId: string, sessionId: string, clock: TrustedClock): AttemptAggregate { requireOwner(attempt, actorId); const index = sessionIndex(attempt, sessionId); if (index < 0) throw new AttemptDomainError('SESSION_NOT_FOUND', 'Session not found'); const session = attempt.sessions[index]; if (session.status === 'EXPIRED') return attempt; if (!session.deadlineAt || clock.now().getTime() < Date.parse(session.deadlineAt)) throw new AttemptDomainError('DEADLINE_NOT_REACHED', 'Session deadline has not been reached'); const sessions = attempt.sessions.map((item) => item.id === sessionId ? { ...item, status: 'EXPIRED' as const } : item); return copy(attempt, { status: 'EXPIRED', sessions }); }
export function submitSession(attempt: AttemptAggregate, input: { actorId: string; sessionId: string; idempotencyKey: string; clock: TrustedClock }): AttemptAggregate { requireOwner(attempt, input.actorId); const replay = idempotent(attempt, 'session-submit', input.idempotencyKey, input.sessionId); if (replay) return replay; const index = sessionIndex(attempt, input.sessionId); if (index < 0) throw new AttemptDomainError('SESSION_NOT_FOUND', 'Session not found'); const session = attempt.sessions[index]; if (session.status === 'SUBMITTED') return attempt; if (session.status !== 'IN_PROGRESS') throw new AttemptDomainError('INVALID_TRANSITION', 'Only active sessions can be submitted'); ensureNotExpired(attempt, input.clock.now()); const next = attempt.sessions.map((item) => item.id === input.sessionId ? { ...item, status: 'SUBMITTED' as const, submittedAt: iso(input.clock.now()) } : item); return copy(attempt, { sessions: next, processedCommands: { ...attempt.processedCommands, [commandKey('session-submit', input.idempotencyKey)]: input.sessionId } }); }
export function submitAttempt(attempt: AttemptAggregate, input: { actorId: string; idempotencyKey: string; clock: TrustedClock }): AttemptAggregate { requireOwner(attempt, input.actorId); const replay = idempotent(attempt, 'attempt-submit', input.idempotencyKey, attempt.id); if (replay) return replay; if (attempt.status === 'SUBMITTED') return attempt; if (attempt.sessions.some((session) => session.status !== 'SUBMITTED')) throw new AttemptDomainError('SESSIONS_INCOMPLETE', 'All examination sessions must be submitted'); return copy(attempt, { status: 'SUBMITTED', processedCommands: { ...attempt.processedCommands, [commandKey('attempt-submit', input.idempotencyKey)]: attempt.id } }); }
