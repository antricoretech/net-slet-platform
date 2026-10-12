import type { AnswerPolicy } from './index';
import type { CandidateAttemptState, StudentQuestionProjection, TestFormSnapshot } from './contracts';

export interface StartAttemptRequest { readonly testFormId: string; readonly idempotencyKey: string; }
export interface StartAttemptResponse { readonly attemptId: string; readonly form: TestFormSnapshot; readonly state: CandidateAttemptState; readonly revision: number; }
export interface AttemptStateResponse { readonly attemptId: string; readonly ownerAccountId: string; readonly state: CandidateAttemptState; readonly revision: number; readonly activeSessionId?: string; }
export interface SaveAnswerRequest { readonly questionVersionId: string; readonly selectedOptionIds: readonly string[]; readonly expectedAttemptRevision: number; readonly idempotencyKey: string; }
export interface SaveAnswerResponse { readonly accepted: true; readonly attemptRevision: number; readonly answer: { readonly questionVersionId: string; readonly selectedOptionIds: readonly string[]; readonly markedForReview: boolean }; }
export interface SubmitSessionRequest { readonly expectedAttemptRevision: number; readonly idempotencyKey: string; }
export interface SubmitAttemptRequest { readonly expectedAttemptRevision: number; readonly idempotencyKey: string; }
export interface ResultResponse { readonly attemptId: string; readonly status: 'PENDING' | 'PUBLISHED'; readonly score?: { readonly scaledUnits: number; readonly scale: number }; }
export type AttemptApiErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'EXPIRED' | 'INVALID_REQUEST' | 'NOT_READY';
export interface AttemptApiError { readonly code: AttemptApiErrorCode; readonly message: string; readonly retryable: boolean; readonly currentRevision?: number; }
export interface CandidateAttemptQuestion { readonly question: StudentQuestionProjection; readonly policy: AnswerPolicy; }

/** Proposed routes; intentionally not registered until durable persistence is approved. */
export const ATTEMPT_API_ROUTES = { create: 'POST /attempts', state: 'GET /attempts/:id/state', answer: 'PUT /attempts/:id/answers/:questionId', sessionSubmit: 'POST /attempts/:id/sessions/:sessionId/submit', submit: 'POST /attempts/:id/submit', result: 'GET /attempts/:id/result' } as const;
