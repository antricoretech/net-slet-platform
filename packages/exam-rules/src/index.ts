/**
 * Sprint 0 rules scaffolding, NOT a complete exam scorer or certification.
 * A blueprint is only research data until approved with documented evidence.
 */
export type ReviewStatus = 'RESEARCH_ONLY' | 'DISCOVERED' | 'RESEARCHED' | 'DRAFT' | 'SME_REVIEWED' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED';
export type DeliveryMode = 'CBT' | 'OMR_SIMULATION';
export type SessionTimingPolicy = 'CONTINUOUS' | 'INDEPENDENT' | 'SEQUENTIAL_LOCKED';
export type AnswerPolicy = 'SINGLE_SELECT' | 'MULTI_SELECT' | 'EXACT_MATCH';
export interface SectionBlueprint {
  key: string;
  durationSeconds: number;
  offeredQuestions: number;
  maximumAttempts: number;
  answerPolicy?: AnswerPolicy;
  marksCorrect?: string | number;
  marksWrong?: string | number;
  exactMatch?: boolean;
  allowMultipleCorrect?: boolean;
}
export interface SessionBlueprint {
  key: string;
  durationSeconds: number;
  sequence: number;
  deliveryMode: DeliveryMode;
  timingPolicy: SessionTimingPolicy;
  submitSeparately?: boolean;
  allowReturn?: boolean;
  sections: SectionBlueprint[];
}
export interface ExamBlueprint {
  examCode: string;
  cycleCode: string;
  subjectCode: string;
  status: ReviewStatus;
  sections: SectionBlueprint[];
  sessions?: SessionBlueprint[];
  languages?: string[];
  evidence?: { officialSourceUrl: string; reviewedBy: string; approvedAt: string; regressionReportId: string; ruleHash: string };
}
export function validateBlueprint(blueprint: ExamBlueprint): string[] {
  const errors: string[] = [];
  if (!blueprint.examCode.trim() || !blueprint.cycleCode.trim() || !blueprint.subjectCode.trim()) errors.push('Exam, cycle and subject are required');
  if (blueprint.sections.length === 0 && (!blueprint.sessions || blueprint.sessions.length === 0)) errors.push('At least one section or session is required');
  if (blueprint.languages && (blueprint.languages.length === 0 || new Set(blueprint.languages).size !== blueprint.languages.length || blueprint.languages.some((language) => !/^[a-z]{2,8}(?:-[A-Z]{2})?$/.test(language)))) errors.push('Languages must be unique BCP-47-like codes');
  const keys = new Set<string>();
  for (const part of blueprint.sections) validateSection(part, keys, errors);
  const sessionKeys = new Set<string>();
  for (const session of blueprint.sessions ?? []) {
    if (!session.key.trim() || sessionKeys.has(session.key)) errors.push(`Invalid or duplicate session key: ${session.key}`);
    sessionKeys.add(session.key);
    if (!Number.isSafeInteger(session.durationSeconds) || session.durationSeconds <= 0) errors.push(`Invalid session duration: ${session.key}`);
    if (!Number.isSafeInteger(session.sequence) || session.sequence < 0) errors.push(`Invalid session sequence: ${session.key}`);
    if (!['CBT', 'OMR_SIMULATION'].includes(session.deliveryMode)) errors.push(`Invalid delivery mode: ${session.key}`);
    if (!['CONTINUOUS', 'INDEPENDENT', 'SEQUENTIAL_LOCKED'].includes(session.timingPolicy)) errors.push(`Invalid timing policy: ${session.key}`);
    if (!Array.isArray(session.sections) || session.sections.length === 0) errors.push(`Session must include sections: ${session.key}`);
    for (const part of session.sections ?? []) validateSection(part, keys, errors, session.key);
  }
  return errors;
}

function validateSection(part: SectionBlueprint, keys: Set<string>, errors: string[], sessionKey?: string): void {
  const qualifiedKey = sessionKey ? `${sessionKey}.${part.key}` : part.key;
  if (!part.key.trim() || keys.has(qualifiedKey)) errors.push(`Invalid or duplicate section key: ${qualifiedKey}`);
  keys.add(qualifiedKey);
  if (!Number.isSafeInteger(part.durationSeconds) || part.durationSeconds <= 0) errors.push(`Invalid section duration: ${qualifiedKey}`);
  if (!Number.isSafeInteger(part.offeredQuestions) || part.offeredQuestions <= 0) errors.push(`Invalid offered questions: ${qualifiedKey}`);
  if (!Number.isSafeInteger(part.maximumAttempts) || part.maximumAttempts < 1 || part.maximumAttempts > part.offeredQuestions) errors.push(`Invalid maximum attempts: ${qualifiedKey}`);
  if (part.answerPolicy && !['SINGLE_SELECT', 'MULTI_SELECT', 'EXACT_MATCH'].includes(part.answerPolicy)) errors.push(`Invalid answer policy: ${qualifiedKey}`);
  for (const [name, value] of [['marksCorrect', part.marksCorrect], ['marksWrong', part.marksWrong]] as const) {
    if (value !== undefined && (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value)) || Number(value) < 0)) errors.push(`Invalid ${name}: ${qualifiedKey}`);
  }
  if (part.answerPolicy === 'EXACT_MATCH' && part.allowMultipleCorrect !== true) errors.push(`Exact-match sections must allow multiple correct answers: ${qualifiedKey}`);
}
/** Metadata check only: this does not authenticate a reviewer or verify a bulletin. */
export function hasPublicationMetadata(blueprint: ExamBlueprint): boolean {
  if (validateBlueprint(blueprint).length) return false;
  if (blueprint.status !== 'APPROVED') return false;
  const evidence = blueprint.evidence;
  if (!evidence?.officialSourceUrl || !evidence.reviewedBy?.trim() || !evidence.approvedAt || !evidence.regressionReportId?.trim() || !evidence.ruleHash?.trim()) return false;
  try {
    const url = new URL(evidence.officialSourceUrl);
    if (url.protocol !== 'https:') return false;
  } catch { return false; }
  return !Number.isNaN(Date.parse(evidence.approvedAt));
}
