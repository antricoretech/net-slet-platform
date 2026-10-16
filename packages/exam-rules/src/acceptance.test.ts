import { describe, expect, it } from 'vitest';
import { buildAcademicInventoryAcceptanceReport } from './acceptance';
import type { QuestionQualityInput } from './content-quality';

const record = (overrides: Partial<QuestionQualityInput> = {}): QuestionQualityInput => ({
  questionVersionId: 'qv-1', examinationCode: 'UGC_NET', cycleCode: 'OWNER_SELECTED', subjectCode: 'OWNER_SUBJECT',
  sectionKey: 'paper-1', status: 'PUBLISHED', answerKeyStatus: 'APPROVED', explanationStatus: 'REVIEWED',
  translationStatus: 'APPROVED', mappingStatus: 'APPROVED', rightsStatus: 'OWNED', provenanceStatus: 'VERIFIED',
  languageCode: 'en-IN', type: 'SINGLE_CHOICE', prompt: 'Prompt', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  correctOptionIds: ['a'], answerKeyVersionId: 'ak-1', answerKeyVersionRef: 'ak-1', difficultyEvidence: 'REVIEWED',
  sourceEventId: 'source-1', canonicalText: 'canonical-1',
  explanation: { answerKeyVersionId: 'ak-1', answerKeyStatus: 'APPROVED', explanationVersionId: 'ex-1', explanationStatus: 'REVIEWED', correctRationaleReviewed: true, distractorRationalesReviewed: true, conceptRefs: ['concept-1'], reviewerRef: 'sme-1', reviewedAt: '2026-01-01T00:00:00Z', citationStatus: 'UNAVAILABLE', answerKeyVersionRef: 'ak-1', explanationAnswerKeyVersionRef: 'ak-1' },
  rights: { basis: 'ORIGINAL_INTERNAL', status: 'REVIEWED', permits: { research: true, studentPractice: true, strictMock: true, translation: true, adaptation: true, download: false, redistribution: false }, reference: 'ownership-1' },
  translation: { sourceQuestionVersionId: 'qv-source', targetQuestionVersionId: 'qv-1', languageCode: 'en-IN', status: 'APPROVED', sourceOptionCount: 2, targetOptionCount: 2, answerKeyConsistent: true, mathTokensPreserved: true, terminologyReviewed: true, reviewerRef: 'lang-1', reviewedAt: '2026-01-01T00:00:00Z' },
  ...overrides,
});

describe('Release 1 academic acceptance metrics', () => {
  const scope = { examinationCode: 'UGC_NET', cycleCode: 'OWNER_SELECTED', subjectCode: 'OWNER_SUBJECT' } as const;
  it('uses owner-supplied requirements and reports explicit qualification metrics', () => {
    const report = buildAcademicInventoryAcceptanceReport(scope, [record()], [{ requirementId: 'paper-1', label: 'Paper I', count: 2, scope, sourceReference: 'approved-blueprint' }]);
    expect(report.totalRequired).toBe(2);
    expect(report.totalAvailable).toBe(1);
    expect(report.totalQualified).toBe(1);
    expect(report.shortfall).toBe(1);
    expect(report.rightsUnverified).toBe(0);
    expect(report.deterministic).toBe(true);
  });
  it('counts missing key, explanation, rights and conflicting duplicate evidence', () => {
    const incomplete = record({ questionVersionId: 'qv-2', answerKeyVersionId: undefined, explanation: undefined, rights: undefined, answerKeyVersionRef: undefined, sourceEventId: 'source-1', canonicalText: 'canonical-1' });
    const report = buildAcademicInventoryAcceptanceReport(scope, [record(), incomplete], []);
    expect(report.missingAnswerKeys).toBe(1);
    expect(report.missingExplanations).toBe(1);
    expect(report.rightsUnverified).toBe(1);
    expect(report.conflictingDuplicates).toContain('SOURCE_EVENT: source-1');
  });
});
