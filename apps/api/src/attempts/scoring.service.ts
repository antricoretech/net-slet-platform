import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { scoreConfiguredAttempt, type AnswerSelectionEvent, type ConfiguredScoringResult, type PolicyScoringQuestion, type ScoringPolicyConfig } from '@net-slet/exam-rules';
import { AttemptStatus, AuditEventType, Prisma, ResultReleaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AttemptsService } from './attempts.service';
import { LearningService } from './learning.service';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const strings = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : [];
const requiredString = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim()) throw new ConflictException(`Published test form scoring configuration is missing ${label}`); return value; };

interface StoredSnapshot { scoringPolicy?: unknown; }
interface ResultSummary { scoreRunReference: string; policyId: string; policyVersion: string; scale: number; totalMarksScaled: number; maximumMarksScaled: number; correct: number; incorrect: number; unattempted: number; attempted: number; dropped: number; papers: ConfiguredScoringResult['papers']; }

function parsePolicy(snapshot: unknown): ScoringPolicyConfig & { attemptCeilings?: Readonly<Record<string, number>> } {
  const config = record((record(snapshot) as StoredSnapshot).scoringPolicy);
  const raw = {
    policyId: requiredString(config.policyId, 'policyId'),
    version: requiredString(config.version, 'version'),
    provenance: config.provenance,
    positiveMarksScaled: config.positiveMarksScaled,
    wrongMarksScaled: config.wrongMarksScaled,
    unattemptedMarksScaled: config.unattemptedMarksScaled,
    scale: config.scale,
    excessAttemptPolicy: config.excessAttemptPolicy,
    countsUnansweredAsAttempt: config.countsUnansweredAsAttempt,
  };
  if (!['VERIFIED', 'RESEARCH_ONLY', 'UNRESOLVED'].includes(String(raw.provenance)) || !['REJECT', 'ALL_RESPONSES_COUNT', 'UNRESOLVED'].includes(String(raw.excessAttemptPolicy)) || ![raw.positiveMarksScaled, raw.wrongMarksScaled, raw.unattemptedMarksScaled, raw.scale].every((value) => typeof value === 'number') || typeof raw.countsUnansweredAsAttempt !== 'boolean') throw new ConflictException('Published test form scoring configuration is invalid');
  const attemptCeilings = record(config.attemptCeilings);
  return { ...raw, provenance: raw.provenance as ScoringPolicyConfig['provenance'], excessAttemptPolicy: raw.excessAttemptPolicy as ScoringPolicyConfig['excessAttemptPolicy'], positiveMarksScaled: raw.positiveMarksScaled as number, wrongMarksScaled: raw.wrongMarksScaled as number, unattemptedMarksScaled: raw.unattemptedMarksScaled as number, scale: raw.scale as number, countsUnansweredAsAttempt: raw.countsUnansweredAsAttempt as boolean, ...(Object.keys(attemptCeilings).length ? { attemptCeilings: Object.fromEntries(Object.entries(attemptCeilings).map(([key, value]) => [key, Number(value)])) } : {}) };
}

function correctOptions(value: unknown): string[] {
  const direct = strings(value);
  if (direct.length || Array.isArray(value)) return direct;
  const object = record(value);
  const values = Object.values(object);
  if (values.every((item) => typeof item === 'string')) return values as string[];
  throw new ConflictException('Published answer key format is unsupported for deterministic scoring');
}

@Injectable()
export class ScoringService {
  constructor(private readonly database: PrismaService, @Optional() private readonly learning?: LearningService, @Optional() private readonly attempts?: AttemptsService) {}

