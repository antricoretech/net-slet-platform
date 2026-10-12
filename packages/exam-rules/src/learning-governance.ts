import type { MistakeOutcome } from './mistake-mine';

export type LearningEligibilityPurpose = 'MISTAKE_AGGREGATION' | 'REVIEW_RECOMMENDATION' | 'RETRIEVAL_SCHEDULING' | 'MASTERY_VERIFICATION';
export type ApprovalStatus = 'PUBLISHED' | 'APPROVED' | 'REVIEWED' | 'MISSING' | 'REVOKED' | 'EXPIRED';
export type LearningRole = 'STUDENT' | 'SME' | 'ADMIN' | 'RESEARCHER' | 'SYSTEM';
export type LearningAction = 'READ_OWN_PROGRESS' | 'EDIT_OWN_SELF_REPORT' | 'EXPORT_OWN_DATA' | 'DELETE_OWN_DATA' | 'READ_ADMIN_VIEW' | 'EXPORT_RESEARCH_DATA' | 'READ_CONTENT_REVIEW';

export interface EvidenceEligibilityInput {
  readonly learnerRef: string;
  readonly ownerRef: string;
  readonly sourceSessionId: string;
  readonly sourceEventId: string;
  readonly questionVersionId: string;
  readonly answerKeyRevision?: string;
  readonly outcome: MistakeOutcome;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly practiceSessionDistinct: boolean;
  readonly sourceEventDistinct: boolean;
  readonly topicIds: readonly string[];
  readonly syllabusUnitId?: string;
  readonly contentStatus: ApprovalStatus;
  readonly answerKeyStatus: ApprovalStatus;
  readonly explanationStatus: ApprovalStatus;
  readonly learnerOwnedContext: boolean;
  readonly correctnessAuthorized: boolean;
}

export interface EligibilityResult {
  readonly eligible: boolean;
  readonly purposes: Readonly<Record<LearningEligibilityPurpose, boolean>>;
  readonly reasons: readonly string[];
}

const validText = (value: string | undefined): boolean => Boolean(value?.trim());
const trustedBaseChecks = (input: EvidenceEligibilityInput): string[] => {
  const reasons: string[] = [];
  if (!validText(input.learnerRef) || input.learnerRef !== input.ownerRef) reasons.push('Learner ownership context is missing or mismatched.');
  if (!validText(input.sourceSessionId) || !input.practiceSessionDistinct) reasons.push('A distinct practice-session context is required.');
  if (!validText(input.sourceEventId) || !input.sourceEventDistinct) reasons.push('A distinct source event is required.');
  if (!validText(input.questionVersionId)) reasons.push('An immutable question-version reference is required.');
  if (!input.correctnessAuthorized) reasons.push('Correctness must come from an authorized server outcome.');
  if (Number.isNaN(Date.parse(input.occurredAt)) || Number.isNaN(Date.parse(input.recordedAt)) || Date.parse(input.occurredAt) > Date.parse(input.recordedAt)) reasons.push('Trusted event chronology is invalid.');
  if (!input.topicIds.length || input.topicIds.some((id) => !validText(id))) reasons.push('At least one valid syllabus/topic mapping is required.');
  if (!validText(input.syllabusUnitId)) reasons.push('A syllabus-unit mapping is required.');
  return reasons;
};

export function evaluateEvidenceEligibility(input: EvidenceEligibilityInput): EligibilityResult {
  const reasons = trustedBaseChecks(input);
  const approvedContent = input.contentStatus === 'PUBLISHED';
  const approvedKey = input.answerKeyStatus === 'APPROVED';
  const reviewedExplanation = input.explanationStatus === 'REVIEWED';
  if (!approvedContent) reasons.push('Question version is not currently published.');
  if (!approvedKey) reasons.push('Answer-key approval is missing, revoked or expired.');
  const base = reasons.length === 0;
  const purposes = { MISTAKE_AGGREGATION: base, REVIEW_RECOMMENDATION: base && reviewedExplanation, RETRIEVAL_SCHEDULING: base && reviewedExplanation && input.outcome !== 'UNATTEMPTED', MASTERY_VERIFICATION: base && reviewedExplanation && input.outcome !== 'UNATTEMPTED' };
  if (!reviewedExplanation) reasons.push('A reviewed explanation is required for recommendation, scheduling or mastery decisions.');
  return { eligible: base, purposes, reasons: [...new Set(reasons)] };
}

