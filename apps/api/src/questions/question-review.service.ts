import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AccountRole, AuditEventType, Prisma, QuestionVersionStatus, ReviewDecision, RightsStatus, TranslationStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { validateAnswerKey, validateQuestionPayload, type QuestionOptionInput } from './question.validation';

interface ReviewInput { notes: string; evidence?: Prisma.InputJsonValue; }

@Injectable()
export class QuestionReviewService {
  constructor(private readonly database: PrismaService) {}

  async submit(questionId: string, versionId: string, actorId: string) {
    const revision = await this.requireRevision(questionId, versionId);
    if (revision.authoredById !== actorId) throw new ForbiddenException('Only the question author can submit this draft');
    if (revision.status !== QuestionVersionStatus.DRAFT) throw new ConflictException('Only draft revisions can be submitted');
    await this.assertPublishableContent(revision);
    const updated = await this.database.$transaction(async (tx) => {
      const result = await tx.questionVersion.updateMany({ where: { id: versionId, status: QuestionVersionStatus.DRAFT }, data: { status: QuestionVersionStatus.SUBMITTED_FOR_REVIEW, submittedAt: new Date() } });
      if (result.count !== 1) throw new ConflictException('Question revision changed concurrently');
      const current = await tx.questionVersion.findUniqueOrThrow({ where: { id: versionId } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_SUBMITTED_FOR_REVIEW, accountId: actorId, questionId, questionVersionId: versionId, metadata: { version: current.version } } });
      return current;
    });
    return { id: updated.id, status: updated.status, version: updated.version };
  }

  async queue(status: QuestionVersionStatus | undefined, actorId: string, role: AccountRole) {
    return this.database.questionVersion.findMany({ where: { status: status ?? QuestionVersionStatus.SUBMITTED_FOR_REVIEW, ...(role === AccountRole.SME ? { reviews: { some: { reviewerId: actorId, decision: ReviewDecision.ASSIGNED } } } : {}) }, include: { question: { include: { examCycle: { include: { examination: true } } } }, mappings: { include: { syllabusTopic: true } }, reviews: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { submittedAt: 'asc' }, take: 100 });
  }

  async assign(questionId: string, versionId: string, reviewerId: string, actorId: string) {
    const revision = await this.requireRevision(questionId, versionId);
    if (revision.status !== QuestionVersionStatus.SUBMITTED_FOR_REVIEW) throw new BadRequestException('Only submitted revisions can be assigned');
    const reviewer = await this.database.account.findUnique({ where: { id: reviewerId }, select: { id: true, role: true } });
    if (!reviewer || reviewer.role !== AccountRole.SME) throw new BadRequestException('Reviewer must be an SME');
    if (reviewerId === revision.authoredById) throw new ForbiddenException('Authors cannot review their own question');
    const review = await this.database.$transaction(async (tx) => {
      const record = await tx.questionReview.create({ data: { questionVersionId: versionId, reviewerId, decision: ReviewDecision.ASSIGNED, notes: 'Review assigned' } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_REVIEW_ASSIGNED, accountId: actorId, questionId, questionVersionId: versionId, metadata: { reviewerId } } });
      return record;
    });
    return { id: review.id, reviewerId, decision: review.decision };
  }

  async review(questionId: string, versionId: string, input: unknown, actorId: string, decision: ReviewDecision) {
    const revision = await this.requireRevision(questionId, versionId);
    if (revision.status !== QuestionVersionStatus.SUBMITTED_FOR_REVIEW) throw new BadRequestException('Only submitted revisions can be reviewed');
    if (revision.authoredById === actorId) throw new ForbiddenException('Authors cannot review their own question');
    const assignment = await this.database.questionReview.findFirst({ where: { questionVersionId: versionId, reviewerId: actorId, decision: ReviewDecision.ASSIGNED }, orderBy: { createdAt: 'desc' } });
    if (!assignment) throw new ForbiddenException('Question is not assigned to this reviewer');
    const value = this.parseReview(input);
    const nextStatus = decision === ReviewDecision.APPROVED ? QuestionVersionStatus.SME_REVIEWED : QuestionVersionStatus.REJECTED;
    const result = await this.database.$transaction(async (tx) => {
      const record = await tx.questionReview.create({ data: { questionVersionId: versionId, reviewerId: actorId, decision, notes: value.notes, evidence: value.evidence } });
      const updated = await tx.questionVersion.updateMany({ where: { id: versionId, status: QuestionVersionStatus.SUBMITTED_FOR_REVIEW }, data: { status: nextStatus } });
      if (updated.count !== 1) throw new ConflictException('Question review became stale');
      await tx.auditEvent.create({ data: { type: decision === ReviewDecision.APPROVED ? AuditEventType.QUESTION_REVIEWED : AuditEventType.QUESTION_REJECTED, accountId: actorId, questionId, questionVersionId: versionId, metadata: { decision, reviewId: record.id } } });
      return { id: versionId, status: nextStatus, reviewId: record.id };
    });
    return result;
  }

  async approve(questionId: string, versionId: string, input: unknown, actorId: string) {
    const revision = await this.requireRevision(questionId, versionId);
    if (revision.status !== QuestionVersionStatus.SME_REVIEWED) throw new BadRequestException('Only SME-reviewed revisions can be approved');
    if (revision.authoredById === actorId) throw new ForbiddenException('Authors cannot approve their own question');
    const latest = await this.database.questionReview.findFirst({ where: { questionVersionId: versionId }, orderBy: { createdAt: 'desc' } });
    if (!latest || latest.decision !== ReviewDecision.APPROVED || latest.reviewerId === actorId) throw new BadRequestException('A distinct SME approval is required before publication approval');
    const value = this.parseReview(input);
    const result = await this.database.$transaction(async (tx) => {
      const review = await tx.questionReview.create({ data: { questionVersionId: versionId, reviewerId: actorId, decision: ReviewDecision.APPROVED, notes: value.notes, evidence: value.evidence } });
      const updated = await tx.questionVersion.updateMany({ where: { id: versionId, status: QuestionVersionStatus.SME_REVIEWED }, data: { status: QuestionVersionStatus.APPROVED, approvedAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException('Question approval became stale');
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_APPROVED, accountId: actorId, questionId, questionVersionId: versionId, metadata: { reviewId: review.id } } });
      return { id: versionId, status: QuestionVersionStatus.APPROVED };
    });
    return result;
  }

  async publish(questionId: string, versionId: string, actorId: string) {
    const revision = await this.requireRevision(questionId, versionId);
    if (revision.status !== QuestionVersionStatus.APPROVED) throw new BadRequestException('Only approved revisions can be published');
    if (revision.authoredById === actorId) throw new ForbiddenException('Authors cannot publish their own question');
    await this.assertPublishableContent(revision);
    const snapshot = this.toSnapshot(revision);
    const contentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    return this.database.$transaction(async (tx) => {
      const updated = await tx.questionVersion.updateMany({ where: { id: versionId, status: QuestionVersionStatus.APPROVED }, data: { status: QuestionVersionStatus.PUBLISHED, publishedAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException('Publication became stale or was already completed');
      const publication = await tx.questionPublication.create({ data: { questionVersionId: versionId, publishedById: actorId, contentHash, snapshot } });
      await tx.auditEvent.create({ data: { type: AuditEventType.QUESTION_PUBLISHED, accountId: actorId, questionId, questionVersionId: versionId, metadata: { publicationId: publication.id, contentHash } } });
      return { id: versionId, publicationId: publication.id, status: QuestionVersionStatus.PUBLISHED, contentHash };
    });
  }

  async publicationHistory(questionId: string, actorId: string, role: AccountRole) {
    if (role !== AccountRole.ADMIN && role !== AccountRole.SME) throw new ForbiddenException('Review access required');
    const question = await this.database.question.findUnique({ where: { id: questionId }, include: { versions: { where: { publication: { isNot: null } }, include: { publication: true }, orderBy: { version: 'desc' } } } });
    if (!question) throw new NotFoundException('Question not found');
    if (role === AccountRole.SME && question.createdById !== actorId) throw new ForbiddenException('Question ownership check failed');
    return question.versions.map((version) => ({ version: version.version, status: version.status, publication: version.publication }));
  }

  async getPublic(questionId: string, languageCode = 'en') {
    const revision = await this.database.questionVersion.findFirst({ where: { questionId, status: QuestionVersionStatus.PUBLISHED, publication: { status: 'ACTIVE' }, OR: [{ languageCode }, { languageCode: 'en' }] }, include: { options: { orderBy: { sequence: 'asc' } }, translations: { where: { languageCode, status: TranslationStatus.APPROVED } }, publication: true } });
    if (!revision) throw new NotFoundException('Published question not found');
    const translation = revision.translations[0];
    return { id: revision.questionId, revisionId: revision.id, version: revision.version, type: revision.type, languageCode: translation ? languageCode : revision.languageCode, prompt: translation?.prompt ?? revision.prompt, options: revision.options.map((option) => ({ key: option.optionKey, text: option.optionText, sequence: option.sequence })) };
  }

  private async assertPublishableContent(revision: Awaited<ReturnType<QuestionReviewService['requireRevision']>>) {
    const options = revision.options as QuestionOptionInput[];
    validateQuestionPayload(revision.type, revision.prompt, options);
    const key = revision.answerKeys[0];
    if (!key) throw new BadRequestException('A valid answer key is required');
    validateAnswerKey(revision.type, { correctAnswers: key.correctAnswers, exactMatch: key.exactMatch }, options);
    if (!revision.explanations[0]?.explanation) throw new BadRequestException('An explanation is required');
    if (!revision.mappings.length) throw new BadRequestException('At least one syllabus mapping is required');
    if (!revision.provenance.length || revision.provenance.some((item) => ([RightsStatus.UNKNOWN, RightsStatus.RESTRICTED] as RightsStatus[]).includes(item.rightsStatus))) throw new BadRequestException('Approved provenance and rights evidence are required');
    if (revision.provenance.some((item) => ([RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED] as RightsStatus[]).includes(item.rightsStatus)) && !revision.licences.length) throw new BadRequestException('Licence evidence is required for licensed content');
  }

  private async requireRevision(questionId: string, versionId: string) {
    const revision = await this.database.questionVersion.findFirst({ where: { id: versionId, questionId }, include: { question: true, options: { orderBy: { sequence: 'asc' } }, answerKeys: { orderBy: { version: 'desc' }, take: 1 }, explanations: { orderBy: { version: 'desc' }, take: 1 }, mappings: true, provenance: true, licences: true } });
    if (!revision) throw new NotFoundException('Question revision not found');
    return revision;
  }

  private parseReview(input: unknown): ReviewInput { if (!input || typeof input !== 'object') throw new BadRequestException('Review payload is required'); const value = input as Record<string, unknown>; const notes = typeof value.notes === 'string' ? value.notes.trim() : ''; if (!notes || notes.length > 5000) throw new BadRequestException('Review notes are required'); return { notes, evidence: value.evidence as Prisma.InputJsonValue | undefined }; }
  private toSnapshot(revision: Awaited<ReturnType<QuestionReviewService['requireRevision']>>) { return { questionId: revision.questionId, revisionId: revision.id, version: revision.version, type: revision.type, languageCode: revision.languageCode, prompt: revision.prompt, options: revision.options.map((option) => ({ key: option.optionKey, text: option.optionText, sequence: option.sequence })), answerKey: revision.answerKeys[0]?.correctAnswers, explanation: revision.explanations[0]?.explanation, mappings: revision.mappings.map((mapping) => mapping.syllabusTopicId) }; }
}
