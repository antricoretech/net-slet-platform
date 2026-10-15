import type { QuestionType } from './contracts';
import { validatePublishedQuestionReadiness, type PublishedQuestionReadinessInput } from './examdna';

export type QualitySeverity = 'ERROR' | 'WARNING' | 'INFO';
export interface QualityIssue { readonly code: string; readonly severity: QualitySeverity; readonly fieldPath: string; readonly message: string; readonly remediation: string; readonly references?: readonly string[]; }
export interface QualityResult { readonly eligible: boolean; readonly issues: readonly QualityIssue[]; }
const issue = (code: string, fieldPath: string, message: string, remediation: string, severity: QualitySeverity = 'ERROR', references?: readonly string[]): QualityIssue => ({ code, severity, fieldPath, message, remediation, references });
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const validDate = (value?: string) => !!value && !Number.isNaN(Date.parse(value));

export interface AnswerTrustInput {
  readonly answerKeyVersionId?: string; readonly answerKeyStatus: 'APPROVED' | 'MISSING' | 'REVOKED';
  readonly explanationVersionId?: string; readonly explanationStatus: 'REVIEWED' | 'MISSING' | 'REVOKED';
  readonly correctRationaleReviewed: boolean; readonly distractorRationalesReviewed: boolean;
  readonly conceptRefs: readonly string[]; readonly reviewerRef?: string; readonly reviewedAt?: string;
  readonly citationStatus: 'REVIEWED' | 'UNAVAILABLE' | 'MISSING'; readonly sourceAttribution?: string;
  readonly answerKeyVersionRef?: string; readonly explanationAnswerKeyVersionRef?: string; readonly aiGeneratedEvidence?: boolean;
}
export function evaluateAnswerTrust(input?: AnswerTrustInput): QualityResult {
  const issues: QualityIssue[] = [];
  if (!input) return { eligible: false, issues: [issue('ANSWER_TRUST_MISSING', 'explanation', 'Answer-trust evidence is missing.', 'Provide reviewed rationale and provenance evidence.')] };
  if (input.answerKeyStatus !== 'APPROVED' || !input.answerKeyVersionId?.trim()) issues.push(issue('ANSWER_KEY_NOT_APPROVED', 'explanation.answerKeyStatus', 'An approved, versioned answer key is required.', 'Review and version the answer key.'));
  if (input.explanationStatus !== 'REVIEWED' || !input.explanationVersionId?.trim()) issues.push(issue('EXPLANATION_NOT_REVIEWED', 'explanation.explanationStatus', 'A reviewed explanation version is required.', 'Complete SME review of the explanation.'));
  if (!input.correctRationaleReviewed) issues.push(issue('CORRECT_RATIONALE_UNREVIEWED', 'explanation.correctRationaleReviewed', 'The correct-answer rationale is not reviewed.', 'Obtain reviewer confirmation.'));
  if (!input.distractorRationalesReviewed) issues.push(issue('DISTRACTOR_RATIONALES_UNREVIEWED', 'explanation.distractorRationalesReviewed', 'Distractor rationales are not reviewed.', 'Review each distractor rationale or mark it unavailable under policy.'));
  if (!input.conceptRefs.length) issues.push(issue('CONCEPT_REFERENCE_MISSING', 'explanation.conceptRefs', 'At least one concept reference is required.', 'Map the explanation to an approved concept or syllabus reference.'));
  if (!input.reviewerRef?.trim() || !validDate(input.reviewedAt)) issues.push(issue('EXPLANATION_REVIEW_METADATA_MISSING', 'explanation.reviewedAt', 'Reviewer and review timestamp are required.', 'Record authenticated SME review metadata.'));
  if (input.citationStatus === 'MISSING' || (input.citationStatus === 'REVIEWED' && !input.sourceAttribution?.trim())) issues.push(issue('SOURCE_ATTRIBUTION_MISSING', 'explanation.sourceAttribution', 'Source attribution is missing.', 'Add a citation or explicitly record that no source is available.'));
  if (input.answerKeyVersionRef !== input.explanationAnswerKeyVersionRef) issues.push(issue('EXPLANATION_KEY_MISMATCH', 'explanation.explanationAnswerKeyVersionRef', 'Explanation does not reference the current answer-key version.', 'Regenerate and review the explanation against the current key.'));
  if (input.aiGeneratedEvidence) issues.push(issue('AI_EVIDENCE_NOT_VERIFIED', 'explanation.aiGeneratedEvidence', 'AI-generated evidence cannot satisfy verified answer-trust requirements.', 'Replace with human-reviewed, attributable evidence.'));
  return { eligible: issues.length === 0, issues };
}

