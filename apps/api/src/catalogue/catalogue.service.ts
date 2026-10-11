import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEventType, ExamFamilyCode, JurisdictionType, PatternStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

const FAMILY_VALUES = Object.values(ExamFamilyCode);
const JURISDICTION_VALUES = Object.values(JurisdictionType);

interface OrganizerInput { code: string; name: string; officialWebsite?: string; }
interface JurisdictionInput { code: string; name: string; type: JurisdictionType; }
interface CatalogueInput { code: string; name: string; family: ExamFamilyCode; organizer: OrganizerInput; jurisdictions: JurisdictionInput[]; }
interface PublicExam {
  id: string;
  code: string;
  name: string;
  family: ExamFamilyCode;
  organizer: { code: string; name: string; officialWebsite: string | null };
  jurisdictions: Array<{ jurisdiction: { code: string; name: string; type: JurisdictionType } }>;
}
interface PublicExamDetail extends PublicExam { cycles: Array<{ code: string; subjects: Array<{ code: string; name: string; status: PatternStatus }>; versions: Array<{ status: string }> }> }

@Injectable()
export class CatalogueService {
  constructor(private readonly database: PrismaService) {}

  async listPublic(query: Record<string, unknown>) {
    const { page, pageSize, search, family } = this.parseListQuery(query);
    const where = {
      ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' as const } }, { name: { contains: search, mode: 'insensitive' as const } }] } : {}),
      ...(family ? { family } : {}),
    };
    const [items, total] = await Promise.all([
      this.database.examination.findMany({ where, include: { organizer: true, jurisdictions: { include: { jurisdiction: true } } }, orderBy: { code: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.database.examination.count({ where }),
    ]);
    return { data: items.map((item) => this.toPublicSummary(item)), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getPublic(code: string) {
    const item = await this.database.examination.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        organizer: true,
        jurisdictions: { include: { jurisdiction: true } },
        cycles: { include: { subjects: { select: { code: true, name: true, status: true }, orderBy: { code: 'asc' } }, versions: { select: { version: true, status: true }, orderBy: { version: 'desc' } } }, orderBy: { code: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('Examination not found');
    return this.toPublicDetail(item);
  }

  async listCycles(code: string) {
    const item = await this.database.examination.findUnique({ where: { code: code.trim().toUpperCase() }, include: { cycles: { include: { subjects: { select: { code: true, name: true, status: true }, orderBy: { code: 'asc' } }, versions: { select: { version: true, status: true }, orderBy: { version: 'desc' } } }, orderBy: { code: 'asc' } } } });
    if (!item) throw new NotFoundException('Examination not found');
    return item.cycles.map((cycle) => ({ code: cycle.code, subjects: cycle.subjects.map((subject) => ({ code: subject.code, name: subject.name, status: subject.status })), patternStatuses: [...new Set(cycle.versions.map((version) => version.status))] }));
  }

  async createSubject(examinationCode: string, cycleCode: string, input: unknown, actorId: string) {
    const exam = await this.database.examination.findUnique({ where: { code: examinationCode.trim().toUpperCase() } });
    if (!exam) throw new NotFoundException('Examination not found');
    const value = this.parseSubject(input);
    const subject = await this.database.$transaction(async (tx) => {
      const cycle = await tx.examCycle.upsert({ where: { examinationId_code: { examinationId: exam.id, code: cycleCode.trim() } }, update: {}, create: { examinationId: exam.id, code: cycleCode.trim() } });
      const created = await tx.examSubject.upsert({ where: { examCycleId_code: { examCycleId: cycle.id, code: value.code } }, update: { name: value.name }, create: { examCycleId: cycle.id, code: value.code, name: value.name, status: PatternStatus.RESEARCH_ONLY } });
      await tx.auditEvent.create({ data: { type: AuditEventType.CATALOGUE_EXAM_UPDATED, accountId: actorId, metadata: { examinationCode: exam.code, cycleCode: cycle.code, subjectCode: created.code, event: 'SUBJECT_CREATED_OR_UPDATED' } } });
      return created;
    });
    return { id: subject.id, examinationCode: exam.code, cycleCode: cycleCode.trim(), code: subject.code, name: subject.name, status: subject.status };
  }

  async create(input: unknown, actorId: string) {
    const value = this.parseCatalogueInput(input);
    try {
      return await this.database.$transaction(async (tx) => {
        const organizer = await tx.examOrganizer.upsert({ where: { code: value.organizer.code }, update: { name: value.organizer.name, officialWebsite: value.organizer.officialWebsite }, create: value.organizer });
        const jurisdictions = await Promise.all(value.jurisdictions.map((jurisdiction) => tx.jurisdiction.upsert({ where: { code: jurisdiction.code }, update: { name: jurisdiction.name, type: jurisdiction.type }, create: jurisdiction })));
        const examination = await tx.examination.create({ data: { code: value.code, name: value.name, family: value.family, organizerId: organizer.id, jurisdictions: { create: jurisdictions.map((jurisdiction) => ({ jurisdictionId: jurisdiction.id })) } }, include: { organizer: true, jurisdictions: { include: { jurisdiction: true } } } });
        await tx.auditEvent.create({ data: { type: AuditEventType.CATALOGUE_EXAM_CREATED, accountId: actorId, metadata: { examinationCode: examination.code, family: examination.family } } });
        return this.toPublicSummary(examination);
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('An examination with that code already exists');
      throw error;
    }
  }

  async update(code: string, input: unknown, actorId: string) {
    const existing = await this.database.examination.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!existing) throw new NotFoundException('Examination not found');
    const value = this.parseCatalogueInput({ ...(input as Record<string, unknown>), code: existing.code });
    try {
      return await this.database.$transaction(async (tx) => {
        const organizer = await tx.examOrganizer.upsert({ where: { code: value.organizer.code }, update: { name: value.organizer.name, officialWebsite: value.organizer.officialWebsite }, create: value.organizer });
        const jurisdictions = await Promise.all(value.jurisdictions.map((jurisdiction) => tx.jurisdiction.upsert({ where: { code: jurisdiction.code }, update: { name: jurisdiction.name, type: jurisdiction.type }, create: jurisdiction })));
        const examination = await tx.examination.update({ where: { code: existing.code }, data: { name: value.name, family: value.family, organizerId: organizer.id, jurisdictions: { deleteMany: {}, create: jurisdictions.map((jurisdiction) => ({ jurisdictionId: jurisdiction.id })) } }, include: { organizer: true, jurisdictions: { include: { jurisdiction: true } } } });
        await tx.auditEvent.create({ data: { type: AuditEventType.CATALOGUE_EXAM_UPDATED, accountId: actorId, metadata: { examinationCode: examination.code, family: examination.family } } });
        return this.toPublicSummary(examination);
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Catalogue data conflicts with an existing record');
      throw error;
    }
  }

  private parseListQuery(query: Record<string, unknown>) {
    const page = this.positiveInteger(query.page, 1, 10_000);
    const pageSize = this.positiveInteger(query.pageSize, 20, 50);
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const family = typeof query.family === 'string' ? query.family.trim().toUpperCase() : undefined;
    if (family && !FAMILY_VALUES.includes(family as ExamFamilyCode)) throw new BadRequestException('Invalid examination family');
    return { page, pageSize, search, family: family as ExamFamilyCode | undefined };
  }

  private parseCatalogueInput(input: unknown): CatalogueInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Catalogue payload is required');
    const value = input as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const family = typeof value.family === 'string' ? value.family.trim().toUpperCase() : '';
    const organizer = this.parseOrganizer(value.organizer);
    const rawJurisdictions = Array.isArray(value.jurisdictions) ? value.jurisdictions : [];
    const jurisdictions = rawJurisdictions.map((item) => this.parseJurisdiction(item));
    const uniqueCodes = new Set(jurisdictions.map((item) => item.code));
    if (!/^[A-Z0-9][A-Z0-9_-]{1,47}$/.test(code) || !name || name.length > 200 || !FAMILY_VALUES.includes(family as ExamFamilyCode) || jurisdictions.length === 0 || uniqueCodes.size !== jurisdictions.length) throw new BadRequestException('Invalid examination catalogue data');
    return { code, name, family: family as ExamFamilyCode, organizer, jurisdictions };
  }

  private parseOrganizer(input: unknown): OrganizerInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Organizer is required');
    const value = input as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const officialWebsite = typeof value.officialWebsite === 'string' ? value.officialWebsite.trim() : undefined;
    if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(code) || !name || name.length > 200 || (officialWebsite && !this.isHttpsUrl(officialWebsite))) throw new BadRequestException('Invalid organizer data');
    return { code, name, ...(officialWebsite ? { officialWebsite } : {}) };
  }

  private parseJurisdiction(input: unknown): JurisdictionInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid jurisdiction data');
    const value = input as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const type = typeof value.type === 'string' ? value.type.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(code) || !name || name.length > 160 || !JURISDICTION_VALUES.includes(type as JurisdictionType)) throw new BadRequestException('Invalid jurisdiction data');
    return { code, name, type: type as JurisdictionType };
  }

  private parseSubject(input: unknown): { code: string; name: string } {
    if (!input || typeof input !== 'object') throw new BadRequestException('Subject payload is required');
    const value = input as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(code) || !name || name.length > 200) throw new BadRequestException('Invalid subject data');
    return { code, name };
  }

  private positiveInteger(value: unknown, fallback: number, max: number): number {
    const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : fallback;
    return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
  }

  private isHttpsUrl(value: string): boolean { try { return new URL(value).protocol === 'https:'; } catch { return false; } }
  private isUniqueError(error: unknown): boolean { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }

  private toPublicSummary(item: PublicExam) {
    return { id: item.id, code: item.code, name: item.name, family: item.family, organizer: { code: item.organizer.code, name: item.organizer.name, officialWebsite: item.organizer.officialWebsite }, jurisdictions: item.jurisdictions.map((entry) => ({ code: entry.jurisdiction.code, name: entry.jurisdiction.name, type: entry.jurisdiction.type })) };
  }

  private toPublicDetail(item: PublicExamDetail) {
    return { ...this.toPublicSummary(item), cycles: item.cycles.map((cycle) => ({ code: cycle.code, subjects: cycle.subjects.map((subject) => ({ code: subject.code, name: subject.name, status: subject.status })), patternStatuses: [...new Set(cycle.versions.map((version) => version.status))] })) };
  }
}
