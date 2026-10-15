import type { PracticeConfidence } from './practice';

export type MistakeOutcome = 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';
export type MistakeErrorCause =
  | 'CONCEPT_GAP'
  | 'MISREAD'
  | 'CALCULATION'
  | 'RECALL_FAILURE'
  | 'OPTION_CONFUSION'
  | 'TIME_PRESSURE'
  | 'CARELESS_RESPONSE'
  | 'GUESSED_ANSWER'
  | 'OTHER'
  | 'PREFER_NOT_TO_SPECIFY';
export type MistakeProvenance = 'AUTHORIZED_PRACTICE_SCORE' | 'AUTHORIZED_KEY_CORRECTION';

export interface AuthorizedPracticeOutcome {
  readonly learnerRef: string;
  readonly sourceSessionId: string;
  readonly sourceEventId: string;
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly scoringPolicyId: string;
  readonly scoringPolicyVersion: string;
  readonly examinationCode: string;
  readonly cycleCode: string;
  readonly subjectCode: string;
  readonly topicIds: readonly string[];
  readonly relatedConceptIds: readonly string[];
  readonly submittedOptionIds: readonly string[];
  readonly outcome: MistakeOutcome;
  readonly confidence?: PracticeConfidence;
  readonly errorCause?: MistakeErrorCause;
  readonly occurredAt: string;
  readonly correctnessAuthorized: boolean;
  readonly answerKeyRevision?: string;
  readonly provenance: MistakeProvenance;
  readonly explanationRelease: 'UNAVAILABLE' | 'AUTHORIZED';
}

export interface MistakeEvidenceRecord extends AuthorizedPracticeOutcome {
  readonly evidenceId: string;
  readonly recordedAt: string;
  readonly lineage: { readonly sourceEventId: string; readonly answerKeyRevision?: string; readonly supersedesEvidenceId?: string };
}