export type RightsBasis = 'ORIGINAL_INTERNAL' | 'LICENSED_THIRD_PARTY' | 'OFFICIAL_PERMISSION' | 'PUBLIC_DOMAIN' | 'OPEN_LICENSE' | 'RESEARCH_ONLY' | 'RIGHTS_UNKNOWN' | 'RESTRICTED' | 'DISPUTED';
export interface ContentRights { readonly basis: RightsBasis; readonly status: 'REVIEWED' | 'MISSING' | 'EXPIRED' | 'REVOKED'; readonly permits: { readonly research: boolean; readonly studentPractice: boolean; readonly strictMock: boolean; readonly translation: boolean; readonly adaptation: boolean; readonly download: boolean; readonly redistribution: boolean }; readonly reference?: string; readonly expiresAt?: string; }
export type RightsUse = keyof ContentRights['permits'];
export function evaluateRights(rights: ContentRights | undefined, use: RightsUse): QualityResult {
  const issues: QualityIssue[] = [];
  if (!rights) return { eligible: false, issues: [issue('RIGHTS_EVIDENCE_MISSING', 'rights', 'Rights evidence is missing.', 'Record the legal basis and permitted use before publication.')] };
  if (rights.status !== 'REVIEWED') issues.push(issue('RIGHTS_NOT_REVIEWED', 'rights.status', 'Rights status is not reviewed and current.', 'Obtain rights review or exclude the item.'));
  if (['RESEARCH_ONLY', 'RIGHTS_UNKNOWN', 'RESTRICTED', 'DISPUTED'].includes(rights.basis)) issues.push(issue('RIGHTS_BASIS_RESTRICTED', 'rights.basis', `Rights basis ${rights.basis} is not publishable.`, 'Use only for the explicitly permitted research use or obtain clearance.'));
  if (!rights.permits[use]) issues.push(issue('RIGHTS_USE_NOT_PERMITTED', `rights.permits.${use}`, `Rights do not permit ${use}.`, 'Obtain permission for this use or exclude the item.'));
  if (!rights.reference?.trim()) issues.push(issue('RIGHTS_REFERENCE_MISSING', 'rights.reference', 'Rights reference is missing.', 'Record licence, permission or ownership evidence.'));
  if (rights.expiresAt && Date.parse(rights.expiresAt) <= Date.now()) issues.push(issue('RIGHTS_EXPIRED', 'rights.expiresAt', 'Rights evidence has expired.', 'Renew or withdraw the affected content.'));
  return { eligible: issues.length === 0, issues };
}

export interface TranslationQA { readonly sourceQuestionVersionId: string; readonly targetQuestionVersionId: string; readonly languageCode: string; readonly status: 'APPROVED' | 'MISSING' | 'REVIEWED' | 'REVOKED'; readonly sourceOptionCount: number; readonly targetOptionCount: number; readonly answerKeyConsistent: boolean; readonly mathTokensPreserved: boolean; readonly terminologyReviewed: boolean; readonly reviewerRef?: string; readonly reviewedAt?: string; }
export function evaluateTranslationQA(translation?: TranslationQA): QualityResult {
  const issues: QualityIssue[] = [];
  if (!translation) return { eligible: false, issues: [issue('TRANSLATION_MISSING', 'translation', 'Required language evidence is missing.', 'Provide an approved translation record.')] };
  if (translation.status !== 'APPROVED') issues.push(issue('TRANSLATION_NOT_APPROVED', 'translation.status', 'Translation is not approved.', 'Complete human translation review.'));
  if (translation.sourceOptionCount !== translation.targetOptionCount) issues.push(issue('TRANSLATION_OPTION_COUNT_MISMATCH', 'translation.targetOptionCount', 'Source and target option counts differ.', 'Correct the translation structure.'));
  if (!translation.answerKeyConsistent) issues.push(issue('TRANSLATION_KEY_MISMATCH', 'translation.answerKeyConsistent', 'Translation answer-key mapping is inconsistent.', 'Reconcile the target key and re-review.'));
  if (!translation.mathTokensPreserved) issues.push(issue('TRANSLATION_MATH_TOKENS_CHANGED', 'translation.mathTokensPreserved', 'Math tokens were not preserved.', 'Reconcile LaTeX/math tokens before approval.'));
  if (!translation.terminologyReviewed || !translation.reviewerRef?.trim() || !validDate(translation.reviewedAt)) issues.push(issue('TRANSLATION_REVIEW_METADATA_MISSING', 'translation.reviewedAt', 'Terminology and human review metadata are incomplete.', 'Complete language SME review.'));
  return { eligible: issues.length === 0, issues };
}