export interface PrivacyPolicy {
  readonly progressTracking: 'NECESSARY' | 'OPTIONAL';
  readonly confidenceTracking: 'NECESSARY' | 'OPTIONAL' | 'DISABLED';
  readonly selfReportedCauses: 'OPTIONAL' | 'DISABLED';
  readonly personalizedRemediation: 'OPTIONAL' | 'DISABLED';
  readonly analytics: 'AGGREGATED_MINIMIZED' | 'DISABLED';
  readonly retentionDays?: number;
}
export interface ConsentState { readonly learnerRef: string; readonly progress: boolean; readonly personalization: boolean; readonly analytics: boolean; readonly withdrawnAt?: string; }
export type PrivacyRequest = 'EXPORT' | 'CORRECT' | 'DELETE' | 'WITHDRAW_CONSENT';
export interface PrivacyDecision { readonly allowed: boolean; readonly reasons: readonly string[]; readonly requiresAudit: boolean; readonly invalidatesDerivedData: boolean; }

export function validatePrivacyPolicy(policy: PrivacyPolicy): string[] {
  const errors: string[] = [];
  if (policy.retentionDays !== undefined && (!Number.isSafeInteger(policy.retentionDays) || policy.retentionDays < 1)) errors.push('Retention duration must be a positive reviewed configuration value.');
  if (policy.progressTracking === 'OPTIONAL' && policy.personalizedRemediation === 'OPTIONAL') errors.push('Product policy must define whether necessary practice history is separate from optional profiling.');
  return errors;
}
export function decidePrivacyRequest(request: PrivacyRequest, policy: PrivacyPolicy, consent: ConsentState, actorRef: string): PrivacyDecision {
  const reasons: string[] = [];
  if (actorRef !== consent.learnerRef) reasons.push('Privacy request is not owned by the learner.');
  if (validatePrivacyPolicy(policy).length) reasons.push(...validatePrivacyPolicy(policy));
  if (request === 'WITHDRAW_CONSENT' && !consent.learnerRef) reasons.push('Learner consent subject is missing.');
  if (request === 'EXPORT' && !consent.progress) reasons.push('No exportable progress consent is active.');
  return { allowed: reasons.length === 0, reasons, requiresAudit: true, invalidatesDerivedData: request === 'DELETE' || request === 'WITHDRAW_CONSENT' };
}

export interface LearningAccessContext { readonly actorRef: string; readonly role: LearningRole; readonly targetLearnerRef?: string; readonly authenticated: boolean; readonly emailVerified: boolean; readonly consent?: ConsentState; }
export interface AuthorizationDecision { readonly allowed: boolean; readonly reasons: readonly string[]; readonly auditRequired: boolean; readonly minimized: boolean; }
export function authorizeLearningAction(action: LearningAction, context: LearningAccessContext): AuthorizationDecision {
  const reasons: string[] = [];
  if (!context.authenticated || !context.emailVerified) reasons.push('Authenticated, verified account is required.');
  const own = context.actorRef === context.targetLearnerRef;
  if (['READ_OWN_PROGRESS', 'EDIT_OWN_SELF_REPORT', 'EXPORT_OWN_DATA', 'DELETE_OWN_DATA'].includes(action) && !own) reasons.push('Learner-owned action cannot cross user boundaries.');
  if (action === 'READ_ADMIN_VIEW' && context.role !== 'ADMIN') reasons.push('Administrator role is required.');
  if (action === 'READ_CONTENT_REVIEW' && !['SME', 'ADMIN'].includes(context.role)) reasons.push('SME or administrator role is required.');
  if (action === 'EXPORT_RESEARCH_DATA' && !['RESEARCHER', 'ADMIN'].includes(context.role)) reasons.push('Researcher or administrator role is required.');
  if (['EXPORT_OWN_DATA', 'DELETE_OWN_DATA'] .includes(action) && !context.consent?.progress) reasons.push('Active progress consent is required for this operation.');
  return { allowed: reasons.length === 0, reasons, auditRequired: true, minimized: action === 'EXPORT_RESEARCH_DATA' };
}