  async score(accountId: string, attemptId: string, transaction?: Prisma.TransactionClient) {
    try {
      const work = async (tx: Prisma.TransactionClient) => {
        await this.lockAttempt(tx, attemptId);
        const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { result: { include: { scoreRun: true } }, answers: true, answerEvents: { orderBy: { sequence: 'asc' } }, testForm: { include: { questions: { orderBy: { sequence: 'asc' }, include: { answerKeyVersion: true } }, patternVersion: true } } } });
        if (!attempt) throw new NotFoundException('Attempt not found');
        if (attempt.result) return this.toPublicResult(attempt.id, attempt.result);
        if (attempt.status !== AttemptStatus.SUBMITTED && attempt.status !== AttemptStatus.EXPIRED) throw new ConflictException('Only a terminal attempt can be scored');
        const policy = parsePolicy(attempt.testForm.snapshot);
        const sections = record(attempt.testForm.snapshot).sessions;
        const sectionPolicy = (sessionKey: string, sectionKey: string): string => {
          const sessions = Array.isArray(sections) ? sections : [];
          const session = sessions.map(record).find((item) => item.key === sessionKey);
          const section = Array.isArray(session?.sections) ? session.sections.map(record).find((item) => item.key === sectionKey) : undefined;
          if (typeof section?.answerPolicy !== 'string') throw new ConflictException(`Published test form is missing an answer policy for ${sessionKey}/${sectionKey}`);
          return section.answerPolicy;
        };
        const questions: PolicyScoringQuestion[] = attempt.testForm.questions.map((item) => {
          const key = item.answerKeyVersion;
          if (!key) throw new ConflictException(`Approved answer key is missing for ${item.questionVersionId}`);
          const questionSnapshot = record(item.snapshot);
          const options = Array.isArray(questionSnapshot.options) ? questionSnapshot.options.map(record).map((option) => option.id).filter((id): id is string => typeof id === 'string') : [];
          return { questionVersionId: item.questionVersionId, paperKey: item.sessionKey, sectionKey: item.sectionKey, policy: sectionPolicy(item.sessionKey, item.sectionKey) as PolicyScoringQuestion['policy'], optionIds: options, correctOptionIds: correctOptions(key.correctAnswers), ...(key.exactMatch ? { acceptedCorrectOptionSets: [correctOptions(key.correctAnswers)] } : {}) };
        });
        const events: AnswerSelectionEvent[] = attempt.answerEvents.map((event) => ({ sequence: event.sequence, questionVersionId: event.questionVersionId, selectedOptionIds: strings(event.selectedOptionIds), occurredAt: event.occurredAt.toISOString(), idempotencyKey: event.idempotencyKey }));
        const scored = scoreConfiguredAttempt({ policy, questions, events, attemptCeilings: policy.attemptCeilings });
        const inputSnapshotHash = attempt.testForm.snapshotHash;
        const runNumber = (await tx.scoreRun.count({ where: { attemptId: attempt.id } })) + 1;
        const scoreRun = await tx.scoreRun.create({ data: { attemptId: attempt.id, runNumber, scoreRunHash: scored.scoreRunHash, policyId: scored.policyId, policyVersion: scored.policyVersion, inputSnapshotHash, result: scored as unknown as Prisma.InputJsonValue } });
        const summary: ResultSummary = { scoreRunReference: scoreRun.scoreRunHash, policyId: scored.policyId, policyVersion: scored.policyVersion, scale: scored.scale, totalMarksScaled: scored.totalMarksScaled, maximumMarksScaled: scored.maximumMarksScaled, correct: scored.correct, incorrect: scored.incorrect, unattempted: scored.unattempted, attempted: scored.attempted, dropped: scored.dropped, papers: scored.papers };
        const result = await tx.attemptResult.create({ data: { attemptId: attempt.id, scoreRunId: scoreRun.id, status: ResultReleaseStatus.PENDING, summary: summary as unknown as Prisma.InputJsonValue } });
        await tx.auditEvent.create({ data: { type: AuditEventType.SCORE_RUN_CREATED, accountId, attemptId: attempt.id, metadata: { scoreRunId: scoreRun.id, scoreRunHash: scoreRun.scoreRunHash, policyId: scoreRun.policyId, policyVersion: scoreRun.policyVersion } } });
        if (this.learning) await this.learning.rebuildForAttempt(tx, accountId, attempt.id);
        return this.toPublicResult(attempt.id, { ...result, scoreRun });
      };
      return transaction ? await work(transaction) : await this.database.$transaction(work);
    } catch (error) {
      if (this.isUniqueError(error)) {
        const result = await this.database.attemptResult.findFirst({ where: { attemptId, attempt: { accountId } }, include: { scoreRun: true } });
        if (result) return this.toPublicResult(attemptId, result);
      }
      throw error;
    }
  }

  async finalize(accountId: string, attemptId: string) {
    return this.database.$transaction(async (tx) => {
      await this.lockAttempt(tx, attemptId);
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: true } });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (this.attempts) await this.attempts.expireDueSessions(tx, attempt, accountId, new Date());
      const current = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: true } });
      if (!current) throw new NotFoundException('Attempt not found');
      if (current.status !== AttemptStatus.SUBMITTED && current.status !== AttemptStatus.EXPIRED) {
        if (current.sessions.some((session) => session.status !== 'SUBMITTED' && session.status !== 'EXPIRED')) throw new ConflictException('All attempt sessions must be submitted or expired first');
        const hasExpiredSession = current.sessions.some((session) => session.status === 'EXPIRED');
        await tx.attempt.update({ where: { id: current.id }, data: { status: hasExpiredSession ? AttemptStatus.EXPIRED : AttemptStatus.SUBMITTED, submittedAt: new Date(), ...(hasExpiredSession ? { expiredAt: new Date() } : {}), revision: { increment: 1 } } });
        await tx.auditEvent.create({ data: { type: AuditEventType.ATTEMPT_SUBMITTED, accountId, attemptId: attempt.id, metadata: { finalization: 'ATOMIC_WITH_SCORE' } } });
      }
      return this.score(accountId, attemptId, tx);
    });
  }

  async getResult(accountId: string, attemptId: string) {
    const result = await this.database.attemptResult.findFirst({ where: { attemptId, attempt: { accountId } }, include: { scoreRun: true } });
    if (!result) throw new NotFoundException('Result not found');
    return this.toPublicResult(attemptId, result);
  }

  private toPublicResult(attemptId: string, result: { status: ResultReleaseStatus; summary: Prisma.JsonValue; scoreRun: { scoreRunHash: string } | null }) {
    const summary = record(result.summary);
    return { attemptId, status: result.status, scoreRunReference: result.scoreRun?.scoreRunHash ?? summary.scoreRunReference, scale: summary.scale, totalMarksScaled: summary.totalMarksScaled, maximumMarksScaled: summary.maximumMarksScaled, correct: summary.correct, incorrect: summary.incorrect, unattempted: summary.unattempted, attempted: summary.attempted, dropped: summary.dropped, papers: Array.isArray(summary.papers) ? summary.papers : [], explanations: result.status === ResultReleaseStatus.PUBLISHED ? 'AVAILABLE_AFTER_RELEASE' : 'UNAVAILABLE_UNTIL_RELEASE' };
  }

  private isUniqueError(error: unknown): boolean { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }

  private async lockAttempt(tx: Prisma.TransactionClient, attemptId: string): Promise<void> {
    if (typeof tx.$executeRaw === 'function') await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${attemptId}, 0))`);
  }
}