export interface ChallengeState { readonly materialUnresolved: boolean; readonly disputedAnswerKey: boolean; readonly correctionUnreviewed: boolean; readonly deprecated: boolean; readonly quarantined: boolean; readonly requiresRescoreReview: boolean; }
export interface QuestionQualityInput extends PublishedQuestionReadinessInput {
  readonly type: QuestionType; readonly prompt?: string; readonly options?: readonly { readonly id: string; readonly label: string }[]; readonly correctOptionIds?: readonly string[];
  readonly syllabusUnitId?: string; readonly topicIds?: readonly string[]; readonly difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  readonly answerKeyVersionId?: string; readonly answerKeyVersionRef?: string; readonly explanation?: AnswerTrustInput; readonly rights?: ContentRights; readonly translation?: TranslationQA;
  readonly sourceEventId?: string; readonly canonicalText?: string; readonly difficultyEvidence?: 'REVIEWED' | 'UNAVAILABLE'; readonly challenge?: ChallengeState;
  readonly assertion?: string; readonly reason?: string; readonly pairs?: readonly { readonly leftId: string; readonly rightId: string }[]; readonly orderedItemIds?: readonly string[]; readonly groupComplete?: boolean; readonly latex?: string; readonly table?: readonly (readonly string[])[];
}
export function validateQuestionQuality(input: QuestionQualityInput, use: RightsUse = 'studentPractice'): QualityResult {
  const issues: QualityIssue[] = [];
  const base = validatePublishedQuestionReadiness(input); base.reasons.forEach((message) => issues.push(issue('PUBLICATION_READINESS', 'question', message, 'Satisfy the existing publication-readiness contract.')));
  if (!input.prompt?.trim()) issues.push(issue('PROMPT_MISSING', 'prompt', 'Question prompt is missing.', 'Provide immutable question text.'));
  const options = input.options ?? []; const correct = input.correctOptionIds ?? [];
  if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'ASSERTION_REASON', 'MATHEMATICAL'].includes(input.type)) {
    if (options.length < 2 || options.some((option) => !option.id.trim() || !option.label.trim()) || !unique(options.map((option) => option.id))) issues.push(issue('OPTIONS_INVALID', 'options', 'Options must be non-empty, unique and contain at least two entries.', 'Repair the option set.'));
    if (!correct.length || !unique(correct) || correct.some((id) => !options.some((option) => option.id === id))) issues.push(issue('ANSWER_KEY_INCOMPLETE', 'correctOptionIds', 'Answer key must contain valid option identifiers.', 'Review and version the complete answer key.'));
    if (input.type === 'SINGLE_CHOICE' && correct.length !== 1) issues.push(issue('SINGLE_ANSWER_CARDINALITY', 'correctOptionIds', 'Single-choice questions require exactly one answer.', 'Select exactly one correct option.'));
  }
  if (input.type === 'ASSERTION_REASON' && (!input.assertion?.trim() || !input.reason?.trim())) issues.push(issue('ASSERTION_REASON_INCOMPLETE', 'assertion', 'Assertion and reason text are required.', 'Provide both components.'));
  if (input.type === 'MATCHING') { const pairs = input.pairs ?? []; if (!pairs.length || !unique(pairs.map((pair) => pair.leftId)) || !unique(pairs.map((pair) => pair.rightId))) issues.push(issue('MATCHING_INVALID', 'pairs', 'Matching pairs must be complete and unique.', 'Provide a one-to-one mapping.')); }
  if (input.type === 'ORDERING' && (!input.orderedItemIds?.length || !unique(input.orderedItemIds))) issues.push(issue('ORDERING_INVALID', 'orderedItemIds', 'Ordering items must be complete and unique.', 'Provide the complete canonical order.'));
  if (['READING_COMPREHENSION', 'DATA_INTERPRETATION'].includes(input.type) && (!input.groupId || input.groupSequence === undefined || input.groupComplete === false)) issues.push(issue('GROUP_INCOMPLETE', 'groupId', 'Grouped questions require group identity, sequence and completeness.', 'Complete and review the entire group before publication.'));
  if (input.type === 'MATHEMATICAL' && (!input.latex?.trim() || (input.latex.match(/\\/g)?.length ?? 0) % 2 !== 0)) issues.push(issue('LATEX_INVALID', 'latex', 'Mathematical content lacks a parseable LaTeX representation.', 'Correct delimiters and run rendering QA.'));
  if (input.table && (!input.table.length || input.table.some((row) => row.length !== input.table![0].length))) issues.push(issue('TABLE_NOT_RECTANGULAR', 'table', 'Table content must be non-empty and rectangular.', 'Repair the table structure.'));
  if (!input.answerKeyVersionId?.trim()) issues.push(issue('ANSWER_KEY_VERSION_MISSING', 'answerKeyVersionId', 'Immutable answer-key version is required.', 'Create a versioned answer key.'));
  if (input.difficultyEvidence !== 'REVIEWED') issues.push(issue('DIFFICULTY_EVIDENCE_MISSING', 'difficultyEvidence', 'Reviewed difficulty evidence is required.', 'Record reviewer-backed difficulty evidence.'));
  const trust = evaluateAnswerTrust(input.explanation); issues.push(...trust.issues); const rights = evaluateRights(input.rights, use); issues.push(...rights.issues); const translation = evaluateTranslationQA(input.translation); issues.push(...translation.issues);
  if (!input.sourceEventId?.trim() || !input.canonicalText?.trim()) issues.push(issue('PROVENANCE_IDENTITY_MISSING', 'sourceEventId', 'Source event and canonical fingerprint input are required.', 'Record immutable provenance metadata.'));
  if (input.challenge && Object.values(input.challenge).some(Boolean)) issues.push(issue('CHALLENGE_OR_QUARANTINE_BLOCKS', 'challenge', 'Unresolved challenge, quarantine or rescore review blocks new publication.', 'Resolve the content governance state first.'));
  return { eligible: issues.length === 0, issues };
}