export interface ContentReadinessInput { readonly questionVersionId: string; readonly contentStatus: ApprovalStatus; readonly answerKeyStatus: ApprovalStatus; readonly explanationStatus: ApprovalStatus; readonly translationStatus: ApprovalStatus; readonly rightsStatus: 'LICENSED' | 'PERMITTED' | 'MISSING' | 'EXPIRED'; readonly topicIds: readonly string[]; readonly conceptIds: readonly string[]; readonly fresh: boolean; readonly parallelGroupId?: string; }
export interface ContentReadinessResult { readonly eligible: boolean; readonly reasons: readonly string[]; readonly missing: readonly string[]; }
export function validateContentReadiness(input: ContentReadinessInput): ContentReadinessResult {
  const missing: string[] = [];
  if (input.contentStatus !== 'PUBLISHED') missing.push('published question version');
  if (input.answerKeyStatus !== 'APPROVED') missing.push('approved answer key');
  if (input.explanationStatus !== 'REVIEWED') missing.push('reviewed explanation');
  if (input.translationStatus !== 'APPROVED') missing.push('approved translation');
  if (!['LICENSED', 'PERMITTED'].includes(input.rightsStatus)) missing.push('licensed or permitted source material');
  if (!input.topicIds.length || input.topicIds.some((id) => !validText(id))) missing.push('valid syllabus/topic linkage');
  if (!input.conceptIds.length || input.conceptIds.some((id) => !validText(id))) missing.push('reviewed concept mapping');
  if (!input.questionVersionId.trim()) missing.push('question-version identity');
  return { eligible: missing.length === 0, reasons: missing.map((item) => `Missing or unapproved ${item}.`), missing };
}
export function assessFreshInventory(items: readonly ContentReadinessInput[], requiredCount: number, sourceQuestionIds: readonly string[]): { readonly sufficient: boolean; readonly availableCount: number; readonly reasons: readonly string[] } {
  const available = items.filter((item) => item.fresh && !sourceQuestionIds.includes(item.questionVersionId) && validateContentReadiness(item).eligible && item.parallelGroupId);
  const reasons = available.length < requiredCount ? [`Insufficient fresh approved parallel questions: need ${requiredCount}, found ${available.length}.`] : [];
  return { sufficient: reasons.length === 0, availableCount: available.length, reasons };
}

export interface AnalyticsRecord { readonly learnerRef: string; readonly topicIds: readonly string[]; readonly outcome: 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED'; readonly confidence?: string; readonly occurredAt: string; }
export function minimizeAnalyticsRecord(record: AnalyticsRecord, includeLearnerRef = false): Omit<AnalyticsRecord, 'learnerRef'> & { readonly learnerRef?: string } { return { ...(includeLearnerRef ? { learnerRef: record.learnerRef } : {}), topicIds: [...new Set(record.topicIds)].sort(), outcome: record.outcome, ...(record.confidence ? { confidence: record.confidence } : {}), occurredAt: record.occurredAt }; }

export interface L0CReadinessInput { readonly trustedHistory: boolean; readonly privacyApproved: boolean; readonly authorizationDesigned: boolean; readonly contentInventorySufficient: boolean; readonly freshParallelEligible: boolean; readonly retrievalProvenance: boolean; readonly schedulingApproved: boolean; readonly masteryThresholdsApproved: boolean; readonly correctionHandling: boolean; readonly accessibilityAndControl: boolean; }
export interface L0CReadinessResult { readonly status: 'READY' | 'CONDITIONAL' | 'BLOCKED'; readonly blockers: readonly string[]; readonly conditions: readonly string[]; }
export function evaluateL0CReadiness(input: L0CReadinessInput): L0CReadinessResult {
  const required: [keyof L0CReadinessInput, string][] = [['trustedHistory', 'Durable trusted learner history'], ['privacyApproved', 'Approved privacy and retention rules'], ['authorizationDesigned', 'Authorization design'], ['contentInventorySufficient', 'Sufficient approved content inventory'], ['freshParallelEligible', 'Fresh parallel-item eligibility'], ['retrievalProvenance', 'Retrieval-event provenance'], ['schedulingApproved', 'Approved scheduling configuration'], ['masteryThresholdsApproved', 'Approved mastery evidence thresholds'], ['correctionHandling', 'Data correction handling'], ['accessibilityAndControl', 'Accessibility and learner controls']];
  const blockers = required.filter(([key]) => !input[key]).map(([, label]) => label);
  return { status: blockers.length ? (blockers.length >= 3 ? 'BLOCKED' : 'CONDITIONAL') : 'READY', blockers, conditions: blockers.length ? ['Do not enable production spaced-revision scheduling.'] : [] };
}

export function evaluateMasteryEvidence(input: { readonly distinctQuestionCount: number; readonly correctCount: number; readonly distinctSessionCount: number; readonly minimumDistinctQuestions: number; readonly minimumDistinctSessions: number }): { readonly sufficient: boolean; readonly reasons: readonly string[] } {
  const reasons: string[] = [];
  if (input.distinctQuestionCount < input.minimumDistinctQuestions) reasons.push('Insufficient distinct question evidence.');
  if (input.distinctSessionCount < input.minimumDistinctSessions) reasons.push('Insufficient distinct practice-session evidence.');
  if (input.correctCount < input.minimumDistinctQuestions) reasons.push('Correct responses do not meet the configured evidence threshold.');
  return { sufficient: reasons.length === 0, reasons };
}
