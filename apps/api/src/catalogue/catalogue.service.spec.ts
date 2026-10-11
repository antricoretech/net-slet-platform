import { BadRequestException } from '@nestjs/common';
import { ExamFamilyCode, JurisdictionType } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CatalogueService } from './catalogue.service';

describe('CatalogueService', () => {
  it('returns allowlisted public fields with bounded pagination', async () => {
    const database = {
      examination: {
        findMany: jest.fn(async () => [{
          id: 'exam-1', code: 'UGC_NET', name: 'UGC NET', family: ExamFamilyCode.UGC_NET,
          organizer: { code: 'NTA', name: 'National Testing Agency', officialWebsite: 'https://nta.example' },
          jurisdictions: [{ jurisdiction: { code: 'IN', name: 'India', type: JurisdictionType.NATIONAL } }],
          rules: { secret: true },
        }]),
        count: jest.fn(async () => 1),
      },
    };
    const service = new CatalogueService(database as unknown as PrismaService);
    const result = await service.listPublic({ page: '999999', pageSize: '999999', search: 'ugc', family: 'UGC_NET' });
    expect(result.pagination).toEqual({ page: 10000, pageSize: 50, total: 1, totalPages: 1 });
    expect(result.data[0]).toEqual({ id: 'exam-1', code: 'UGC_NET', name: 'UGC NET', family: 'UGC_NET', organizer: { code: 'NTA', name: 'National Testing Agency', officialWebsite: 'https://nta.example' }, jurisdictions: [{ code: 'IN', name: 'India', type: 'NATIONAL' }] });
    expect(result.data[0]).not.toHaveProperty('rules');
  });

  it('rejects an unknown examination family before querying', async () => {
    const database = { examination: { findMany: jest.fn(), count: jest.fn() } };
    const service = new CatalogueService(database as unknown as PrismaService);
    await expect(service.listPublic({ family: 'MADE_UP' })).rejects.toBeInstanceOf(BadRequestException);
    expect(database.examination.findMany).not.toHaveBeenCalled();
  });

  it('creates an examination and records an admin audit event', async () => {
    type Transaction = {
      examOrganizer: { upsert: jest.Mock };
      jurisdiction: { upsert: jest.Mock };
      examination: { create: jest.Mock };
      auditEvent: { create: jest.Mock };
    };
    const transaction: Transaction = {
      examOrganizer: { upsert: jest.fn(async () => ({ id: 'organizer-1', code: 'NTA', name: 'National Testing Agency', officialWebsite: null })) },
      jurisdiction: { upsert: jest.fn(async () => ({ id: 'jurisdiction-1', code: 'IN', name: 'India', type: JurisdictionType.NATIONAL })) },
      examination: { create: jest.fn(async () => ({ id: 'exam-1', code: 'UGC_NET', name: 'UGC NET', family: ExamFamilyCode.UGC_NET, organizer: { code: 'NTA', name: 'National Testing Agency', officialWebsite: null }, jurisdictions: [{ jurisdiction: { code: 'IN', name: 'India', type: JurisdictionType.NATIONAL } }] })) },
      auditEvent: { create: jest.fn(async () => undefined) },
    };
    const database = {
      $transaction: jest.fn(async (callback: (value: Transaction) => unknown) => callback(transaction)),
    };
    const service = new CatalogueService(database as unknown as PrismaService);
    const result = await service.create({ code: 'UGC_NET', name: 'UGC NET', family: 'UGC_NET', organizer: { code: 'NTA', name: 'National Testing Agency' }, jurisdictions: [{ code: 'IN', name: 'India', type: 'NATIONAL' }] }, 'admin-1');
    expect(result.code).toBe('UGC_NET');
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accountId: 'admin-1' }) }));
  });

});
