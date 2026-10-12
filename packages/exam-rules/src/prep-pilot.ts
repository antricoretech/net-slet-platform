import type { MistakeAggregate, RemediationSuggestion } from './mistake-mine';
import type { LearningRole } from './learning-governance';

export type DateProvenance = 'VERIFIED' | 'LEARNER_SUPPLIED' | 'UNVERIFIED';
export type Familiarity = 'NEW' | 'FAMILIAR' | 'CONFIDENT' | 'NOT_PROVIDED';
export type PreparationPriority = 'SYLLABUS_COVERAGE' | 'MISTAKE_REMEDIATION' | 'CONFIDENCE_BUILDING' | 'EXAM_SIMULATION' | 'CONCEPT_REVIEW';
export type StudyWindow = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';

export interface ExamTarget {
  readonly targetId: string;
  readonly examinationCode: string;
  readonly cycleCode: string;
  readonly subjectCode: string;
  readonly examDate?: { readonly value: string; readonly provenance: DateProvenance; readonly verifiedAt?: string };
  readonly priority: number;
  readonly approvedSyllabusVersionId?: string;
}
export interface StudyAvailability {
  readonly dailyMinutes: number;
  readonly studyDays: readonly number[];
  readonly preferredWindows: readonly StudyWindow[];
  readonly variableDailyMinutes?: Readonly<Record<number, number>>;
  readonly restDays?: readonly string[];
  readonly breakMinutes?: number;
}
export interface LearnerProfile {
  readonly learnerRef: string;
  readonly targets: readonly ExamTarget[];
  readonly preferredLanguage: string;
  readonly availability: StudyAvailability;
  readonly priorities: readonly PreparationPriority[];
  readonly familiarity?: Readonly<Record<string, Familiarity>>;
  readonly profilingConsent: boolean;
  readonly verifiedEvidenceRefs: readonly string[];
}
export interface ProfileValidation { readonly valid: boolean; readonly provisional: boolean; readonly reasons: readonly string[]; }

