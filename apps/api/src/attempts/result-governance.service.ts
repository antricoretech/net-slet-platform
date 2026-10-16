import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { canRescorePinnedForm, scoreConfiguredAttempt, type AnswerSelectionEvent, type PolicyScoringQuestion, type ScoringPolicyConfig } from '@net-slet/exam-rules';
import { AttemptStatus, AuditEventType, Prisma, QuestionVersionStatus, ResultReleaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LearningService } from './learning.service';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const strings = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : [];
const text = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new ConflictException(`${label} is required`); return value.trim(); };

function parsePolicy(snapshot: unknown): ScoringPolicyConfig & { attemptCeilings?: Readonly<Record<string, number>> } {
  const config = record(record(snapshot).scoringPolicy);
  const values = { policyId: config.policyId, version: config.version, provenance: config.provenance, positiveMarksScaled: config.positiveMarksScaled, wrongMarksScaled: config.wrongMarksScaled, unattemptedMarksScaled: config.unattemptedMarksScaled, scale: config.scale, excessAttemptPolicy: config.excessAttemptPolicy, countsUnansweredAsAttempt: config.countsUnansweredAsAttempt };
  if (typeof values.policyId !== 'string' || typeof values.version !== 'string' || !['VERIFIED', 'RESEARCH_ONLY', 'UNRESOLVED'].includes(String(values.provenance)) || !['REJECT', 'ALL_RESPONSES_COUNT', 'UNRESOLVED'].includes(String(values.excessAttemptPolicy)) || ![values.positiveMarksScaled, values.wrongMarksScaled, values.unattemptedMarksScaled, values.scale].every((value) => typeof value === 'number') || typeof values.countsUnansweredAsAttempt !== 'boolean') throw new ConflictException('Published test form scoring configuration is invalid');
  const ceilings = record(config.attemptCeilings);
  return { policyId: values.policyId as string, version: values.version as string, provenance: values.provenance as ScoringPolicyConfig['provenance'], excessAttemptPolicy: values.excessAttemptPolicy as ScoringPolicyConfig['excessAttemptPolicy'], positiveMarksScaled: values.positiveMarksScaled as number, wrongMarksScaled: values.wrongMarksScaled as number, unattemptedMarksScaled: values.unattemptedMarksScaled as number, scale: values.scale as number, countsUnansweredAsAttempt: values.countsUnansweredAsAttempt as boolean, ...(Object.keys(ceilings).length ? { attemptCeilings: Object.fromEntries(Object.entries(ceilings).map(([key, value]) => [key, Number(value)])) } : {}) };
}

@Injectable()
export class ResultGovernanceService {
  constructor(private readonly database: PrismaService, private readonly learning: LearningService) {}

  async listPending() {
    const results = await this.database.attemptResult.findMany({ where: { status: ResultReleaseStatus.PENDING }, orderBy: { createdAt: 'asc' }, include: { attempt: { select: { id: true, accountId: true, status: true, submittedAt: true, expiredAt: true, testForm: { select: { subjectCode: true, version: true } } } }, scoreRun: { select: { scoreRunHash: true, runNumber: true } } } });
    return results.map((result) => ({ id: result.id, attemptId: result.attemptId, status: result.status, createdAt: result.createdAt, attempt: result.attempt, scoreRun: result.scoreRun }));
  }

  async publish(attemptId: string, actorId: string, input: unknown) {
    const body = record(input);
    const approvalReference = text(body.approvalReference, 'approvalReference');
    const reason = text(body.reason, 'reason');
    return this.database.$transaction(async (tx) => {
      await this.lock(tx, attemptId);
      const result = await tx.attemptResult.findFirst({ where: { attemptId }, include: { scoreRun: true, attempt: true } });
      if (!result) throw new NotFoundException('Result not found');
      if (result.status === ResultReleaseStatus.PUBLISHED) return this.publicResult(result);
      if (result.attempt.status !== AttemptStatus.SUBMITTED && result.attempt.status !== AttemptStatus.EXPIRED) throw new ConflictException('Only terminal attempts may be published');
      const published = await tx.attemptResult.update({ where: { id: result.id }, data: { status: ResultReleaseStatus.PUBLISHED, releasedAt: new Date(), releasedById: actorId, releaseApprovalReference: approvalReference, releaseReason: reason }, include: { scoreRun: true } });
      await tx.auditEvent.create({ data: { type: AuditEventType.RESULT_RELEASED, accountId: actorId, attemptId, metadata: { resultId: result.id, approvalReference, reason, priorStatus: result.status } } });
      return this.publicResult(published);
    });
  }

