import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccountRole, AuditEventType, ChallengeCategory, ChallengeStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class QuestionChallengeService {
  constructor(private readonly database: PrismaService) {}

  async create(questionId: string, versionId: string, input: unknown, reporterId: string) {
    const value = this.parse(input);
    const revision = await this.database.questionVersion.findFirst({ where: { id: versionId, questionId, status: 'PUBLISHED' }, select: { id: true } });
    if (!revision) throw new NotFoundException('Published question not found');
    const dedupeHash = createHash('sha256').update(`${versionId}|${value.category}|${value.description.toLowerCase()}`).digest('hex');
    try {
      const challenge = await this.database.$transaction(async (tx) => {
        const created = await tx.questionChallenge.create({ data: { questionVersionId: versionId, reporterId, category: value.category, description: value.description, dedupeHash } });
        await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_CHALLENGED, accountId: reporterId, questionId, questionVersionId: versionId, metadata: { challengeId: created.id, category: value.category } } });
        return created;
      });
      return { id: challenge.id, status: challenge.status, category: challenge.category, createdAt: challenge.createdAt };
    } catch (error) { if (this.isUnique(error)) throw new ConflictException('A matching challenge already exists'); throw error; }
  }

  async resolve(id: string, input: unknown, actorId: string) {
    const value = this.parseResolution(input);
    const challenge = await this.database.questionChallenge.findUnique({ where: { id } });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (([ChallengeStatus.RESOLVED, ChallengeStatus.REJECTED, ChallengeStatus.DUPLICATE] as ChallengeStatus[]).includes(challenge.status)) throw new ConflictException('Challenge is already closed');
    const updated = await this.database.$transaction(async (tx) => {
      const result = await tx.questionChallenge.update({ where: { id }, data: { status: value.status, resolutionNotes: value.notes, resolvedById: actorId, resolvedAt: new Date() } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_CHALLENGE_RESOLVED, accountId: actorId, questionVersionId: challenge.questionVersionId, metadata: { challengeId: id, status: value.status } } });
      return result;
    });
    return { id: updated.id, status: updated.status, resolutionNotes: updated.resolutionNotes, resolvedAt: updated.resolvedAt };
  }

  async list(input: { actorId: string; role: AccountRole; search?: string; status?: string; category?: string; examination?: string; subject?: string; questionId?: string; versionId?: string; page?: string; pageSize?: string }) {
    const page = this.page(input.page, 1);
    const pageSize = Math.min(this.page(input.pageSize, 25), 100);
    const where: Prisma.QuestionChallengeWhereInput = {};
    if (input.role === AccountRole.STUDENT) where.reporterId = input.actorId;
    if (input.status && Object.values(ChallengeStatus).includes(input.status.toUpperCase() as ChallengeStatus)) where.status = input.status.toUpperCase() as ChallengeStatus;
    if (input.category && Object.values(ChallengeCategory).includes(input.category.toUpperCase() as ChallengeCategory)) where.category = input.category.toUpperCase() as ChallengeCategory;
    if (input.questionId) where.questionVersion = { questionId: input.questionId };
    if (input.versionId) where.questionVersionId = input.versionId;
    if (input.examination || input.subject) where.questionVersion = { ...(where.questionVersion as Prisma.QuestionVersionWhereInput ?? {}), question: { ...(input.examination ? { examCycle: { examination: { code: { equals: input.examination.toUpperCase() } } } } : {}), ...(input.subject ? { subjectCode: { equals: input.subject.toUpperCase() } } : {}) } };
    if (input.search?.trim()) { const search = input.search.trim(); where.OR = [{ description: { contains: search, mode: 'insensitive' } }, { questionVersion: { question: { subjectCode: { contains: search, mode: 'insensitive' } } } }]; }
    const [total, rows] = await this.database.$transaction([this.database.questionChallenge.count({ where }), this.database.questionChallenge.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, questionVersionId: true, category: true, description: true, status: true, createdAt: true, resolutionNotes: true, resolvedAt: true, questionVersion: { select: { version: true, type: true, status: true, languageCode: true, question: { select: { id: true, subjectCode: true, examCycle: { select: { code: true, examination: { select: { code: true, name: true } } } } } } } } } })]);
    return { data: rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async triage(id: string, actorId: string) {
    const challenge = await this.database.questionChallenge.findUnique({ where: { id }, select: { id: true, questionVersionId: true, status: true } });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (challenge.status !== ChallengeStatus.OPEN) throw new ConflictException('Only open challenges can be triaged');
    const updated = await this.database.$transaction(async (tx) => {
      const result = await tx.questionChallenge.update({ where: { id }, data: { status: ChallengeStatus.IN_REVIEW } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_CHALLENGE_RESOLVED, accountId: actorId, questionVersionId: challenge.questionVersionId, metadata: { challengeId: id, status: ChallengeStatus.IN_REVIEW, event: 'TRIAGED' } } });
      return result;
    });
    return { id: updated.id, status: updated.status };
  }

  async staffDetail(id: string) {
    const challenge = await this.database.questionChallenge.findUnique({
      where: { id },
      select: {
        id: true, questionVersionId: true, category: true, description: true, status: true, createdAt: true, resolutionNotes: true, resolvedAt: true,
        questionVersion: { select: { version: true, type: true, status: true, languageCode: true, question: { select: { id: true, subjectCode: true, examCycle: { select: { code: true, examination: { select: { code: true, name: true } } } } } } } },
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    const audit = await this.database.auditEvent.findMany({ where: { questionVersionId: challenge.questionVersionId, type: { in: [AuditEventType.QUESTION_CHALLENGED, AuditEventType.QUESTION_CHALLENGE_RESOLVED] } }, orderBy: { createdAt: 'asc' }, select: { id: true, type: true, metadata: true, createdAt: true } });
    return { ...challenge, audit };
  }

  async get(id: string, actorId: string, role: AccountRole) {
    const challenge = await this.database.questionChallenge.findUnique({ where: { id }, select: { id: true, questionVersionId: true, reporterId: true, category: true, description: true, status: true, createdAt: true, resolutionNotes: true, resolvedAt: true } });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (role === AccountRole.STUDENT && challenge.reporterId !== actorId) throw new ForbiddenException('Challenge ownership check failed');
    return { id: challenge.id, questionVersionId: challenge.questionVersionId, category: challenge.category, description: challenge.description, status: challenge.status, createdAt: challenge.createdAt, resolutionNotes: challenge.resolutionNotes, resolvedAt: challenge.resolvedAt };
  }

  private page(value: string | undefined, fallback: number) { const parsed = Number.parseInt(value ?? '', 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }

  private parse(input: unknown) { if (!input || typeof input !== 'object') throw new BadRequestException('Challenge payload is required'); const value = input as Record<string, unknown>; const category = typeof value.category === 'string' ? value.category.trim().toUpperCase() as ChallengeCategory : undefined; const description = typeof value.description === 'string' ? value.description.trim() : ''; if (!category || !Object.values(ChallengeCategory).includes(category) || !description || description.length > 4000) throw new BadRequestException('Invalid challenge data'); return { category, description }; }
  private parseResolution(input: unknown) { if (!input || typeof input !== 'object') throw new BadRequestException('Resolution payload is required'); const value = input as Record<string, unknown>; const status = typeof value.status === 'string' ? value.status.trim().toUpperCase() as ChallengeStatus : undefined; const notes = typeof value.notes === 'string' ? value.notes.trim() : ''; if (!([ChallengeStatus.RESOLVED, ChallengeStatus.REJECTED, ChallengeStatus.DUPLICATE, ChallengeStatus.QUARANTINED] as ChallengeStatus[]).includes(status as ChallengeStatus) || !notes || notes.length > 5000) throw new BadRequestException('Invalid challenge resolution'); return { status: status as ChallengeStatus, notes }; }
  private isUnique(error: unknown) { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }
}
