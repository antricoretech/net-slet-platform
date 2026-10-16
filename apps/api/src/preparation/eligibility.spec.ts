import { PatternStatus, PublicationStatus, QuestionVersionStatus, RightsStatus } from '../generated/prisma/client';
import { evaluateFormEligibility, evaluateHistoricalMetadataEligibility, evaluateQuestionEligibility, HISTORICAL_PYQ_DISCOVERY_USE } from './eligibility';

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

  it('fails closed for missing, expired, revoked or language-incompatible rights scope', () => {
    const base = { verificationStatus: 'VERIFIED', recordStatus: 'VERIFIED', publicationEligible: true, rightsStatus: RightsStatus.LICENSED, rightsScope: { allowedUses: [HISTORICAL_PYQ_DISCOVERY_USE], languages: ['en'] }, examinationFamilyMatches: true, subjectMatches: true, question: { status: QuestionVersionStatus.PUBLISHED, publicationStatus: PublicationStatus.ACTIVE, answerKeyCount: 1, explanationCount: 1, mappingCount: 1, provenanceRights: [RightsStatus.LICENSED], approvedReviewerIds: ['one', 'two'] } };
    expect(evaluateHistoricalMetadataEligibility(base, new Date('2026-01-01'))).toMatchObject({ eligible: true });
    expect(evaluateHistoricalMetadataEligibility({ ...base, rightsScope: undefined })).toMatchObject({ eligible: false, reasons: expect.arrayContaining(['RIGHTS_SCOPE_MISSING_OR_AMBIGUOUS']) });
    expect(evaluateHistoricalMetadataEligibility({ ...base, requestedLanguage: 'hi' })).toMatchObject({ eligible: false, reasons: expect.arrayContaining(['RIGHTS_SCOPE_LANGUAGE_NOT_ALLOWED']) });
    expect(evaluateHistoricalMetadataEligibility({ ...base, revokedAt: new Date('2025-12-31') }, new Date('2026-01-01'))).toMatchObject({ eligible: false, reasons: expect.arrayContaining(['METADATA_RIGHTS_REVOKED']) });
    expect(evaluateHistoricalMetadataEligibility({ ...base, rightsExpiresAt: new Date('2025-12-31') }, new Date('2026-01-01'))).toMatchObject({ eligible: false, reasons: expect.arrayContaining(['METADATA_RIGHTS_EXPIRED']) });
  });
});