  async authorizeCorrection(questionVersionId: string, actorId: string, input: unknown) {
    const body = record(input);
    const reason = text(body.reason, 'reason');
    const approvalReference = text(body.approvalReference, 'approvalReference');
    const evidence = body.evidence && typeof body.evidence === 'object' ? body.evidence : undefined;
    if (!evidence) throw new ConflictException('Evidence is required');
    const correctAnswers = strings(body.correctAnswers);
    if (!correctAnswers.length) throw new ConflictException('At least one corrected answer is required');
    return this.database.$transaction(async (tx) => {
      const revision = await tx.questionVersion.findUnique({ where: { id: questionVersionId }, include: { answerKeys: { orderBy: { version: 'desc' }, take: 1 }, options: true, question: true } });
      if (!revision || !revision.answerKeys[0]) throw new NotFoundException('Approved answer key not found');
      if (revision.status !== QuestionVersionStatus.PUBLISHED) throw new ConflictException('Only published question revisions may receive a correction');
      if (revision.options.some((option) => !correctAnswers.includes(option.optionKey)) || correctAnswers.some((key) => !revision.options.some((option) => option.optionKey === key))) throw new ConflictException('Correction references an option outside the question version');
      const original = revision.answerKeys[0];
      const revised = await tx.questionAnswerKeyVersion.create({ data: { questionVersionId, version: original.version + 1, correctAnswers: correctAnswers as unknown as Prisma.InputJsonValue, exactMatch: body.exactMatch === true, createdById: actorId } });
      const correction = await tx.answerKeyCorrection.create({ data: { questionVersionId, originalAnswerKeyVersionId: original.id, revisedAnswerKeyVersionId: revised.id, authorizedById: actorId, reason, evidence: evidence as Prisma.InputJsonValue, approvalReference } });
      await tx.auditEvent.create({ data: { type: AuditEventType.ANSWER_KEY_CORRECTION_APPROVED, accountId: actorId, questionVersionId, metadata: { correctionId: correction.id, originalAnswerKeyVersionId: original.id, revisedAnswerKeyVersionId: revised.id, approvalReference } } });
      return { correctionId: correction.id, questionVersionId, originalAnswerKeyVersionId: original.id, revisedAnswerKeyVersionId: revised.id, approvalReference };
    });
  }

