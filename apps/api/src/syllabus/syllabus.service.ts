import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEventType, SyllabusStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface SyllabusInput { title: string; version: number; }
interface UnitInput { code: string; title: string; sequence: number; }
interface TopicInput { code: string; title: string; sequence: number; parentCode?: string; }

@Injectable()
export class SyllabusService {
  constructor(private readonly database: PrismaService) {}

  async create(examinationCode: string, cycleCode: string, subjectCode: string, input: unknown, actorId: string) {
    const value = this.parseSyllabus(input);
    const subject = await this.database.examSubject.findFirst({
      where: { code: subjectCode.trim().toUpperCase(), examCycle: { code: cycleCode.trim(), examination: { code: examinationCode.trim().toUpperCase() } } },
      include: { examCycle: true },
    });
    if (!subject) throw new NotFoundException('Examination cycle subject not found');
    try {
      const created = await this.database.$transaction(async (tx) => {
        const syllabus = await tx.syllabusVersion.create({ data: { examCycleId: subject.examCycleId, subjectCode: subject.code, title: value.title, version: value.version, createdById: actorId } });
        await tx.auditEvent.create({ data: { type: AuditEventType.SYLLABUS_VERSION_CREATED, accountId: actorId, metadata: { syllabusVersionId: syllabus.id, examinationCode: examinationCode.trim().toUpperCase(), cycleCode: subject.examCycle.code, subjectCode: subject.code } } });
        return syllabus;
      });
      return { id: created.id, subjectCode: created.subjectCode, version: created.version, title: created.title, status: created.status };
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('That syllabus version already exists');
      throw error;
    }
  }

  async addUnit(examinationCode: string, cycleCode: string, subjectCode: string, syllabusId: string, input: unknown, actorId: string) {
    const value = this.parseUnit(input);
    const syllabus = await this.requireDraft(examinationCode, cycleCode, subjectCode, syllabusId);
    try {
      const unit = await this.database.$transaction(async (tx) => {
        const created = await tx.subjectUnit.create({ data: { syllabusVersionId: syllabus.id, code: value.code, title: value.title, sequence: value.sequence } });
        await tx.auditEvent.create({ data: { type: AuditEventType.SYLLABUS_TAXONOMY_UPDATED, accountId: actorId, metadata: { syllabusVersionId: syllabus.id, unitId: created.id, event: 'UNIT_CREATED' } } });
        return created;
      });
      return unit;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('That unit code already exists in the syllabus');
      throw error;
    }
  }

  async addTopic(examinationCode: string, cycleCode: string, subjectCode: string, syllabusId: string, unitCode: string, input: unknown, actorId: string) {
    const value = this.parseTopic(input);
    const unit = await this.database.subjectUnit.findFirst({ where: { syllabusVersionId: syllabusId, code: unitCode.trim().toUpperCase(), syllabusVersion: { subjectCode: subjectCode.trim().toUpperCase(), examCycle: { code: cycleCode.trim(), examination: { code: examinationCode.trim().toUpperCase() } } } }, include: { syllabusVersion: true } });
    if (!unit) throw new NotFoundException('Syllabus unit not found');
    if (unit.syllabusVersion.status !== SyllabusStatus.DRAFT) throw new ConflictException('Only draft syllabi can be edited');
    let parentId: string | undefined;
    if (value.parentCode) {
      const parent = await this.database.syllabusTopic.findFirst({ where: { subjectUnitId: unit.id, code: value.parentCode } });
      if (!parent) throw new BadRequestException('Parent topic must belong to the same unit');
      parentId = parent.id;
    }
    try {
      const topic = await this.database.$transaction(async (tx) => {
        const created = await tx.syllabusTopic.create({ data: { subjectUnitId: unit.id, code: value.code, title: value.title, sequence: value.sequence, ...(parentId ? { parentId } : {}) } });
        await tx.auditEvent.create({ data: { type: AuditEventType.SYLLABUS_TAXONOMY_UPDATED, accountId: actorId, metadata: { syllabusVersionId: syllabusId, unitId: unit.id, topicId: created.id, event: 'TOPIC_CREATED' } } });
        return created;
      });
      return topic;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('That topic code already exists in the unit');
      throw error;
    }
  }

  async getPublished(examinationCode: string, cycleCode: string, subjectCode: string, syllabusId: string) {
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { id: syllabusId, status: SyllabusStatus.PUBLISHED, subjectCode: subjectCode.trim().toUpperCase(), examCycle: { code: cycleCode.trim(), examination: { code: examinationCode.trim().toUpperCase() } } }, include: { units: { orderBy: { sequence: 'asc' }, include: { topics: { orderBy: { sequence: 'asc' }, include: { children: { orderBy: { sequence: 'asc' } } } } } } } });
    if (!syllabus) throw new NotFoundException('Published syllabus not found');
    return syllabus;
  }

  async getAuthoring(examinationCode: string, cycleCode: string, subjectCode: string, syllabusId: string) {
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { id: syllabusId, subjectCode: subjectCode.trim().toUpperCase(), examCycle: { code: cycleCode.trim(), examination: { code: examinationCode.trim().toUpperCase() } } }, include: { units: { orderBy: { sequence: 'asc' }, include: { topics: { orderBy: { sequence: 'asc' } } } } } });
    if (!syllabus) throw new NotFoundException('Syllabus not found');
    return syllabus;
  }

  private async requireDraft(examinationCode: string, cycleCode: string, subjectCode: string, id: string) {
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { id, subjectCode: subjectCode.trim().toUpperCase(), examCycle: { code: cycleCode.trim(), examination: { code: examinationCode.trim().toUpperCase() } } } });
    if (!syllabus) throw new NotFoundException('Syllabus not found');
    if (syllabus.status !== SyllabusStatus.DRAFT) throw new ConflictException('Only draft syllabi can be edited');
    return syllabus;
  }

  private parseSyllabus(input: unknown): SyllabusInput {
    const value = this.record(input);
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const version = this.integer(value.version);
    if (!title || title.length > 240 || version < 1 || version > 10000) throw new BadRequestException('Invalid syllabus version data');
    return { title, version };
  }

  private parseUnit(input: unknown): UnitInput {
    const value = this.record(input);
    const code = this.code(value.code, 80);
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const sequence = this.integer(value.sequence);
    if (!code || !title || title.length > 240 || sequence < 0) throw new BadRequestException('Invalid syllabus unit data');
    return { code, title, sequence };
  }

  private parseTopic(input: unknown): TopicInput {
    const value = this.record(input);
    const code = this.code(value.code, 100);
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const sequence = this.integer(value.sequence);
    const parentCode = typeof value.parentCode === 'string' ? this.code(value.parentCode, 100) : undefined;
    if (!code || !title || title.length > 300 || sequence < 0) throw new BadRequestException('Invalid syllabus topic data');
    return { code, title, sequence, ...(parentCode ? { parentCode } : {}) };
  }

  private record(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object') throw new BadRequestException('Payload is required'); return input as Record<string, unknown>; }
  private code(input: unknown, max: number): string { const code = typeof input === 'string' ? input.trim().toUpperCase() : ''; return new RegExp(`^[A-Z0-9][A-Z0-9_.-]{0,${max - 1}}$`).test(code) ? code : ''; }
  private integer(input: unknown): number { return typeof input === 'number' && Number.isSafeInteger(input) ? input : Number.NaN; }
  private isUniqueError(error: unknown): boolean { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }
}
