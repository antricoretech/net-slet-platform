import { HistoricalMetadataVerificationStatus, PatternStatus, RightsStatus, TestFormStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PreparationService } from './preparation.service';

describe('PreparationService', () => {
  it('returns only approved subjects and de-duplicates historical cycles', async () => {
    const database = { examSubject: { findMany: jest.fn(async () => [
      { code: 'CS', name: 'Computer Science', status: PatternStatus.PUBLISHED, examCycle: { code: '2026-JUNE' } },
      { code: 'CS', name: 'Computer Science', status: PatternStatus.APPROVED, examCycle: { code: '2025-DECEMBER' } },
    ]) } };
    const result = await new PreparationService(database as unknown as PrismaService).subjects('UGC_NET');
    expect(result.data).toEqual([{ code: 'CS', name: 'Computer Science', status: PatternStatus.PUBLISHED, historicalCycles: ['2026-JUNE', '2025-DECEMBER'] }]);
    expect(database.examSubject.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: [PatternStatus.APPROVED, PatternStatus.PUBLISHED] } }) }));
  });

  it('returns a rights-safe empty state when no published syllabus exists', async () => {
    const database = { syllabusVersion: { findFirst: jest.fn(async () => null) } };
    const result = await new PreparationService(database as unknown as PrismaService).syllabus('UGC_NET', 'PAPER_I');
    expect(result).toMatchObject({ available: false, reason: 'SYLLABUS_EVIDENCE_PENDING' });
  });

  it('queries published forms only and never returns answer-key fields', async () => {
    const database = { testForm: { findMany: jest.fn(async () => [{ id: 'form-1', subjectCode: 'CS', version: 1, snapshot: { publication: { status: 'READY', officialEvidenceVerified: true, contentInventoryQualified: true, rightsCleared: true, reviewerApproved: true, regressionEvidence: ['regression-1'] } }, snapshotHash: 'hash', publishedAt: null, examCycle: { code: '2026' }, patternVersion: { id: 'pattern-1', version: 1, ruleHash: 'rule', status: PatternStatus.PUBLISHED }, questions: [{ answerKeyVersionId: 'key-1' }] }]) } };
    const result = await new PreparationService(database as unknown as PrismaService).mocks('UGC_NET', 'CS');
    expect(result.available).toBe(true);
    expect(result.data[0]).not.toHaveProperty('answerKey');
    expect(database.testForm.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: TestFormStatus.PUBLISHED, patternVersion: { status: PatternStatus.PUBLISHED } }) }));
  });

  it('restricts PYQ queries to published active records with cleared rights', async () => {
    const database = {
      historicalQuestionMetadata: { findMany: jest.fn(async () => []) },
    };
    await new PreparationService(database as unknown as PrismaService).pyqs('UGC_NET', { year: '2025' });
    expect(database.historicalQuestionMetadata.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        verificationStatus: HistoricalMetadataVerificationStatus.VERIFIED,
        publicationEligible: true,
        rightsStatus: { in: [RightsStatus.OWNED, RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED, RightsStatus.PUBLIC_DOMAIN] },
      }),
    }));
  });

  it('uses explicit historical metadata and deterministic pagination without answer-key leakage', async () => {
    const database = { historicalQuestionMetadata: { findMany: jest.fn(async () => [{ id: 'meta-1', questionVersionId: 'version-1', examCycle: { code: '2025-JUNE' }, authority: 'NTA', sourceYear: 2025, historicalCycle: 'JUNE', session: 'SHIFT_1', paper: 'PAPER_II', subjectCode: 'CS', questionPaperReference: 'paper-ref', questionSequence: 4, languageCode: 'en', sourceReference: 'official-ref', sourceChecksum: 'sha256', answerKeyProvenance: 'official-key-ref', rightsStatus: RightsStatus.OWNED, rightsScope: { use: 'practice' }, questionVersion: { publishedAt: new Date('2025-06-01'), reviews: [{ reviewerId: 'one' }, { reviewerId: 'two' }], answerKeys: [{ id: 'key' }], explanations: [{ id: 'explanation' }], mappings: [{ syllabusTopicId: 'topic' }], publication: { status: 'ACTIVE' } } }]) } };
    const result = await new PreparationService(database as unknown as PrismaService).pyqs('UGC_NET', { page: '2', pageSize: '1', session: 'SHIFT_1' });
    expect(result.pagination).toMatchObject({ page: 2, pageSize: 1, hasNextPage: false });
    expect(result.data[0]).toMatchObject({ year: 2025, session: 'SHIFT_1', questionSequence: 4 });
    expect(result.data[0]).not.toHaveProperty('correctAnswers');
    expect(database.historicalQuestionMetadata.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 2, orderBy: [{ sourceYear: 'desc' }, { questionSequence: 'asc' }, { id: 'asc' }] }));
  });

  it('reports verified and publication-ready inventory for administrators', async () => {
    const database = { historicalQuestionMetadata: { findMany: jest.fn(async () => [{ verificationStatus: HistoricalMetadataVerificationStatus.VERIFIED, publicationEligible: true, rightsStatus: RightsStatus.LICENSED, revokedAt: null, sourceYear: 2025, session: 'SHIFT_1', paper: 'PAPER_II', subjectCode: 'CS', languageCode: 'en', examCycle: { code: '2025-JUNE', examination: { code: 'UGC_NET', family: 'UGC_NET' } }, questionVersion: { status: 'PUBLISHED', publication: { status: 'ACTIVE' }, reviews: [{ reviewerId: 'one' }, { reviewerId: 'two' }], answerKeys: [{ id: 'key' }], explanations: [{ id: 'explanation' }], mappings: [{ id: 'mapping' }] } }]) } };
    const result = await new PreparationService(database as unknown as PrismaService).historicalInventoryReadiness('UGC_NET');
    expect(result.counts).toMatchObject({ totalMetadata: 1, verified: 1, publicationEligible: 1, rightsCleared: 1, published: 1, ready: 1 });
    expect(result.byScope[0]).toMatchObject({ examinationCode: 'UGC_NET', ready: 1 });
  });

  it('computes topic practice from qualified persisted evidence', async () => {
    const database = {
      syllabusVersion: { findFirst: jest.fn(async () => ({ id: 'syllabus-1', title: 'Paper I', version: 1, subjectCode: 'PAPER_I', examCycle: { code: '2026' }, units: [{ id: 'unit-1', code: 'UNIT_1', title: 'Unit 1', topics: [{ id: 'topic-1', code: 'TOPIC_1', title: 'Topic 1', children: [] }] }] })) },
      questionVersion: { findMany: jest.fn(async () => [{ id: 'revision-1', mappings: [{ syllabusTopicId: 'topic-1' }], answerKeys: [{ id: 'key-1' }], explanations: [{ id: 'explanation-1' }], provenance: [{ rightsStatus: RightsStatus.LICENSED }], reviews: [{ reviewerId: 'reviewer-a' }, { reviewerId: 'reviewer-b' }], publication: { status: 'ACTIVE' } }]) },
    };
    const result = await new PreparationService(database as unknown as PrismaService).practice('UGC_NET', 'PAPER_I');
    expect(result).toMatchObject({ available: true, topics: [{ topicId: 'topic-1', questionCount: 1, available: true }] });
  });
});
