import { HistoricalMetadataImportStatus } from '../generated/prisma/client';
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
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.json', sourceChecksum: 'a'.repeat(64), format: 'JSON', records: [{ questionVersionId: 'not-a-uuid' }] });
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
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.json', sourceChecksum: 'b'.repeat(64), format: 'JSON', records: [] });
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
    const result = await service.dryRun('admin-1', { sourceName: 'qa-fixture.csv', sourceChecksum: 'c'.repeat(64), format: 'CSV', csv: 'questionVersionId,sourceChecksum\ninvalid,' + 'c'.repeat(64) });
    expect(result.rejectedCount).toBe(1);
    expect(result.rows![0].rowNumber).toBe(1);
  });
});
