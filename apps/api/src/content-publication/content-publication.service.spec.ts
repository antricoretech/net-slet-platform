import { ConflictException } from '@nestjs/common';
import { PatternStatus, TestFormStatus } from '../generated/prisma/client';
import { ContentPublicationService } from './content-publication.service';

const pattern = (overrides: Record<string, unknown> = {}) => ({
  id: 'pattern-1', status: PatternStatus.RESEARCH_ONLY, ruleHash: null, rules: { examCode: 'UGC_NET', cycleCode: '2026', subjectCode: 'CS' },
  evidence: null, approvals: [], examCycle: { id: 'cycle-1', code: '2026', examination: { code: 'UGC_NET' } }, ...overrides,
});

describe('ContentPublicationService', () => {
  it('keeps research-only patterns blocked for official publication', async () => {
    const database = { examPatternVersion: { findUnique: jest.fn().mockResolvedValue(pattern()) } };
    const result = await new ContentPublicationService(database as never).patternReadiness('pattern-1');
    expect(result.officialEligible).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['Authoritative pattern evidence is missing']));
  });

  it('does not compile a form from an unapproved pattern', async () => {
    const database = { examPatternVersion: { findUnique: jest.fn().mockResolvedValue(pattern()) } };
    await expect(new ContentPublicationService(database as never).compileDraft('pattern-1', { selections: [{ questionVersionId: 'q-1', sectionKey: 'MAIN' }] }, 'admin-1')).rejects.toThrow(ConflictException);
  });

  it('publishes an explicit QA-only form idempotently', async () => {
    const form = { id: 'form-1', status: TestFormStatus.DRAFT, publishedAt: null, snapshotHash: 'hash-1', snapshot: { publication: { qaOnly: true } }, patternVersion: { status: PatternStatus.APPROVED }, questions: [] };
    const database = {
      testForm: { findUnique: jest.fn().mockResolvedValueOnce(form).mockResolvedValueOnce({ ...form, status: TestFormStatus.PUBLISHED, publishedAt: new Date() }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new ContentPublicationService(database as never);
    const published = await service.publish('form-1', 'admin-1');
    expect(published.status).toBe(TestFormStatus.PUBLISHED);
    expect(database.testForm.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ snapshotHash: 'hash-1' }) }));
    const alreadyPublished = await service.publish('form-1', 'admin-1');
    expect(alreadyPublished.idempotent).toBe(true);
  });

  it('qualifies only active, fully governed published revisions', async () => {
    const database = {
      examPatternVersion: { findUnique: jest.fn().mockResolvedValue(pattern({ status: PatternStatus.APPROVED, examCycle: { id: 'cycle-1', code: '2026', examination: { code: 'UGC_NET' } } })) },
      questionVersion: { findMany: jest.fn().mockResolvedValue([{ id: 'qv-1', questionId: 'q-1', version: 1, authoredById: 'author', languageCode: 'en', groupId: null, publication: { status: 'ACTIVE', contentHash: 'hash' }, answerKeys: [{ id: 'key-1' }], explanations: [{ id: 'exp-1' }], mappings: [{ syllabusTopicId: 'topic-1' }], provenance: [{ rightsStatus: 'OWNED' }], licences: [], translations: [], reviews: [{ reviewerId: 'sme-1', decision: 'APPROVED' }, { reviewerId: 'admin-1', decision: 'APPROVED' }] }]) },
    };
    const result = await new ContentPublicationService(database as never).qualifyInventory('pattern-1', { requiredLanguages: ['en'] });
    expect(result.eligible).toBe(true);
    expect(result.qualified[0].answerKeyVersionId).toBe('key-1');
  });
});
