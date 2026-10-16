import { ForbiddenException } from '@nestjs/common';
import { AccountRole, HistoricalMetadataGovernanceStatus, RightsStatus } from '../generated/prisma/client';
import { HistoricalPyqGovernanceService } from './historical-pyq-governance.service';

const metadata = (status: HistoricalMetadataGovernanceStatus = HistoricalMetadataGovernanceStatus.VALIDATED) => ({
  id: 'metadata-1', questionVersionId: 'version-1', governanceStatus: status, recordStatus: 'VALIDATED', verificationStatus: 'UNVERIFIED', publicationEligible: false, revokedAt: null,
  rightsStatus: RightsStatus.LICENSED, rightsExpiresAt: null, rightsScope: { allowedUses: ['PYQ_DISCOVERY', 'QUESTION_DISPLAY', 'PRACTICE_USE', 'MOCK_USE'], languages: ['en'] },
  sourceReference: 'official-source', sourceChecksum: 'sha256:source', subjectCode: 'CS', examinationFamily: 'UGC_NET',
  examCycle: { examination: { family: 'UGC_NET' } }, importRows: [{ import: { createdById: 'importer-1' } }],
  questionVersion: { authoredById: 'author-1', status: 'PUBLISHED', publication: { status: 'ACTIVE' }, answerKeys: [{}], explanations: [{}], mappings: [{}], question: { subjectCode: 'CS' } },
  governanceApprovals: [],
});

describe('HistoricalPyqGovernanceService', () => {
  const tx = { governanceApproval: { create: jest.fn() }, historicalQuestionMetadata: { update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, auditEvent: { create: jest.fn() }, account: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: AccountRole.ADMIN }) } };
  const database = { historicalQuestionMetadata: { findUnique: jest.fn() }, account: { findUnique: jest.fn().mockResolvedValue({ role: AccountRole.ADMIN }) }, $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
  const service = new HistoricalPyqGovernanceService(database as never);
  beforeEach(() => { jest.clearAllMocks(); database.historicalQuestionMetadata.findUnique.mockResolvedValue(metadata()); });

  it('rejects importer self academic review', async () => {
    await expect(service.academicallyReview('metadata-1', 'importer-1', { evidenceReference: 'review-1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires academic review before rights verification', async () => {
    await expect(service.verifyRights('metadata-1', 'rights-1', { evidenceReference: 'rights-1' })).rejects.toThrow('Independent academic review is required first');
  });

  it('requires explicit consumption rights for publication eligibility', async () => {
    database.historicalQuestionMetadata.findUnique.mockResolvedValue(metadata(HistoricalMetadataGovernanceStatus.APPROVED));
    const value = metadata(HistoricalMetadataGovernanceStatus.APPROVED);
    value.rightsScope = { allowedUses: ['PYQ_DISCOVERY'], languages: ['en'] };
    database.historicalQuestionMetadata.findUnique.mockResolvedValue(value);
    await expect(service.makePublicationEligible('metadata-1', 'admin-2', { evidenceReference: 'publication-1' })).rejects.toThrow('Display, practice and mock rights are all required');
  });

  it('records an independent academic decision in the governance ledger', async () => {
    const result = await service.academicallyReview('metadata-1', 'sme-1', { evidenceReference: 'academic-1', sourceVerification: 'source-check' });
    expect(result.governanceStatus).toBe(HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED);
    expect(tx.governanceApproval.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ targetHistoricalMetadataId: 'metadata-1', reviewerId: 'sme-1' }) }));
  });
});