export interface InventoryScope { readonly examinationCode: string; readonly cycleCode: string; readonly subjectCode: string; readonly sectionKey?: string; readonly languageCode?: string; readonly type?: QuestionType; readonly difficulty?: string; }
export interface InventoryRequirement { readonly requirementId: string; readonly label: string; readonly count: number; readonly scope: InventoryScope; readonly sourceReference?: string; }
export interface InventoryRecord extends QuestionQualityInput { readonly freshForForm?: boolean; readonly exposedFormIds?: readonly string[]; readonly practiceOnly?: boolean; }
export interface CoverageGap { readonly requirementId: string; readonly label: string; readonly required: number; readonly available: number; readonly missing: number; readonly denominatorState: 'KNOWN' | 'MISSING_DATA'; readonly references?: readonly string[]; }
export interface InventoryReport { readonly scope: InventoryScope; readonly counts: Readonly<Record<string, number>>; readonly gaps: readonly CoverageGap[]; readonly duplicateWarnings: readonly string[]; readonly deterministic: true; }
export function evaluateContentInventory(scope: InventoryScope, records: readonly InventoryRecord[], requirements: readonly InventoryRequirement[]): InventoryReport {
  const scoped = records.filter((record) => record.examinationCode === scope.examinationCode && record.cycleCode === scope.cycleCode && record.subjectCode === scope.subjectCode && (!scope.sectionKey || record.sectionKey === scope.sectionKey) && (!scope.languageCode || record.languageCode === scope.languageCode) && (!scope.type || record.type === scope.type));
  const results = scoped.map((record) => validateQuestionQuality(record)); const publishedEligible = results.filter((result) => result.eligible).length;
  const counts = { total: scoped.length, structurallyValid: results.filter((result) => !result.issues.some((item) => item.code.includes('INVALID') || item.code.includes('INCOMPLETE'))).length, reviewed: results.filter((result) => result.eligible || !result.issues.some((item) => item.code.includes('REVIEW'))).length, publishedEligible, rightsCleared: scoped.filter((record) => evaluateRights(record.rights, 'studentPractice').eligible).length, languageVariants: new Set(scoped.map((record) => record.languageCode)).size, fresh: scoped.filter((record) => record.freshForForm).length, completeGroups: scoped.filter((record) => record.groupId && record.groupComplete).length, strictMockEligible: scoped.filter((record) => validateQuestionQuality(record, 'strictMock').eligible).length, practiceOnly: scoped.filter((record) => record.practiceOnly).length, excluded: scoped.length - publishedEligible, quarantined: scoped.filter((record) => record.challenge && Object.values(record.challenge).some(Boolean)).length };
  const gaps = requirements.map((requirement) => { const matching = records.filter((record) => record.examinationCode === requirement.scope.examinationCode && record.cycleCode === requirement.scope.cycleCode && record.subjectCode === requirement.scope.subjectCode && (!requirement.scope.sectionKey || record.sectionKey === requirement.scope.sectionKey) && validateQuestionQuality(record).eligible); const available = matching.length; return { requirementId: requirement.requirementId, label: requirement.label, required: requirement.count, available, missing: Math.max(0, requirement.count - available), denominatorState: 'KNOWN' as const, references: requirement.sourceReference ? [requirement.sourceReference] : undefined }; }).filter((gap) => gap.missing > 0);
  const duplicateWarnings = detectContentDuplicates(scoped).map((item) => `${item.kind}: ${item.key}`); return { scope, counts, gaps, duplicateWarnings, deterministic: true };
}
export interface DuplicateFinding { readonly kind: 'EXACT_VERSION' | 'SOURCE_EVENT' | 'CANONICAL_FINGERPRINT' | 'GROUP_REUSE'; readonly key: string; readonly questionVersionIds: readonly string[]; }
export function detectContentDuplicates(records: readonly InventoryRecord[]): readonly DuplicateFinding[] { const findings: DuplicateFinding[] = []; const collect = (kind: DuplicateFinding['kind'], values: readonly (string | undefined)[]) => { const groups = new Map<string, string[]>(); values.forEach((key, index) => { if (key) groups.set(key, [...(groups.get(key) ?? []), records[index].questionVersionId]); }); groups.forEach((ids, key) => { if (ids.length > 1) findings.push({ kind, key, questionVersionIds: ids }); }); }; collect('EXACT_VERSION', records.map((record) => record.questionVersionId)); collect('SOURCE_EVENT', records.map((record) => record.sourceEventId)); collect('CANONICAL_FINGERPRINT', records.map((record) => record.canonicalText)); collect('GROUP_REUSE', records.map((record) => record.groupId)); return findings; }

