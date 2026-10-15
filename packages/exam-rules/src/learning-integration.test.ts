import { describe, expect, it } from 'vitest';
import { aggregateMistakeEvidence, createMistakeEvidence, deduplicateMistakeEvidence } from './mistake-mine';
import { evaluateEvidenceEligibility, validateContentReadiness } from './learning-governance';
import { buildStudyPlan, generateNextBestActions, type LearnerProfile, type TopicCoverage } from './prep-pilot';
import { createPracticeState, generatePracticeSession, recordPracticeResponse, type PracticeConfig } from './practice';
import type { PublishedQuestionInput } from './contracts';

const config: PracticeConfig = { examCode: 'UGC_NET', cycleCode: '2026', subjectCode: 'EDU', mode: 'TOPIC_PRACTICE', languageCode: 'en-IN', questionCount: 1, topicIds: ['topic-1'], allowLearningAids: false };
const inventory: PublishedQuestionInput[] = [{ id: 'q-1', questionVersionId: 'qv-1', status: 'PUBLISHED', examCode: 'UGC_NET', cycleCode: '2026', subjectCode: 'EDU', sectionKey: 'practice', type: 'SINGLE_CHOICE', languageCodes: ['en-IN'], prompt: 'Synthetic approved question', options: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }], syllabusUnitId: 'unit-1', topicIds: ['topic-1'], difficulty: 'EASY', difficultyEvidence: 'REVIEWED' }];
const profile: LearnerProfile = { learnerRef: 'learner-1', targets: [{ targetId: 'target-1', examinationCode: 'UGC_NET', cycleCode: '2026', subjectCode: 'EDU', priority: 1, approvedSyllabusVersionId: 'syllabus-1' }], preferredLanguage: 'en-IN', availability: { dailyMinutes: 30, studyDays: [1], preferredWindows: ['EVENING'] }, priorities: ['MISTAKE_REMEDIATION'], profilingConsent: true, verifiedEvidenceRefs: [] };
const coverage: TopicCoverage[] = [{ targetId: 'target-1', unitId: 'unit-1', topicId: 'topic-1', title: 'Synthetic topic', syllabusVerified: true, attemptedQuestionCount: 1, eligibleEvidenceCount: 1, incorrectCount: 1, unattempted: false }];