export interface MistakeAggregate {
  readonly key: string;
  readonly topicIds: readonly string[];
  readonly conceptIds: readonly string[];
  readonly incorrectEventCount: number;
  readonly uniqueQuestionCount: number;
  readonly distinctSessionCount: number;
  readonly highConfidenceWrongCount: number;
  readonly lowConfidenceCorrectCount: number;
  readonly unattemptedCount: number;
  readonly selfReportedCauses: readonly MistakeErrorCause[];
  readonly repeatedError: boolean;
  readonly insufficientEvidence: boolean;
  readonly limitations: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface MistakeCluster {
  readonly clusterId: string;
  readonly basis: 'QUESTION' | 'TOPIC' | 'CONCEPT' | 'CAUSE' | 'CONFIDENCE';
  readonly label: string;
  readonly evidenceIds: readonly string[];
  readonly incorrectCount: number;
  readonly explanation: string;
  readonly limitations: readonly string[];
  readonly remediation: readonly string[];
}

export interface RemediationSuggestion {
  readonly suggestionId: string;
  readonly clusterId: string;
  readonly action: 'REVIEW_CONCEPT' | 'PRACTICE_FRESH_ITEMS' | 'REVIEW_STRATEGY' | 'COVER_UNATTEMPTED_TOPIC';
  readonly rationale: string;
  readonly available: boolean;
  readonly limitation?: string;
}

export interface StudentMistakeProjection {
  readonly evidenceId: string;
  readonly questionId: string;
  readonly questionVersionId: string;
  readonly sourceSessionId: string;
  readonly topicIds: readonly string[];
  readonly conceptIds: readonly string[];
  readonly selectedOptionIds: readonly string[];
  readonly outcome: MistakeOutcome;
  readonly confidence?: PracticeConfidence;
  readonly errorCause?: MistakeErrorCause;
  readonly occurredAt: string;
  readonly explanation: 'UNAVAILABLE' | 'AUTHORIZED';
  readonly correctOptionIds?: readonly string[];
}

const text = (value: string, field: string): string => {
  if (!value.trim()) throw new Error(`${field} is required`);
  return value;
};
const hash = (value: string): string => { let result = 2166136261; for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return (result >>> 0).toString(16).padStart(8, '0'); };
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

export function createMistakeEvidence(input: AuthorizedPracticeOutcome, recordedAt = input.occurredAt): MistakeEvidenceRecord {
  text(input.learnerRef, 'Learner reference'); text(input.sourceSessionId, 'Source session'); text(input.sourceEventId, 'Source event'); text(input.questionVersionId, 'Question version');
  if (!input.correctnessAuthorized) throw new Error('Mistake evidence requires an authorized server outcome');
  if (!['CORRECT', 'INCORRECT', 'UNATTEMPTED'].includes(input.outcome)) throw new Error('Invalid evidence outcome');
  if (Number.isNaN(Date.parse(input.occurredAt)) || Number.isNaN(Date.parse(recordedAt))) throw new Error('Evidence timestamps must be valid ISO dates');
  if (input.outcome === 'UNATTEMPTED' && input.submittedOptionIds.length) throw new Error('Unattempted evidence cannot contain submitted options');
  const evidenceId = `me-${hash(`${input.learnerRef}|${input.sourceEventId}`)}`;
  return Object.freeze({ ...input, topicIds: unique(input.topicIds), relatedConceptIds: unique(input.relatedConceptIds), submittedOptionIds: unique(input.submittedOptionIds), evidenceId, recordedAt, lineage: { sourceEventId: input.sourceEventId, ...(input.answerKeyRevision ? { answerKeyRevision: input.answerKeyRevision } : {}) } });
}

export function deduplicateMistakeEvidence(records: readonly MistakeEvidenceRecord[]): MistakeEvidenceRecord[] {
  const bySource = new Map<string, MistakeEvidenceRecord>();
  for (const record of records) {
    const key = `${record.learnerRef}|${record.sourceEventId}`;
    const existing = bySource.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error(`Conflicting evidence for source event: ${record.sourceEventId}`);
    bySource.set(key, record);
  }
  return [...bySource.values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
}

export function reviseErrorCause(record: MistakeEvidenceRecord, errorCause: MistakeErrorCause): MistakeEvidenceRecord { return Object.freeze({ ...record, errorCause }); }
export function removeErrorCause(record: MistakeEvidenceRecord): MistakeEvidenceRecord { const { errorCause: _removed, ...withoutCause } = record; return Object.freeze(withoutCause as MistakeEvidenceRecord); }

export function aggregateMistakeEvidence(records: readonly MistakeEvidenceRecord[], minimumDistinctQuestions = 2): MistakeAggregate[] {
  const groups = new Map<string, MistakeEvidenceRecord[]>();
  for (const record of deduplicateMistakeEvidence(records)) {
    const keys = record.topicIds.length ? record.topicIds : ['UNMAPPED'];
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, items]) => {
    const incorrect = items.filter((item) => item.outcome === 'INCORRECT');
    const uniqueQuestions = new Set(incorrect.map((item) => item.questionVersionId));
    const sessions = new Set(incorrect.map((item) => item.sourceSessionId));
    const limitations = key === 'UNMAPPED' ? ['No approved topic mapping is available.'] : [];
    if (incorrect.length && uniqueQuestions.size < minimumDistinctQuestions) limitations.push('Repeated attempts on one question are not independent evidence of a repeated concept error.');
    if (!incorrect.length) limitations.push('No incorrect authorized outcome is present in this group.');
    return { key, topicIds: key === 'UNMAPPED' ? [] : [key], conceptIds: unique(items.flatMap((item) => item.relatedConceptIds)), incorrectEventCount: incorrect.length, uniqueQuestionCount: uniqueQuestions.size, distinctSessionCount: sessions.size, highConfidenceWrongCount: incorrect.filter((item) => item.confidence === 'SURE').length, lowConfidenceCorrectCount: items.filter((item) => item.outcome === 'CORRECT' && item.confidence !== 'SURE').length, unattemptedCount: items.filter((item) => item.outcome === 'UNATTEMPTED').length, selfReportedCauses: unique(incorrect.flatMap((item) => item.errorCause ? [item.errorCause] : [])) as MistakeErrorCause[], repeatedError: uniqueQuestions.size >= minimumDistinctQuestions, insufficientEvidence: incorrect.length === 0 || uniqueQuestions.size < minimumDistinctQuestions, limitations, evidenceIds: items.map((item) => item.evidenceId).sort() };
  });
}

