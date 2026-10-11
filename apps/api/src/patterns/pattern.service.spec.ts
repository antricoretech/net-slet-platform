import { BadRequestException, ConflictException } from '@nestjs/common';
import { PatternApprovalDecision, PatternStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { canonicalJson, PatternService, ruleHash } from './pattern.service';

const validRules = {
  sections: [{ key: 'PAPER_I', durationSeconds: 60, offeredQuestions: 10, maximumAttempts: 5 }],
};

describe('PatternService', () => {
  it('produces a stable checksum independent of object key order', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(ruleHash({ sections: validRules.sections })).toBe(ruleHash({ sections: [...validRules.sections] }));
  });

  it('rejects an invalid blueprint before opening a write transaction', async () => {
    const database = {
      examination: { findUnique: jest.fn(async () => ({ id: 'exam-1', code: 'UGC_NET' })) },
      $transaction: jest.fn(),
    };
    const service = new PatternService(database as unknown as PrismaService);

    await expect(service.createDraft('UGC_NET', { cycleCode: '2026', subjectCode: 'CS', version: 1, rules: { sections: [] } }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('converts duplicate cycle, subject and version conflicts into a client error', async () => {
    const database = {
      examination: { findUnique: jest.fn(async () => ({ id: 'exam-1', code: 'UGC_NET' })) },
      $transaction: jest.fn(async () => { throw { code: 'P2002' }; }),
    };
    const service = new PatternService(database as unknown as PrismaService);

    await expect(service.createDraft('UGC_NET', { cycleCode: '2026', subjectCode: 'CS', version: 1, rules: validRules }, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires evidence before approval and blocks non-draft review', async () => {
    const database = {
      examPatternVersion: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'pattern-1', status: PatternStatus.SME_REVIEWED, evidence: null, rules: validRules, ruleHash: ruleHash(validRules) })
          .mockResolvedValueOnce({ id: 'pattern-2', status: PatternStatus.PUBLISHED, evidence: {}, rules: validRules, ruleHash: ruleHash(validRules) }),
      },
    };
    const service = new PatternService(database as unknown as PrismaService);

    await expect(service.approve('UGC_NET', 'pattern-1', undefined, 'sme-1', PatternApprovalDecision.APPROVED)).rejects.toThrow('evidence');
    await expect(service.approve('UGC_NET', 'pattern-2', undefined, 'sme-1', PatternApprovalDecision.APPROVED)).rejects.toThrow('Only submitted patterns');
  });

  it('blocks publication until an approved draft has matching review evidence', async () => {
    const database = {
      examPatternVersion: {
        findFirst: jest.fn(async () => ({ id: 'pattern-1', status: PatternStatus.DRAFT, evidence: null, approvals: [], rules: validRules, ruleHash: ruleHash(validRules) })),
      },
    };
    const service = new PatternService(database as unknown as PrismaService);

    await expect(service.publish('UGC_NET', 'pattern-1', 'admin-1')).rejects.toThrow('Only approved patterns');
  });

  it('publishes a subject-specific snapshot and supersedes only the same subject', async () => {
    const prior = { id: 'prior', status: PatternStatus.PUBLISHED };
    const transaction = {
      examPatternVersion: {
        findMany: jest.fn(async () => [prior]),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pattern-1', status: data.status, publishedAt: new Date() })),
      },
      auditEvent: { create: jest.fn(async () => undefined) },
    };
    const database = {
      examPatternVersion: {
        findFirst: jest.fn(async () => ({
          id: 'pattern-1', status: PatternStatus.APPROVED, examCycleId: 'cycle-1', subjectCode: 'CS',
          evidence: { regressionReportId: 'reg-1' }, approvals: [{ decision: PatternApprovalDecision.APPROVED, ruleHash: ruleHash(validRules) }],
          rules: validRules, ruleHash: ruleHash(validRules),
        })),
      },
      $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    };
    const service = new PatternService(database as unknown as PrismaService);

    await service.publish('UGC_NET', 'pattern-1', 'admin-1');
    expect(transaction.examPatternVersion.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'prior' }, data: { status: PatternStatus.SUPERSEDED } }));
    expect(transaction.examPatternVersion.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: 'pattern-1' }, data: expect.objectContaining({ status: PatternStatus.PUBLISHED, publishedSnapshot: validRules }) }));
  });

  it('scopes public pattern detail reads to the requested examination', async () => {
    const findFirst = jest.fn(async () => undefined);
    const service = new PatternService({ examPatternVersion: { findFirst } } as unknown as PrismaService);

    await expect(service.getPublished('CSIR_NET', 'pattern-1')).rejects.toThrow('Published pattern not found');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'pattern-1', status: PatternStatus.PUBLISHED, examCycle: { examination: { code: 'CSIR_NET' } } }) }));
  });
});
