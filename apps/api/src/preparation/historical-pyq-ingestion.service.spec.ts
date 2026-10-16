import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { HistoricalMetadataImportStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { HistoricalPyqIngestionService } from './historical-pyq-ingestion.service';

describe('HistoricalPyqIngestionService', () => {
  it('dry-runs malformed or academically incompatible rows and records rejection evidence', async () => {
    const transaction = {
      historicalMetadataImport: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'manifest-1', ...data })) },
      auditEvent: { create: jest.fn(async () => undefined) },
    };
    const database = {
      historicalMetadataImport: { findUnique: jest.fn(async () => null) },
      questionVersion: { findMany: jest.fn(async () => []) },
      historicalQuestionMetadata: { findMany: jest.fn(async () => []) },
      contentLicence: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    const sourceChecksum = createHash('sha256').update('{"questionVersionId":"not-a-uuid"}').digest('hex');
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.json', sourceChecksum, format: 'JSON', records: [{ questionVersionId: 'not-a-uuid' }] });
    expect(result.status).toBe(HistoricalMetadataImportStatus.PARTIAL_REJECTED);
    expect(result.rejectedCount).toBe(1);
    expect(result.rows![0].reasons).toEqual(expect.arrayContaining(['QUESTION_VERSION_ID_INVALID', 'QUESTION_VERSION_NOT_FOUND', 'RIGHTS_SCOPE_INCOMPLETE']));
    expect(transaction.auditEvent.create).toHaveBeenCalled();
  });

  it('returns an identical manifest without creating a second import', async () => {
    const database = {
      historicalMetadataImport: { findUnique: jest.fn(async () => ({ id: 'manifest-1', status: HistoricalMetadataImportStatus.VALIDATED, rowCount: 0, acceptedCount: 0, rejectedCount: 0, duplicateCount: 0 })) },
    };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    const sourceChecksum = createHash('sha256').update('[]').digest('hex');
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.json', sourceChecksum, format: 'JSON', records: [] });
    expect(result).toMatchObject({ manifestId: 'manifest-1', idempotent: true });
  });

  it('accepts CSV input only through the same validation path', async () => {
    const transaction = {
      historicalMetadataImport: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'manifest-csv', ...data })) },
      auditEvent: { create: jest.fn(async () => undefined) },
    };
    const database = {
      historicalMetadataImport: { findUnique: jest.fn(async () => null) },
      questionVersion: { findMany: jest.fn(async () => []) },
      historicalQuestionMetadata: { findMany: jest.fn(async () => []) },
      contentLicence: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    const sourceChecksum = createHash('sha256').update('{"questionVersionId":"invalid"}').digest('hex');
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.csv', sourceChecksum, format: 'CSV', csv: 'questionVersionId,sourceChecksum\ninvalid,' + sourceChecksum });
    expect(result.rejectedCount).toBe(1);
    expect(result.rows![0].rowNumber).toBe(1);
  });

  it('parses quoted commas, escaped quotes and embedded newlines under the canonical checksum contract', async () => {
    const sourceName = 'Official, "June"\nEvidence';
    const sourceChecksum = createHash('sha256').update(`[{"questionVersionId":"invalid","sourceName":${JSON.stringify(sourceName)}}]`).digest('hex');
    const transaction = { historicalMetadataImport: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'manifest-csv', ...data })) }, auditEvent: { create: jest.fn(async () => undefined) } };
    const database = { historicalMetadataImport: { findUnique: jest.fn(async () => null) }, questionVersion: { findMany: jest.fn(async () => []) }, historicalQuestionMetadata: { findMany: jest.fn(async () => []) }, contentLicence: { findMany: jest.fn(async () => []) }, $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    const csv = `questionVersionId,sourceChecksum,sourceName\ninvalid,${sourceChecksum},"${sourceName.replaceAll('"', '""')}"`;
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.csv', sourceChecksum, format: 'CSV', csv });
    expect(result.rowCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
  });

  it('rejects duplicate headers and malformed quoted rows', async () => {
    const database = { historicalMetadataImport: { findUnique: jest.fn(async () => null) } };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    const checksum = 'a'.repeat(64);
    await expect(service.dryRun('admin-1', { sourceName: 'bad.csv', sourceChecksum: checksum, format: 'CSV', csv: 'questionVersionId,QuestionVersionId\nfoo,bar' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.dryRun('admin-1', { sourceName: 'bad.csv', sourceChecksum: checksum, format: 'CSV', csv: 'questionVersionId,sourceChecksum\n"unterminated,' + checksum })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recovers a concurrent duplicate manifest creation as an idempotent retry', async () => {
    const sourceChecksum = createHash('sha256').update('[]').digest('hex');
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate manifest', { code: 'P2002', clientVersion: '7.0.0' });
    const database = {
      historicalMetadataImport: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'manifest-raced', status: HistoricalMetadataImportStatus.VALIDATED, rowCount: 0, acceptedCount: 0, rejectedCount: 0, duplicateCount: 0 }) },
      questionVersion: { findMany: jest.fn(async () => []) }, historicalQuestionMetadata: { findMany: jest.fn(async () => []) }, contentLicence: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async () => { throw duplicate; }),
    };
    const service = new HistoricalPyqIngestionService(database as unknown as PrismaService);
    await expect(service.dryRun('admin-1', { sourceName: 'same.json', sourceChecksum, format: 'JSON', records: [] })).resolves.toMatchObject({ manifestId: 'manifest-raced', idempotent: true });
  });
});