describe('integrated learning evidence workflow', () => {
  it('connects practice response to authorized evidence, governance, Mistake Mine and bounded PrepPilot', () => {
    const session = generatePracticeSession({ config, inventory, seed: 'integration', now: new Date('2026-01-05T10:00:00Z') });
    const state = recordPracticeResponse(createPracticeState(session), { questionVersionId: 'qv-1', selectedOptionIds: ['B'], confidence: 'SURE', answeredAt: '2026-01-05T10:05:00Z' });
    expect(state.responses['qv-1'].selectedOptionIds).toEqual(['B']);
    const record = createMistakeEvidence({ learnerRef: 'learner-1', sourceSessionId: session.sessionId, sourceEventId: 'response-event-1', questionId: 'q-1', questionVersionId: 'qv-1', scoringPolicyId: 'practice-policy', scoringPolicyVersion: '1', examinationCode: 'UGC_NET', cycleCode: '2026', subjectCode: 'EDU', topicIds: ['topic-1'], relatedConceptIds: ['concept-1'], submittedOptionIds: state.responses['qv-1'].selectedOptionIds, outcome: 'INCORRECT', confidence: 'SURE', occurredAt: '2026-01-05T10:05:00Z', correctnessAuthorized: true, answerKeyRevision: 'key-1', provenance: 'AUTHORIZED_PRACTICE_SCORE', explanationRelease: 'AUTHORIZED' });
    const eligibility = evaluateEvidenceEligibility({ learnerRef: 'learner-1', ownerRef: 'learner-1', sourceSessionId: session.sessionId, sourceEventId: 'response-event-1', questionVersionId: record.questionVersionId, answerKeyRevision: record.answerKeyRevision, outcome: record.outcome, occurredAt: record.occurredAt, recordedAt: record.recordedAt, practiceSessionDistinct: true, sourceEventDistinct: true, topicIds: record.topicIds, syllabusUnitId: 'unit-1', contentStatus: 'PUBLISHED', answerKeyStatus: 'APPROVED', explanationStatus: 'REVIEWED', learnerOwnedContext: true, correctnessAuthorized: record.correctnessAuthorized });
    expect(eligibility.purposes.REVIEW_RECOMMENDATION).toBe(true);
    const aggregate = aggregateMistakeEvidence([record]);
    const actions = generateNextBestActions({ profile, coverage, evidence: [{ evidenceId: record.evidenceId, learnerRef: 'learner-1', targetId: 'target-1', topicId: 'topic-1', eligible: eligibility.purposes.REVIEW_RECOMMENDATION, outcome: record.outcome, confidence: record.confidence }], mistakes: aggregate, remediation: [], content: { 'target-1:topic-1': { practice: true, explanation: true, fresh: true, lesson: false, mock: false } }, actor: { learnerRef: 'learner-1', role: 'STUDENT', authenticated: true, consent: true } });
    const plan = buildStudyPlan({ profile, actions, startDate: '2026-01-05' });
    expect(actions[0].type).toBe('MISTAKE_REMEDIATION'); expect(Math.max(...Object.values(plan.dailyTotals))).toBeLessThanOrEqual(30); expect(plan.tasks.every((task) => task.evidenceRefs.includes(record.evidenceId))).toBe(true);
  });

  it('isolates learners, rejects duplicate source events and preserves content gates', () => {
    const record = createMistakeEvidence({ learnerRef: 'learner-a', sourceSessionId: 'session-a', sourceEventId: 'event-a', questionId: 'q-1', questionVersionId: 'qv-1', scoringPolicyId: 'p', scoringPolicyVersion: '1', examinationCode: 'E', cycleCode: 'C', subjectCode: 'S', topicIds: ['topic'], relatedConceptIds: [], submittedOptionIds: ['A'], outcome: 'CORRECT', occurredAt: '2026-01-01T00:00:00Z', correctnessAuthorized: true, provenance: 'AUTHORIZED_PRACTICE_SCORE', explanationRelease: 'UNAVAILABLE' });
    expect(deduplicateMistakeEvidence([record, record])).toHaveLength(1);
    const otherLearner = { ...record, learnerRef: 'learner-b', evidenceId: 'different' };
    expect(deduplicateMistakeEvidence([record, otherLearner])).toHaveLength(2);
    expect(validateContentReadiness({ questionVersionId: 'qv-1', contentStatus: 'PUBLISHED', answerKeyStatus: 'APPROVED', explanationStatus: 'MISSING', translationStatus: 'APPROVED', rightsStatus: 'LICENSED', topicIds: ['topic'], conceptIds: ['concept'], fresh: true, parallelGroupId: 'parallel' }).eligible).toBe(false);
  });

  it('handles a large deterministic evidence collection without cross-learner contamination', () => {
    const records = Array.from({ length: 250 }, (_, index) => createMistakeEvidence({ learnerRef: index % 2 ? 'learner-a' : 'learner-b', sourceSessionId: `session-${index}`, sourceEventId: `event-${index}`, questionId: `q-${index}`, questionVersionId: `qv-${index}`, scoringPolicyId: 'p', scoringPolicyVersion: '1', examinationCode: 'E', cycleCode: 'C', subjectCode: 'S', topicIds: [`topic-${index % 5}`], relatedConceptIds: [], submittedOptionIds: ['A'], outcome: index % 3 ? 'INCORRECT' : 'CORRECT', occurredAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`, correctnessAuthorized: true, provenance: 'AUTHORIZED_PRACTICE_SCORE', explanationRelease: 'UNAVAILABLE' }));
    expect(aggregateMistakeEvidence(records)).toEqual(aggregateMistakeEvidence(records));
    expect(new Set(records.map((record) => record.evidenceId)).size).toBe(250);
    expect(records.filter((record) => record.learnerRef === 'learner-a').every((record) => record.learnerRef !== 'learner-b')).toBe(true);
  });
});
