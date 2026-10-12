import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SyllabusService } from './syllabus.service';

interface UnitTransaction {
  subjectUnit: { create: jest.Mock };
  auditEvent: { create: jest.Mock };
}

interface MockDatabase {
  examSubject: { findFirst: jest.Mock };
  syllabusVersion: { create: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock };
  subjectUnit: { create: jest.Mock; findFirst: jest.Mock };
  syllabusTopic: { create: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
}

describe('SyllabusService', () => {
  const database: MockDatabase = {
    examSubject: { findFirst: jest.fn() },
    syllabusVersion: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    subjectUnit: { create: jest.fn(), findFirst: jest.fn() },
    syllabusTopic: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new SyllabusService(database as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('rejects malformed syllabus metadata before database access', async () => {
    await expect(service.create('UGC-NET', '2026-JUNE', 'PAPER_1', { title: '', version: 0 }, 'actor')).rejects.toBeInstanceOf(BadRequestException);
    expect(database.examSubject.findFirst).not.toHaveBeenCalled();
  });

  it('requires the subject to belong to the requested examination cycle', async () => {
    database.examSubject.findFirst.mockResolvedValue(null);
    await expect(service.create('UGC-NET', '2026-JUNE', 'PAPER_1', { title: 'Research methods', version: 1 }, 'actor')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate unit creation to a conflict', async () => {
    database.syllabusVersion.findFirst.mockResolvedValue({ id: 'syllabus', status: 'DRAFT' });
    database.$transaction.mockImplementation(async (callback: (tx: UnitTransaction) => Promise<unknown>) => callback({
      subjectUnit: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) },
      auditEvent: { create: jest.fn() },
    }));
    await expect(service.addUnit('EXAM', 'CYCLE', 'SUBJECT', 'syllabus', { code: 'UNIT_1', title: 'Foundations', sequence: 0 }, 'actor')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow a parent topic from another unit', async () => {
    database.subjectUnit.findFirst.mockResolvedValue({ id: 'unit', syllabusVersion: { status: 'DRAFT' } });
    database.syllabusTopic.findFirst.mockResolvedValue(null);
    await expect(service.addTopic('EXAM', 'CYCLE', 'SUBJECT', 'syllabus', 'UNIT_1', { code: 'TOPIC_2', title: 'Child', sequence: 1, parentCode: 'TOPIC_1' }, 'actor')).rejects.toBeInstanceOf(BadRequestException);
  });
});
