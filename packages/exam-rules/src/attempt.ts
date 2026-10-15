export type ExamState = 'CREATED' | 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type ExamTransition = 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
const transitions: Record<ExamState, readonly ExamTransition[]> = { CREATED: ['READY'], READY: ['IN_PROGRESS', 'EXPIRED'], IN_PROGRESS: ['SUBMITTED', 'EXPIRED'], SUBMITTED: [], EXPIRED: [] };
export class InvalidExamTransitionError extends Error {}
export function transitionExam(state: ExamState, target: ExamTransition, now: Date, deadlineAt?: Date): ExamState { if (!transitions[state].includes(target)) throw new InvalidExamTransitionError(`Cannot transition ${state} to ${target}`); if (target === 'SUBMITTED' && deadlineAt && now.getTime() > deadlineAt.getTime()) throw new InvalidExamTransitionError('Expired attempts cannot be submitted'); return target; }
export function remainingSeconds(deadlineAt: Date, serverNow: Date): number { return Math.max(0, Math.ceil((deadlineAt.getTime() - serverNow.getTime()) / 1000)); }