export interface TopicCoverage {
  readonly targetId: string;
  readonly unitId: string;
  readonly topicId: string;
  readonly title: string;
  readonly syllabusVerified: boolean;
  readonly attemptedQuestionCount: number;
  readonly eligibleEvidenceCount: number;
  readonly incorrectCount: number;
  readonly unattempted: boolean;
  readonly approvedCrossExamMapping?: { readonly targetId: string; readonly sourceTopicId: string; readonly mappingId: string };
}
export interface PerformanceEvidence { readonly evidenceId: string; readonly learnerRef: string; readonly targetId: string; readonly topicId: string; readonly eligible: boolean; readonly outcome: 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED'; readonly confidence?: 'SURE' | 'UNSURE' | 'GUESS'; readonly limitations?: readonly string[]; }

export type StudyActionType = 'TOPIC_PRACTICE' | 'UNIT_PRACTICE' | 'MIXED_REVISION' | 'FRESH_QUESTION_PRACTICE' | 'REVIEWED_EXPLANATION' | 'MISTAKE_REMEDIATION' | 'CONCEPT_LESSON' | 'MOCK_EXAMINATION' | 'SYLLABUS_COVERAGE';
export interface StudyAction {
  readonly actionId: string;
  readonly targetId: string;
  readonly examinationCode: string;
  readonly subjectCode: string;
  readonly topicId?: string;
  readonly type: StudyActionType;
  readonly estimatedMinutes: number;
  readonly durationBasis: string;
  readonly evidenceRefs: readonly string[];
  readonly priority: number;
  readonly reason: string;
  readonly contentAvailable: boolean;
  readonly authorized: boolean;
  readonly eligible: boolean;
  readonly limitations: readonly string[];
}
export interface StudyPlanTask extends StudyAction { readonly date: string; readonly breakAfterMinutes?: number; }
export interface StudyPlan { readonly planId: string; readonly revision: number; readonly status: 'PROVISIONAL' | 'READY'; readonly tasks: readonly StudyPlanTask[]; readonly omitted: readonly StudyAction[]; readonly totalMinutes: number; readonly dailyTotals: Readonly<Record<string, number>>; readonly limitations: readonly string[]; }

export function validateLearnerProfile(profile: LearnerProfile): ProfileValidation {
  const reasons: string[] = [];
  if (!profile.learnerRef.trim()) reasons.push('Learner reference is required.');
  if (!profile.targets.length) reasons.push('At least one examination target is required.');
  if (new Set(profile.targets.map((target) => target.targetId)).size !== profile.targets.length) reasons.push('Examination target identifiers must be unique.');
  if (new Set(profile.priorities).size !== profile.priorities.length) reasons.push('Preparation priorities must be unique.');
  if (!profile.preferredLanguage.trim()) reasons.push('Preferred language is required.');
  if (!Number.isSafeInteger(profile.availability.dailyMinutes) || profile.availability.dailyMinutes < 1) reasons.push('Daily study minutes must be positive.');
  if (!profile.availability.studyDays.length || profile.availability.studyDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) reasons.push('Study days must use weekday numbers from 0 to 6.');
  if (profile.availability.variableDailyMinutes && Object.entries(profile.availability.variableDailyMinutes).some(([day, minutes]) => Number(day) < 0 || Number(day) > 6 || !Number.isSafeInteger(minutes) || minutes < 0)) reasons.push('Variable daily availability is invalid.');
  if (profile.availability.breakMinutes !== undefined && (!Number.isSafeInteger(profile.availability.breakMinutes) || profile.availability.breakMinutes < 0)) reasons.push('Break duration is invalid.');
  const provisional = profile.targets.some((target) => target.examDate?.provenance !== 'VERIFIED') || !profile.targets.every((target) => target.approvedSyllabusVersionId) || !profile.profilingConsent;
  if (!profile.profilingConsent) reasons.push('Optional profiling consent is not active; non-personalized planning is required.');
  return { valid: !reasons.some((reason) => /required|invalid|unique/.test(reason)), provisional, reasons };
}

const actionId = (targetId: string, type: StudyActionType, topicId = '') => `study-${targetId}-${type}-${topicId || 'general'}`.toLowerCase();
export function generateNextBestActions(input: { readonly profile: LearnerProfile; readonly coverage: readonly TopicCoverage[]; readonly evidence: readonly PerformanceEvidence[]; readonly mistakes: readonly MistakeAggregate[]; readonly remediation: readonly RemediationSuggestion[]; readonly content: Readonly<Record<string, { readonly practice: boolean; readonly explanation: boolean; readonly fresh: boolean; readonly lesson: boolean; readonly mock: boolean }>>; readonly actor: { readonly learnerRef: string; readonly role: LearningRole; readonly authenticated: boolean; readonly consent: boolean } }): StudyAction[] {
  const actions: StudyAction[] = [];
  const owned = input.actor.authenticated && input.actor.learnerRef === input.profile.learnerRef && ['STUDENT', 'ADMIN'].includes(input.actor.role);
  const personalized = owned && input.actor.consent && input.profile.profilingConsent;
  for (const topic of input.coverage.filter((item) => item.syllabusVerified).sort((a, b) => `${a.targetId}:${a.topicId}`.localeCompare(`${b.targetId}:${b.topicId}`))) {
    const key = `${topic.targetId}:${topic.topicId}`; const content = input.content[key] ?? { practice: false, explanation: false, fresh: false, lesson: false, mock: false }; const refs = personalized ? input.evidence.filter((item) => item.targetId === topic.targetId && item.topicId === topic.topicId && item.eligible && item.learnerRef === input.profile.learnerRef).map((item) => item.evidenceId) : []; const limitations: string[] = []; if (!owned) limitations.push('Learner authorization is unavailable.'); if (!personalized) limitations.push('Optional profiling is unavailable; this is a non-personalized fallback.'); if (!content.practice) limitations.push('Approved practice content is unavailable.');
    if (topic.unattempted && content.practice) actions.push({ actionId: actionId(topic.targetId, 'SYLLABUS_COVERAGE', topic.topicId), targetId: topic.targetId, examinationCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.examinationCode ?? '', subjectCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.subjectCode ?? '', topicId: topic.topicId, type: 'SYLLABUS_COVERAGE', estimatedMinutes: 20, durationBasis: 'Short coverage activity baseline', evidenceRefs: refs, priority: 80, reason: `Begin coverage for ${topic.title}; no sufficient attempt evidence is available.`, contentAvailable: content.practice, authorized: owned, eligible: owned && content.practice, limitations });
    if (personalized && topic.incorrectCount > 0 && input.mistakes.some((mistake) => mistake.key === topic.topicId) && content.explanation) actions.push({ actionId: actionId(topic.targetId, 'MISTAKE_REMEDIATION', topic.topicId), targetId: topic.targetId, examinationCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.examinationCode ?? '', subjectCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.subjectCode ?? '', topicId: topic.topicId, type: 'MISTAKE_REMEDIATION', estimatedMinutes: 15, durationBasis: 'Evidence-backed focused remediation baseline', evidenceRefs: refs, priority: 100, reason: `Review ${topic.title} using authorized mistake evidence before attempting fresh content.`, contentAvailable: content.explanation, authorized: true, eligible: true, limitations });
    if (content.fresh && owned) actions.push({ actionId: actionId(topic.targetId, 'FRESH_QUESTION_PRACTICE', topic.topicId), targetId: topic.targetId, examinationCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.examinationCode ?? '', subjectCode: input.profile.targets.find((target) => target.targetId === topic.targetId)?.subjectCode ?? '', topicId: topic.topicId, type: 'FRESH_QUESTION_PRACTICE', estimatedMinutes: 25, durationBasis: 'Fresh approved parallel-question baseline', evidenceRefs: refs, priority: personalized && topic.incorrectCount ? 90 : 60, reason: `Practise unseen approved questions for ${topic.title}; this is not a mastery claim.`, contentAvailable: true, authorized: true, eligible: true, limitations });
  }
  return actions.filter((item) => item.eligible && item.contentAvailable && item.authorized).sort((a, b) => b.priority - a.priority || a.actionId.localeCompare(b.actionId));
}

export function buildStudyPlan(input: { readonly profile: LearnerProfile; readonly actions: readonly StudyAction[]; readonly startDate: string; readonly revision?: number }): StudyPlan {
  const validation = validateLearnerProfile(input.profile); const omissions = input.actions.filter((action) => !action.eligible || !action.contentAvailable || !action.authorized); const tasks: StudyPlanTask[] = []; const dailyTotals: Record<string, number> = {}; const dates = [...Array(14)].map((_, index) => { const date = new Date(`${input.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
  let actionIndex = 0; for (const date of dates) { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); if (!input.profile.availability.studyDays.includes(day) || input.profile.availability.restDays?.includes(date)) continue; const budget = input.profile.availability.variableDailyMinutes?.[day] ?? input.profile.availability.dailyMinutes; let used = 0; while (actionIndex < input.actions.length) { const action = input.actions[actionIndex]; if (!action.eligible || !action.contentAvailable || !action.authorized) { actionIndex += 1; continue; } const breakMinutes = tasks.length && input.profile.availability.breakMinutes ? input.profile.availability.breakMinutes : 0; if (used + breakMinutes + action.estimatedMinutes > budget) break; tasks.push({ ...action, date, ...(breakMinutes ? { breakAfterMinutes: breakMinutes } : {}) }); used += breakMinutes + action.estimatedMinutes; actionIndex += 1; } if (used) dailyTotals[date] = used; }
  const limitations = [...validation.reasons]; if (actionIndex < input.actions.length) limitations.push('Not all eligible actions fit within the configured planning horizon.'); if (!input.profile.targets.some((target) => target.examDate?.provenance === 'VERIFIED')) limitations.push('No verified examination date is available for countdown planning.');
  return { planId: `plan-${input.profile.learnerRef}-${input.startDate}`, revision: input.revision ?? 1, status: limitations.length ? 'PROVISIONAL' : 'READY', tasks, omitted: [...omissions, ...input.actions.slice(actionIndex)], totalMinutes: Object.values(dailyTotals).reduce((sum, value) => sum + value, 0), dailyTotals, limitations: [...new Set(limitations)] };
}

export function summarizeCoverage(targetId: string, coverage: readonly TopicCoverage[]): { readonly targetId: string; readonly totalTopics: number; readonly coveredTopics: number; readonly unattemptedTopicIds: readonly string[]; readonly insufficientEvidenceTopicIds: readonly string[]; readonly availability: 'AVAILABLE' | 'UNAVAILABLE' } { const items = coverage.filter((item) => item.targetId === targetId && item.syllabusVerified); return { targetId, totalTopics: items.length, coveredTopics: items.filter((item) => !item.unattempted).length, unattemptedTopicIds: items.filter((item) => item.unattempted).map((item) => item.topicId), insufficientEvidenceTopicIds: items.filter((item) => item.eligibleEvidenceCount < 2).map((item) => item.topicId), availability: items.length ? 'AVAILABLE' : 'UNAVAILABLE' }; }

export interface PrepDashboardProjection { readonly learnerRef: string; readonly targets: readonly { readonly targetId: string; readonly examinationCode: string; readonly cycleCode: string; readonly subjectCode: string; readonly countdownDays?: number; readonly dateStatus: 'VERIFIED' | 'LEARNER_SUPPLIED' | 'UNAVAILABLE' }[]; readonly todayActions: readonly StudyPlanTask[]; readonly coverage: readonly ReturnType<typeof summarizeCoverage>[]; readonly mistakes: readonly Pick<MistakeAggregate, 'key' | 'incorrectEventCount' | 'highConfidenceWrongCount' | 'insufficientEvidence' | 'limitations'>[]; readonly spacedReview: { readonly available: false; readonly reason: string }; readonly persistence: { readonly available: false; readonly reason: string }; readonly limitations: readonly string[]; }
export function toPrepDashboardProjection(input: { readonly profile: LearnerProfile; readonly plan: StudyPlan; readonly coverage: readonly TopicCoverage[]; readonly mistakes: readonly MistakeAggregate[]; readonly now: string }): PrepDashboardProjection { const targets = input.profile.targets.map((target) => { const dateStatus: 'VERIFIED' | 'LEARNER_SUPPLIED' | 'UNAVAILABLE' = target.examDate?.provenance === 'VERIFIED' ? 'VERIFIED' : target.examDate ? 'LEARNER_SUPPLIED' : 'UNAVAILABLE'; const countdownDays = dateStatus === 'VERIFIED' && target.examDate ? Math.max(0, Math.ceil((Date.parse(target.examDate.value) - Date.parse(input.now)) / 86400000)) : undefined; return { targetId: target.targetId, examinationCode: target.examinationCode, cycleCode: target.cycleCode, subjectCode: target.subjectCode, ...(countdownDays !== undefined ? { countdownDays } : {}), dateStatus }; }); return { learnerRef: input.profile.learnerRef, targets, todayActions: input.plan.tasks.filter((task) => task.date === input.now.slice(0, 10)), coverage: input.profile.targets.map((target) => summarizeCoverage(target.targetId, input.coverage)), mistakes: input.mistakes.map((item) => ({ key: item.key, incorrectEventCount: item.incorrectEventCount, highConfidenceWrongCount: item.highConfidenceWrongCount, insufficientEvidence: item.insufficientEvidence, limitations: item.limitations })), spacedReview: { available: false, reason: 'L0.C durable retrieval history and approved scheduling rules are unavailable.' }, persistence: { available: false, reason: 'This dashboard preview does not durably save learner data.' }, limitations: input.plan.limitations }; }

export function canRevisePlan(currentRevision: number, expectedRevision: number): { readonly allowed: boolean; readonly reason?: string } { return currentRevision === expectedRevision ? { allowed: true } : { allowed: false, reason: 'Study plan revision is stale; reload before changing availability.' }; }
