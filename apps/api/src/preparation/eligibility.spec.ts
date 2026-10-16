import { PatternStatus, PublicationStatus, QuestionVersionStatus, RightsStatus } from '../generated/prisma/client';
import { evaluateFormEligibility, evaluateQuestionEligibility } from './eligibility';

describe('preparation eligibility', () => {
  it('requires two reviewed, rights-cleared published question records', () => {
    const base = { status: QuestionVersionStatus.PUBLISHED, publicationStatus: PublicationStatus.ACTIVE, answerKeyCount: 1, explanationCount: 1, mappingCount: 1, provenanceRights: [RightsStatus.RESTRICTED], approvedReviewerIds: ['reviewer-a', 'reviewer-b'] };
    expect(evaluateQuestionEligibility(base)).toEqual({ eligible: false, reasons: ['RIGHTS_OR_PROVENANCE_INCOMPLETE'] });
    expect(evaluateQuestionEligibility({ ...base, provenanceRights: [RightsStatus.LICENSED], approvedReviewerIds: ['reviewer-a', 'reviewer-b'] })).toEqual({ eligible: true, reasons: [] });
  });

  it('rejects forms unless the immutable publication evidence is complete', () => {
    const evidence = { status: 'PUBLISHED', patternStatus: PatternStatus.PUBLISHED, questionCount: 2, answerKeyCount: 2, snapshotPublication: { status: 'READY', officialEvidenceVerified: true, contentInventoryQualified: true, rightsCleared: true, reviewerApproved: true, regressionEvidence: ['regression-1'] } };
    expect(evaluateFormEligibility(evidence)).toEqual({ eligible: true, reasons: [] });
    expect(evaluateFormEligibility({ ...evidence, snapshotPublication: { ...evidence.snapshotPublication, reviewerApproved: false } })).toMatchObject({ eligible: false, reasons: ['REVIEWERAPPROVED_MISSING'] });
  });
});