  async rescore(attemptId: string, actorId: string, input: unknown) {
    const body = record(input);
    const correctionId = text(body.correctionId, 'correctionId');
    const reason = text(body.reason, 'reason');
    const approvalReference = text(body.approvalReference, 'approvalReference');
    const idempotencyKey = text(body.idempotencyKey, 'idempotencyKey');
    return this.database.$transaction(async (tx) => {
      await this.lock(tx, attemptId);
      const existing = await tx.scoreRunLineage.findUnique({ where: { idempotencyKey }, include: { revisedScoreRun: true } });
      if (existing) return { attemptId, status: 'IDEMPOTENT', lineageId: existing.id, scoreRunReference: existing.revisedScoreRun.scoreRunHash };
      const correction = await tx.answerKeyCorrection.findUnique({ where: { id: correctionId }, include: { originalAnswerKeyVersion: true, revisedAnswerKeyVersion: true } });
      if (!correction) throw new NotFoundException('Answer-key correction not found');
      const attempt = await tx.attempt.findUnique({ where: { id: attemptId }, include: { result: { include: { scoreRun: true } }, answerEvents: { orderBy: { sequence: 'asc' } }, testForm: { include: { questions: { orderBy: { sequence: 'asc' }, include: { answerKeyVersion: true } } } } } });
      if (!attempt?.result?.scoreRun) throw new ConflictException('A scored terminal attempt is required');
      if (attempt.status !== AttemptStatus.SUBMITTED && attempt.status !== AttemptStatus.EXPIRED) throw new ConflictException('Only terminal attempts may be rescored');
      const correctedFormQuestion = attempt.testForm.questions.find((question) => question.questionVersionId === correction.questionVersionId);
      if (!correctedFormQuestion || !canRescorePinnedForm(correctedFormQuestion.answerKeyVersionId, correctedFormQuestion.answerKeyVersionId, correction.originalAnswerKeyVersionId)) throw new ConflictException('Correction is not pinned to this test form');
      const snapshot = record(attempt.testForm.snapshot);
      const policy = parsePolicy(snapshot);
      const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
      const sectionPolicy = (sessionKey: string, sectionKey: string) => { const session = sessions.map(record).find((item) => item.key === sessionKey); const section = Array.isArray(session?.sections) ? session.sections.map(record).find((item) => item.key === sectionKey) : undefined; if (typeof section?.answerPolicy !== 'string') throw new ConflictException('Test-form answer policy is missing'); return section.answerPolicy as PolicyScoringQuestion['policy']; };
      const keyRefs = attempt.testForm.questions.map((item) => { const key = item.questionVersionId === correction.questionVersionId ? correction.revisedAnswerKeyVersion : item.answerKeyVersion; if (!key) throw new ConflictException('Pinned answer key is missing'); const questionSnapshot = record(item.snapshot); const optionIds = Array.isArray(questionSnapshot.options) ? questionSnapshot.options.map(record).map((option) => option.id).filter((id): id is string => typeof id === 'string') : []; return { questionVersionId: item.questionVersionId, answerKeyVersionId: key.id, version: key.version, paperKey: item.sessionKey, sectionKey: item.sectionKey, policy: sectionPolicy(item.sessionKey, item.sectionKey), optionIds, correctAnswers: strings(key.correctAnswers) }; });
      const questions: PolicyScoringQuestion[] = keyRefs.map((item) => ({ questionVersionId: item.questionVersionId, paperKey: item.paperKey, sectionKey: item.sectionKey, policy: item.policy, optionIds: item.optionIds, correctOptionIds: item.correctAnswers }));
      const events: AnswerSelectionEvent[] = attempt.answerEvents.map((event) => ({ sequence: event.sequence, questionVersionId: event.questionVersionId, selectedOptionIds: strings(event.selectedOptionIds), occurredAt: event.occurredAt.toISOString(), idempotencyKey: event.idempotencyKey }));
      const scored = scoreConfiguredAttempt({ policy, questions, events, attemptCeilings: policy.attemptCeilings });
      const run = await tx.scoreRun.create({ data: { attemptId, runNumber: (await tx.scoreRun.count({ where: { attemptId } })) + 1, scoreRunHash: scored.scoreRunHash, policyId: scored.policyId, policyVersion: scored.policyVersion, inputSnapshotHash: attempt.testForm.snapshotHash, result: scored as unknown as Prisma.InputJsonValue } });
      const current = attempt.result;
      const summary = { scoreRunReference: run.scoreRunHash, policyId: scored.policyId, policyVersion: scored.policyVersion, scale: scored.scale, totalMarksScaled: scored.totalMarksScaled, maximumMarksScaled: scored.maximumMarksScaled, correct: scored.correct, incorrect: scored.incorrect, unattempted: scored.unattempted, attempted: scored.attempted, dropped: scored.dropped, papers: scored.papers };
      await tx.attemptResult.update({ where: { id: current.id }, data: { scoreRunId: run.id, summary: summary as unknown as Prisma.InputJsonValue } });
      const lineage = await tx.scoreRunLineage.create({ data: { attemptId, originalScoreRunId: current.scoreRunId!, revisedScoreRunId: run.id, originalAnswerKeyReferences: attempt.testForm.questions.map((item) => ({ questionVersionId: item.questionVersionId, answerKeyVersionId: item.answerKeyVersionId })), revisedAnswerKeyReferences: keyRefs.map((item) => ({ questionVersionId: item.questionVersionId, answerKeyVersionId: item.answerKeyVersionId, version: item.version })), reason, approvalReference, idempotencyKey, authorizedById: actorId } });
      await tx.auditEvent.create({ data: { type: AuditEventType.RESULT_RESCORED, accountId: actorId, attemptId, metadata: { lineageId: lineage.id, correctionId, originalScoreRunId: current.scoreRunId, revisedScoreRunId: run.id, approvalReference } } });
      await this.learning.rebuildForAttempt(tx, attempt.accountId, attemptId);
      return { attemptId, status: 'RESCORED', lineageId: lineage.id, scoreRunReference: run.scoreRunHash, releaseStatus: current.status };
    });
  }

  private publicResult(result: { attemptId: string; status: ResultReleaseStatus; releasedAt?: Date | null; releaseApprovalReference?: string | null }) { return { attemptId: result.attemptId, status: result.status, releasedAt: result.releasedAt ?? null, releaseApprovalReference: result.status === ResultReleaseStatus.PUBLISHED ? result.releaseApprovalReference : null }; }
  private async lock(tx: Prisma.TransactionClient, attemptId: string) { await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${attemptId}, 0))`); }
}
