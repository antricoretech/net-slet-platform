export type ResultReleaseState = 'PENDING' | 'PUBLISHED';

export interface ResultDisclosurePolicy {
  aggregateScore: boolean;
  questionCorrectness: boolean;
  answerKeys: boolean;
  explanations: boolean;
  learningEvidence: boolean;
}

/** Candidate-safe disclosure policy: aggregate marks are allowed while details remain withheld. */
export function resultDisclosurePolicy(status: ResultReleaseState): ResultDisclosurePolicy {
  return status === 'PUBLISHED'
    ? { aggregateScore: true, questionCorrectness: true, answerKeys: false, explanations: true, learningEvidence: true }
    : { aggregateScore: true, questionCorrectness: false, answerKeys: false, explanations: false, learningEvidence: false };
}

export function canRescorePinnedForm(originalAnswerKeyVersionId: string, pinnedAnswerKeyVersionId: string, correctionOriginalAnswerKeyVersionId: string): boolean {
  return Boolean(originalAnswerKeyVersionId && pinnedAnswerKeyVersionId && originalAnswerKeyVersionId === pinnedAnswerKeyVersionId && pinnedAnswerKeyVersionId === correctionOriginalAnswerKeyVersionId);
}
