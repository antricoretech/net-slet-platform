import type { AnswerSaveRequest, CandidateAttemptState, StartAttemptRequest, StartAttemptResponse, TestFormSnapshot } from '@net-slet/exam-rules';

/** Sprint 3C boundary: implementations must use a server-authoritative attempt API. */
export interface CbtAttemptAdapter {
  startAttempt(request: StartAttemptRequest): Promise<StartAttemptResponse>;
  getAttemptState(attemptId: string): Promise<CandidateAttemptState>;
  saveAnswer(request: AnswerSaveRequest): Promise<{ accepted: boolean; revision: number }>;
  submit(attemptId: string): Promise<{ accepted: boolean }>;
  getForm(attemptId: string): Promise<TestFormSnapshot>;
}

export const previewAttemptAdapter: CbtAttemptAdapter | null = null;