export interface AuditFixture { readonly fixtureKind: 'SYNTHETIC_RESEARCH'; readonly schemaVersion: string; readonly scope: InventoryScope; readonly records: readonly InventoryRecord[]; readonly requirements: readonly InventoryRequirement[]; }
export interface AuditReport { readonly valid: boolean; readonly machine: InventoryReport | null; readonly errors: readonly QualityIssue[]; readonly humanSummary: string; readonly sideEffects: false; }
export function auditContentFixtureJson(json: string, maxBytes = 2_000_000): AuditReport { if (Buffer.byteLength(json, 'utf8') > maxBytes) return { valid: false, machine: null, errors: [issue('FIXTURE_TOO_LARGE', '$', 'Fixture exceeds the development audit size limit.', 'Use a smaller fixture package.')], humanSummary: 'Fixture rejected: size limit exceeded.', sideEffects: false }; try { const value = JSON.parse(json) as Partial<AuditFixture>; if (value.fixtureKind !== 'SYNTHETIC_RESEARCH' || typeof value.schemaVersion !== 'string' || !value.scope || !Array.isArray(value.records) || !Array.isArray(value.requirements)) throw new Error('Fixture must be a versioned synthetic research package.'); const machine = evaluateContentInventory(value.scope, value.records, value.requirements); return { valid: true, machine, errors: [], humanSummary: `Synthetic content audit: ${machine.counts.publishedEligible} eligible of ${machine.counts.total} scoped records; ${machine.gaps.length} coverage gaps.`, sideEffects: false }; } catch (error) { return { valid: false, machine: null, errors: [issue('FIXTURE_INVALID', '$', error instanceof Error ? error.message : 'Fixture JSON is invalid.', 'Provide a valid synthetic fixture package.')], humanSummary: 'Fixture rejected: invalid schema or JSON.', sideEffects: false }; }
}
