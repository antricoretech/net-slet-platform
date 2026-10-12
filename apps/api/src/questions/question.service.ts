import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, AuditEventType, Prisma, QuestionType, QuestionVersionStatus, RightsStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { validateAnswerKey, validateQuestionPayload, type AnswerKeyInput, type QuestionOptionInput } from './question.validation';

interface AuthorContext { examinationCode: string; cycleCode: string; subjectCode: string; syllabusVersionId: string; topicIds: string[]; }
interface QuestionDraftInput extends AuthorContext { type: QuestionType; prompt: Prisma.InputJsonValue; options: QuestionOptionInput[]; languageCode?: string; groupId?: string; }

@Injectable()
export class QuestionService {
  constructor(private readonly database: PrismaService) {}

  async create(input: unknown, actorId: string) {
    const value = this.parseDraft(input);
    const context = await this.validateContext(value);
    await this.ensureAuthor(actorId);
    if (value.groupId) await this.validateGroup(value.groupId, context.examCycleId, context.subjectCode);
    validateQuestionPayload(value.type, value.prompt, value.options);
    const question = await this.database.$transaction(async (tx) => {
      const identity = await tx.question.create({ data: { examCycleId: context.examCycleId, subjectCode: context.subjectCode, createdById: actorId } });
      const revision = await tx.questionVersion.create({ data: { questionId: identity.id, version: 1, type: value.type, languageCode: value.languageCode ?? 'en', prompt: value.prompt, authoredById: actorId, groupId: value.groupId, options: { create: value.options.map((option) => ({ optionKey: option.optionKey, optionText: option.optionText as Prisma.InputJsonValue, sequence: option.sequence })) }, mappings: { create: context.topicIds.map((syllabusTopicId) => ({ syllabusTopicId })) } } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_DRAFT_CREATED, accountId: actorId, questionId: identity.id, questionVersionId: revision.id, metadata: { examinationCode: value.examinationCode, cycleCode: value.cycleCode, subjectCode: value.subjectCode, type: value.type } } });
      return { identity, revision };
    });
    return this.authoringSummary(question.identity, question.revision);
  }

  async list(query: Record<string, unknown>, actorId: string, role: AccountRole) {
    const page = this.positiveInteger(query.page, 1, 10_000);
    const pageSize = this.positiveInteger(query.pageSize, 20, 100);
    const type = typeof query.type === 'string' && Object.values(QuestionType).includes(query.type.toUpperCase() as QuestionType) ? query.type.toUpperCase() as QuestionType : undefined;
    const status = typeof query.status === 'string' && Object.values(QuestionVersionStatus).includes(query.status.toUpperCase() as QuestionVersionStatus) ? query.status.toUpperCase() as QuestionVersionStatus : undefined;
    const where = { ...(role === AccountRole.SME ? { createdById: actorId } : {}), ...(typeof query.subjectCode === 'string' ? { subjectCode: query.subjectCode.trim().toUpperCase() } : {}), versions: { some: { ...(type ? { type } : {}), ...(status ? { status } : {}) } } };
    const [items, total] = await Promise.all([this.database.question.findMany({ where, include: { examCycle: { include: { examination: true } }, versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, type: true, languageCode: true, createdAt: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), this.database.question.count({ where })]);
    return { data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async get(id: string, actorId: string, role: AccountRole) {
    const question = await this.database.question.findUnique({ where: { id }, include: { examCycle: { include: { examination: true } }, versions: { orderBy: { version: 'desc' }, include: { options: { orderBy: { sequence: 'asc' } }, answerKeys: { orderBy: { version: 'desc' } }, explanations: { orderBy: { version: 'desc' }, include: { rationales: true } }, mappings: { include: { syllabusTopic: { include: { subjectUnit: { include: { syllabusVersion: true } } } } } }, translations: true, provenance: true, licences: true } } } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.createdById, actorId, role);
    return question;
  }

  async updateDraft(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const prompt = (value.prompt ?? revision.prompt) as Prisma.InputJsonValue;
    validateQuestionPayload(revision.type, prompt, revision.options);
    const updated = await this.database.$transaction(async (tx) => {
      const result = await tx.questionVersion.update({ where: { id: revision.id }, data: { prompt } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_DRAFT_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { fields: ['prompt'] } } });
      return result;
    });
    return { id: updated.id, questionId, version: updated.version, status: updated.status };
  }

  async createRevision(questionId: string, input: unknown, actorId: string, role: AccountRole) {
    const question = await this.database.question.findUnique({ where: { id: questionId }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { options: true, mappings: true } } } });
    if (!question) throw new NotFoundException('Question not found');
    this.assertOwner(question.createdById, actorId, role);
    const base = question.versions[0];
    if (!base) throw new NotFoundException('Question revision not found');
    const value = this.parseRevision(input, base.type, base.prompt, base.options);
    validateQuestionPayload(value.type, value.prompt, value.options);
    const revision = await this.database.$transaction(async (tx) => {
      const created = await tx.questionVersion.create({ data: { questionId, version: base.version + 1, type: value.type, languageCode: value.languageCode ?? base.languageCode, prompt: value.prompt, authoredById: actorId, options: { create: value.options.map((option) => ({ optionKey: option.optionKey, optionText: option.optionText as Prisma.InputJsonValue, sequence: option.sequence })) }, mappings: { create: base.mappings.map((mapping) => ({ syllabusTopicId: mapping.syllabusTopicId })) } } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_REVISION_CREATED, accountId: actorId, questionId, questionVersionId: created.id, metadata: { basedOnVersion: base.version } } });
      return created;
    });
    return { id: revision.id, questionId, version: revision.version, status: revision.status };
  }

  async addOption(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.parseOption(input);
    validateQuestionPayload(revision.type, revision.prompt, [...revision.options, value]);
    try {
      const option = await this.database.$transaction(async (tx) => {
        const created = await tx.questionOption.create({ data: { questionVersionId: revision.id, optionKey: value.optionKey, optionText: value.optionText as Prisma.InputJsonValue, sequence: value.sequence } });
        await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_OPTION_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { optionKey: value.optionKey } } });
        return created;
      });
      return option;
    } catch (error) { if (this.isUniqueError(error)) throw new ConflictException('That option key or sequence already exists'); throw error; }
  }

  async addAnswerKey(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const key: AnswerKeyInput = { correctAnswers: value.correctAnswers, exactMatch: value.exactMatch === true };
    validateAnswerKey(revision.type, key, revision.options);
    const latest = await this.database.questionAnswerKeyVersion.findFirst({ where: { questionVersionId: revision.id }, orderBy: { version: 'desc' } });
    const created = await this.database.$transaction(async (tx) => {
      const result = await tx.questionAnswerKeyVersion.create({ data: { questionVersionId: revision.id, version: (latest?.version ?? 0) + 1, correctAnswers: key.correctAnswers as Prisma.InputJsonValue, exactMatch: key.exactMatch ?? false, createdById: actorId } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_ANSWER_KEY_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { keyVersion: result.version } } });
      return result;
    });
    return created;
  }

  async addExplanation(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    if (!value.explanation || !this.isSafeContent(value.explanation)) throw new BadRequestException('Explanation content is required and must be safe');
    const languageCode = typeof value.languageCode === 'string' && /^[a-z]{2,8}(-[A-Z]{2,4})?$/.test(value.languageCode) ? value.languageCode : 'en';
    const latest = await this.database.questionExplanationVersion.findFirst({ where: { questionVersionId: revision.id, languageCode }, orderBy: { version: 'desc' } });
    const rationales = Array.isArray(value.rationales) ? value.rationales : [];
    if (rationales.some((item) => !this.recordOrFalse(item))) throw new BadRequestException('Invalid option rationales');
    return this.database.$transaction(async (tx) => {
      const explanation = await tx.questionExplanationVersion.create({ data: { questionVersionId: revision.id, version: (latest?.version ?? 0) + 1, languageCode, explanation: value.explanation as Prisma.InputJsonValue, createdById: actorId, rationales: { create: rationales.map((item) => ({ optionKey: String((item as Record<string, unknown>).optionKey), rationale: (item as Record<string, unknown>).rationale as Prisma.InputJsonValue })) } }, include: { rationales: true } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_EXPLANATION_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { explanationVersion: explanation.version, languageCode } } });
      return explanation;
    });
  }

  async addMapping(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const topicId = typeof value.syllabusTopicId === 'string' ? value.syllabusTopicId : '';
    const topic = await this.database.syllabusTopic.findFirst({ where: { id: topicId, subjectUnit: { syllabusVersion: { id: typeof value.syllabusVersionId === 'string' ? value.syllabusVersionId : '', examCycleId: revision.question.examCycleId, subjectCode: revision.question.subjectCode } } } });
    if (!topic) throw new BadRequestException('Syllabus topic does not belong to the question context');
    try { return await this.database.$transaction(async (tx) => { const mapping = await tx.questionSyllabusMapping.create({ data: { questionVersionId: revision.id, syllabusTopicId: topic.id } }); await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_SYLLABUS_MAPPED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { syllabusTopicId: topic.id } } }); return mapping; }); } catch (error) { if (this.isUniqueError(error)) throw new ConflictException('Question is already mapped to that topic'); throw error; }
  }

  async addProvenance(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const sourceTitle = typeof value.sourceTitle === 'string' ? value.sourceTitle.trim() : '';
    const sourceUrl = typeof value.sourceUrl === 'string' ? value.sourceUrl.trim() : undefined;
    const sourceType = typeof value.sourceType === 'string' ? value.sourceType.trim().toUpperCase() : 'RESEARCH_REFERENCE';
    const rightsStatus = typeof value.rightsStatus === 'string' ? value.rightsStatus.trim().toUpperCase() as RightsStatus : RightsStatus.UNKNOWN;
    if (!sourceTitle || sourceTitle.length > 300 || !sourceType || sourceType.length > 80 || !Object.values(RightsStatus).includes(rightsStatus) || (sourceUrl && !this.isHttpsUrl(sourceUrl))) throw new BadRequestException('Invalid provenance data');
    const provenance = await this.database.contentProvenance.create({ data: { questionVersionId: revision.id, sourceTitle, sourceType, rightsStatus, sourceUrl, sourceReference: typeof value.sourceReference === 'string' ? value.sourceReference.trim() : undefined, sourceHash: typeof value.sourceHash === 'string' ? value.sourceHash.trim().toLowerCase() : undefined, rightsNote: typeof value.rightsNote === 'string' ? value.rightsNote.trim() : undefined, createdById: actorId } });
    await this.database.auditEvent.create({ data: { type: AuditEventType.QUESTION_PROVENANCE_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { provenanceId: provenance.id } } });
    return provenance;
  }

  async addTranslation(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const languageCode = typeof value.languageCode === 'string' && /^[a-z]{2,8}(-[A-Z]{2,4})?$/.test(value.languageCode) ? value.languageCode : '';
    if (!languageCode || !value.prompt || !this.isSafeContent(value.prompt)) throw new BadRequestException('Valid translation language and safe prompt are required');
    try {
      const translation = await this.database.questionTranslation.create({ data: { questionVersionId: revision.id, languageCode, prompt: value.prompt as Prisma.InputJsonValue, createdById: actorId } });
      await this.database.auditEvent.create({ data: { type: AuditEventType.QUESTION_DRAFT_UPDATED, accountId: actorId, questionId, questionVersionId: revision.id, metadata: { translationId: translation.id, languageCode } } });
      return translation;
    } catch (error) { if (this.isUniqueError(error)) throw new ConflictException('That translation already exists for this revision and language'); throw error; }
  }

  async addLicence(questionId: string, versionId: string, input: unknown, actorId: string, role: AccountRole) {
    const revision = await this.requireDraft(questionId, versionId, actorId, role);
    const value = this.record(input);
    const licenceName = typeof value.licenceName === 'string' ? value.licenceName.trim() : '';
    if (!licenceName || licenceName.length > 200) throw new BadRequestException('Licence name is required');
    return this.database.contentLicence.create({ data: { questionVersionId: revision.id, licenceName, licenceReference: typeof value.licenceReference === 'string' ? value.licenceReference.trim() : undefined, restrictions: typeof value.restrictions === 'string' ? value.restrictions.trim() : undefined, createdById: actorId } });
  }

  private async validateContext(value: QuestionDraftInput) {
    const subject = await this.database.examSubject.findFirst({ where: { code: value.subjectCode, examCycle: { code: value.cycleCode, examination: { code: value.examinationCode } } }, include: { examCycle: true } });
    if (!subject) throw new NotFoundException('Examination cycle subject not found');
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { id: value.syllabusVersionId, examCycleId: subject.examCycleId, subjectCode: subject.code }, include: { units: { include: { topics: true } } } });
    if (!syllabus) throw new BadRequestException('Syllabus version does not belong to the question context');
    const validTopicIds = new Set(syllabus.units.flatMap((unit) => unit.topics.map((topic) => topic.id)));
    if (!value.topicIds.length || value.topicIds.some((id) => !validTopicIds.has(id))) throw new BadRequestException('Every syllabus topic must belong to the selected syllabus version');
    return { examCycleId: subject.examCycleId, subjectCode: subject.code, topicIds: value.topicIds };
  }

  private async validateGroup(groupId: string, examCycleId: string, subjectCode: string) { const group = await this.database.questionGroup.findFirst({ where: { id: groupId, examCycleId, subjectCode } }); if (!group) throw new BadRequestException('Question group does not belong to the question context'); }
  private async ensureAuthor(actorId: string) { const account = await this.database.account.findUnique({ where: { id: actorId }, select: { id: true, role: true } }); if (!account || (account.role !== AccountRole.ADMIN && account.role !== AccountRole.SME)) throw new ForbiddenException('Question authoring requires SME or ADMIN role'); }
  private async requireDraft(questionId: string, versionId: string, actorId: string, role: AccountRole) { const revision = await this.database.questionVersion.findFirst({ where: { id: versionId, questionId }, include: { options: { orderBy: { sequence: 'asc' } }, question: true } }); if (!revision) throw new NotFoundException('Question revision not found'); this.assertOwner(revision.question.createdById, actorId, role); if (revision.status !== QuestionVersionStatus.DRAFT) throw new ConflictException('Only draft revisions can be edited'); return revision; }
  private assertOwner(ownerId: string, actorId: string, role: AccountRole) { if (role !== AccountRole.ADMIN && (role !== AccountRole.SME || ownerId !== actorId)) throw new ForbiddenException('Question ownership check failed'); }
  private parseDraft(input: unknown): QuestionDraftInput { const value = this.record(input); const examinationCode = this.code(value.examinationCode, 48); const cycleCode = typeof value.cycleCode === 'string' ? value.cycleCode.trim() : ''; const subjectCode = this.code(value.subjectCode, 80); const syllabusVersionId = typeof value.syllabusVersionId === 'string' ? value.syllabusVersionId : ''; const topicIds = Array.isArray(value.topicIds) ? value.topicIds.filter((id): id is string => typeof id === 'string') : []; const type = typeof value.type === 'string' ? value.type.trim().toUpperCase() as QuestionType : undefined; const options = Array.isArray(value.options) ? value.options.map((item) => this.parseOption(item)) : []; if (!examinationCode || !cycleCode || !/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(subjectCode) || !syllabusVersionId || !type || !topicIds.length) throw new BadRequestException('Question context is incomplete'); return { examinationCode, cycleCode, subjectCode, syllabusVersionId, topicIds, type, prompt: value.prompt as Prisma.InputJsonValue, options, languageCode: typeof value.languageCode === 'string' ? value.languageCode : 'en', groupId: typeof value.groupId === 'string' ? value.groupId : undefined }; }
  private parseRevision(input: unknown, defaultType: QuestionType, defaultPrompt: Prisma.JsonValue, defaultOptions: QuestionOptionInput[]) { const value = this.record(input); return { type: typeof value.type === 'string' ? value.type.trim().toUpperCase() as QuestionType : defaultType, prompt: (value.prompt ?? defaultPrompt) as Prisma.InputJsonValue, options: Array.isArray(value.options) ? value.options.map((item) => this.parseOption(item)) : defaultOptions, languageCode: typeof value.languageCode === 'string' ? value.languageCode : undefined }; }
  private parseOption(input: unknown): QuestionOptionInput { const value = this.record(input); const optionKey = typeof value.optionKey === 'string' ? value.optionKey.trim().toUpperCase() : ''; const sequence = typeof value.sequence === 'number' ? value.sequence : Number(value.sequence); if (!optionKey || !Number.isSafeInteger(sequence) || !isSafeJson(value.optionText)) throw new BadRequestException('Invalid question option'); return { optionKey, optionText: value.optionText, sequence }; }
  private record(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Object payload is required'); return input as Record<string, unknown>; }
  private code(input: unknown, max: number) { const value = typeof input === 'string' ? input.trim().toUpperCase() : ''; return new RegExp(`^[A-Z0-9][A-Z0-9_-]{0,${max - 1}}$`).test(value) ? value : ''; }
  private positiveInteger(value: unknown, fallback: number, max: number) { const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : fallback; return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback; }
  private authoringSummary(identity: { id: string }, revision: { id: string; version: number; status: QuestionVersionStatus; type: QuestionType; languageCode: string }) { return { id: identity.id, revisionId: revision.id, version: revision.version, status: revision.status, type: revision.type, languageCode: revision.languageCode }; }
  private isSafeContent(value: unknown) { try { return !/<\s*script\b|javascript:/i.test(JSON.stringify(value)); } catch { return false; } }
  private recordOrFalse(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).optionKey === 'string' && this.isSafeContent((value as Record<string, unknown>).rationale)); }
  private isHttpsUrl(value: string) { try { return new URL(value).protocol === 'https:'; } catch { return false; } }
  private isUniqueError(error: unknown) { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }
}

function isSafeJson(value: unknown) { try { JSON.stringify(value); return !/<\s*script\b|javascript:/i.test(JSON.stringify(value)); } catch { return false; } }