export function clusterMistakeEvidence(records: readonly MistakeEvidenceRecord[], minimumDistinctQuestions = 2): MistakeCluster[] {
  const deduped = deduplicateMistakeEvidence(records);
  const groups = new Map<string, { basis: MistakeCluster['basis']; label: string; items: MistakeEvidenceRecord[] }>();
  const add = (basis: MistakeCluster['basis'], label: string, item: MistakeEvidenceRecord) => { const key = `${basis}:${label}`; groups.set(key, { basis, label, items: [...(groups.get(key)?.items ?? []), item] }); };
  for (const item of deduped.filter((entry) => entry.outcome === 'INCORRECT')) { item.topicIds.forEach((topic) => add('TOPIC', topic, item)); item.relatedConceptIds.forEach((concept) => add('CONCEPT', concept, item)); if (item.errorCause) add('CAUSE', item.errorCause, item); if (item.confidence === 'SURE') add('CONFIDENCE', 'HIGH_CONFIDENCE_WRONG', item); }
  return [...groups.values()].sort((a, b) => `${a.basis}:${a.label}`.localeCompare(`${b.basis}:${b.label}`)).map((group) => { const ids = unique(group.items.map((item) => item.evidenceId)); const uniqueQuestions = new Set(group.items.map((item) => item.questionVersionId)); const limitations = uniqueQuestions.size < minimumDistinctQuestions ? ['Insufficient independent question evidence; do not infer mastery or a stable misconception.'] : []; return { clusterId: `cluster-${hash(`${group.basis}|${group.label}`)}`, basis: group.basis, label: group.label, evidenceIds: ids, incorrectCount: group.items.length, explanation: group.basis === 'CONFIDENCE' ? 'The learner selected an incorrect response while reporting high confidence.' : `Authorized incorrect outcomes share the ${group.basis.toLowerCase()} mapping “${group.label}”.`, limitations, remediation: ['Review the mapped concept or strategy.', 'Attempt fresh parallel content after review.'] }; });
}

export function recommendRemediation(clusters: readonly MistakeCluster[], freshContentAvailable = false): RemediationSuggestion[] {
  return clusters.map((cluster) => { const concept = cluster.basis === 'CONCEPT' || cluster.basis === 'TOPIC'; const action = concept ? 'REVIEW_CONCEPT' : cluster.basis === 'CAUSE' ? 'REVIEW_STRATEGY' : 'PRACTICE_FRESH_ITEMS'; return { suggestionId: `rem-${hash(cluster.clusterId)}`, clusterId: cluster.clusterId, action, rationale: cluster.limitations.length ? `${cluster.explanation} Recommendation is provisional because ${cluster.limitations.join(' ')}` : cluster.explanation, available: action !== 'PRACTICE_FRESH_ITEMS' || freshContentAvailable, ...(action === 'PRACTICE_FRESH_ITEMS' && !freshContentAvailable ? { limitation: 'Fresh approved parallel content is not available in this preview.' } : {}) }; });
}

export function toStudentMistakeProjection(record: MistakeEvidenceRecord, authorizedRelease = false, correctOptionIds?: readonly string[]): StudentMistakeProjection {
  return { evidenceId: record.evidenceId, questionId: record.questionId, questionVersionId: record.questionVersionId, sourceSessionId: record.sourceSessionId, topicIds: record.topicIds, conceptIds: record.relatedConceptIds, selectedOptionIds: record.submittedOptionIds, outcome: record.outcome, ...(record.confidence ? { confidence: record.confidence } : {}), ...(record.errorCause ? { errorCause: record.errorCause } : {}), occurredAt: record.occurredAt, explanation: authorizedRelease && record.explanationRelease === 'AUTHORIZED' ? 'AUTHORIZED' : 'UNAVAILABLE', ...(authorizedRelease && correctOptionIds ? { correctOptionIds } : {}) };
}
