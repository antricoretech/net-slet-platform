import { PatternStatus, PublicationStatus, QuestionVersionStatus, RightsStatus } from '../generated/prisma/client';

export const CLEARED_RIGHTS: RightsStatus[] = [RightsStatus.OWNED, RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED, RightsStatus.PUBLIC_DOMAIN];

export type QuestionEligibilityEvidence = {
  status: QuestionVersionStatus | string;
  publicationStatus?: PublicationStatus | string;
  answerKeyCount: number;
  explanationCount: number;
  mappingCount: number;
  provenanceRights: readonly (RightsStatus | string)[];
  approvedReviewerIds: readonly string[];
};

export type FormEligibilityEvidence = {
  status: string;
  patternStatus: string;
  questionCount: number;
  answerKeyCount: number;
  snapshotPublication: Record<string, unknown>;
};

const hasClearedRights = (rights: readonly (RightsStatus | string)[]) => rights.length > 0 && rights.every((right) => (CLEARED_RIGHTS as readonly string[]).includes(right));

export const HISTORICAL_PYQ_DISCOVERY_USE = 'PYQ_DISCOVERY';
export type HistoricalRightsScope = { allowedUses: unknown[]; languages: unknown[]; geography?: unknown; expiresAt?: unknown };
export type HistoricalMetadataEligibilityEvidence = {
  verificationStatus: string;
  recordStatus: string;
  publicationEligible: boolean;
  rightsStatus: RightsStatus | string;
  rightsScope: unknown;
  rightsExpiresAt?: Date | null;
  revokedAt?: Date | null;
  requestedLanguage?: string;
  examinationFamilyMatches: boolean;
  subjectMatches: boolean;
  question: QuestionEligibilityEvidence;
  requiredUse?: string;
};

function normalizedScope(value: unknown): HistoricalRightsScope | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const scope = value as HistoricalRightsScope;
  return Array.isArray(scope.allowedUses) && Array.isArray(scope.languages) ? scope : undefined;
}

export function evaluateHistoricalMetadataEligibility(evidence: HistoricalMetadataEligibilityEvidence, now = new Date()) {
  const reasons = [...evaluateQuestionEligibility(evidence.question).reasons];
  if (evidence.verificationStatus !== 'VERIFIED') reasons.push('METADATA_NOT_VERIFIED');
  if (!['IMPORTED', 'VALIDATED', 'VERIFIED'].includes(evidence.recordStatus)) reasons.push('METADATA_RECORD_NOT_ACTIVE');
  if (!evidence.publicationEligible) reasons.push('METADATA_PUBLICATION_NOT_ELIGIBLE');
  if (!hasClearedRights([evidence.rightsStatus])) reasons.push('METADATA_RIGHTS_NOT_CLEARED');
  if (evidence.revokedAt && evidence.revokedAt <= now) reasons.push('METADATA_RIGHTS_REVOKED');
  if (evidence.rightsExpiresAt && evidence.rightsExpiresAt <= now) reasons.push('METADATA_RIGHTS_EXPIRED');
  if (!evidence.examinationFamilyMatches) reasons.push('EXAMINATION_FAMILY_MISMATCH');
  if (!evidence.subjectMatches) reasons.push('SUBJECT_MISMATCH');
  const scope = normalizedScope(evidence.rightsScope);
  if (!scope) reasons.push('RIGHTS_SCOPE_MISSING_OR_AMBIGUOUS');
  else {
    const requiredUse = evidence.requiredUse ?? HISTORICAL_PYQ_DISCOVERY_USE;
    if (!scope.allowedUses.includes(requiredUse)) reasons.push('RIGHTS_SCOPE_USE_NOT_ALLOWED');
    const language = evidence.requestedLanguage?.trim().toLowerCase();
    const languages = scope.languages.map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '').filter(Boolean);
    if (language && !languages.includes('*') && !languages.includes(language)) reasons.push('RIGHTS_SCOPE_LANGUAGE_NOT_ALLOWED');
  }
  return { eligible: reasons.length === 0, reasons };
}

export function evaluateQuestionEligibility(evidence: QuestionEligibilityEvidence) {
  const reasons: string[] = [];
  if (evidence.status !== QuestionVersionStatus.PUBLISHED) reasons.push('QUESTION_NOT_PUBLISHED');
  if (evidence.publicationStatus !== PublicationStatus.ACTIVE) reasons.push('PUBLICATION_NOT_ACTIVE');
  if (evidence.answerKeyCount < 1) reasons.push('ANSWER_KEY_MISSING');
  if (evidence.explanationCount < 1) reasons.push('REVIEWED_EXPLANATION_MISSING');
  if (evidence.mappingCount < 1) reasons.push('SYLLABUS_MAPPING_MISSING');
  if (!hasClearedRights(evidence.provenanceRights)) reasons.push('RIGHTS_OR_PROVENANCE_INCOMPLETE');
  if (new Set(evidence.approvedReviewerIds).size < 2) reasons.push('TWO_PERSON_REVIEW_MISSING');
  return { eligible: reasons.length === 0, reasons };
}

export function evaluateFormEligibility(evidence: FormEligibilityEvidence) {
  const publication = evidence.snapshotPublication;
  const reasons: string[] = [];
  if (evidence.status !== 'PUBLISHED') reasons.push('FORM_NOT_PUBLISHED');
  if (evidence.patternStatus !== PatternStatus.PUBLISHED) reasons.push('PATTERN_NOT_PUBLISHED');
  if (evidence.questionCount < 1) reasons.push('FORM_HAS_NO_QUESTIONS');
  if (evidence.answerKeyCount !== evidence.questionCount) reasons.push('ANSWER_KEY_REFERENCE_INCOMPLETE');
  if (publication.status !== 'READY') reasons.push('PUBLICATION_NOT_READY');
  for (const flag of ['officialEvidenceVerified', 'contentInventoryQualified', 'rightsCleared', 'reviewerApproved']) if (publication[flag] !== true) reasons.push(`${flag.toUpperCase()}_MISSING`);
  if (!Array.isArray(publication.regressionEvidence) || publication.regressionEvidence.length === 0) reasons.push('REGRESSION_EVIDENCE_MISSING');
  return { eligible: reasons.length === 0, reasons };
}
