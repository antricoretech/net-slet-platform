import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { type CandidateAttemptState, type TestFormSnapshot } from '@net-slet/exam-rules';
import { AttemptSessionStatus, AttemptStatus, AuditEventType, PatternStatus, Prisma, TestFormStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

type TimingPolicy = 'CONTINUOUS' | 'INDEPENDENT' | 'SEQUENTIAL_LOCKED';
type AnswerPolicy = 'SINGLE_SELECT' | 'MULTI_SELECT' | 'EXACT_MATCH';

interface StoredSection { key: string; answerPolicy?: AnswerPolicy; }
interface StoredSession {
  key: string;
  sequence: number;
  timingPolicy: TimingPolicy;
  durationSeconds: number;
  sections: StoredSection[];
}
type StoredSnapshot = TestFormSnapshot & { sessions: StoredSession[] };

interface AttemptSnapshotQuestion {
  questionVersionId: string;
  type: string;
  options?: readonly { id: string; label: string }[];
}

const FORBIDDEN_CANDIDATE_KEYS = new Set(['answerKey', 'correctOptionIds', 'correctAnswer', 'explanation', 'solution']);
function sha256(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function jsonObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function jsonArray(value: unknown): string[] { return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : []; }
function assertCandidateSafeQuestion(value: unknown): void { if (Object.keys(jsonObject(value)).some((key) => FORBIDDEN_CANDIDATE_KEYS.has(key))) throw new BadRequestException('Published test form contains non-candidate question data'); }

function assertPublicationEligible(snapshot: StoredSnapshot, patternStatus?: string): void {
  if (patternStatus && patternStatus !== PatternStatus.PUBLISHED) throw new ConflictException('The test form pattern is not published');
  const publication = jsonObject(jsonObject(snapshot).publication);
  if (process.env.NODE_ENV !== 'production' && publication.qaOnly === true) return;
  const requiredFlags = ['officialEvidenceVerified', 'contentInventoryQualified', 'rightsCleared', 'reviewerApproved', 'regressionEvidence'];
  const missing = requiredFlags.filter((key) => key === 'regressionEvidence' ? !Array.isArray(publication[key]) || (publication[key] as unknown[]).length === 0 : publication[key] !== true);
  if (publication.status !== 'READY' || missing.length) throw new ConflictException(`Test form is not eligible for candidate delivery: ${missing.length ? missing.join(', ') : 'publication status is not READY'}`);
}

function parseSnapshot(value: unknown): StoredSnapshot {
  const raw = jsonObject(value);
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.map((item) => {
    const session = jsonObject(item);
    const sections = Array.isArray(session.sections) ? session.sections.map((section) => {
      const parsed = jsonObject(section);
      return { key: typeof parsed.key === 'string' ? parsed.key : '', ...(typeof parsed.answerPolicy === 'string' ? { answerPolicy: parsed.answerPolicy as AnswerPolicy } : {}) };
    }) : [];
    return { key: typeof session.key === 'string' ? session.key : '', sequence: Number(session.sequence), timingPolicy: session.timingPolicy as TimingPolicy, durationSeconds: Number(session.durationSeconds), sections };
  }) : [];
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  if (typeof raw.snapshotId !== 'string' || typeof raw.snapshotHash !== 'string' || !raw.blueprint || typeof raw.blueprint !== 'object' || sections.length === 0 || sessions.length === 0) throw new BadRequestException('Published test form snapshot is incomplete');
  if (sessions.some((session) => !session.key || !Number.isSafeInteger(session.sequence) || !Number.isSafeInteger(session.durationSeconds) || session.durationSeconds <= 0 || !['CONTINUOUS', 'INDEPENDENT', 'SEQUENTIAL_LOCKED'].includes(session.timingPolicy) || session.sections.length === 0 || session.sections.some((section) => !section.key))) throw new BadRequestException('Published test form timing configuration is invalid');
  for (const section of sections) {
    const sectionObject = jsonObject(section);
    for (const question of Array.isArray(sectionObject.questions) ? sectionObject.questions : []) {
      assertCandidateSafeQuestion(question);
    }
  }
  return raw as unknown as StoredSnapshot;
}

function sessionDefinitions(snapshot: StoredSnapshot): StoredSession[] { return [...snapshot.sessions].sort((left, right) => left.sequence - right.sequence); }

@Injectable()
export class AttemptsService {
  constructor(private readonly database: PrismaService) {}

  async start(accountId: string, input: unknown) {
    const { testFormId, idempotencyKey } = this.parseStart(input);
    const existing = await this.database.attempt.findUnique({ where: { accountId_startIdempotencyKey: { accountId, startIdempotencyKey: idempotencyKey } }, include: { sessions: true, answers: true, testForm: true } });
    if (existing) return this.toStartResponse(existing, parseSnapshot(existing.testForm.snapshot));

    const form = await this.database.testForm.findFirst({ where: { id: testFormId, status: TestFormStatus.PUBLISHED, patternVersion: { status: PatternStatus.PUBLISHED } }, include: { questions: true, patternVersion: true } });
    if (!form) throw new NotFoundException('Published test form not found');
    const snapshot = parseSnapshot(form.snapshot);
    assertPublicationEligible(snapshot, form.patternVersion?.status);
    form.questions.forEach((question) => assertCandidateSafeQuestion(question.snapshot));
    const sessions = sessionDefinitions(snapshot);
    const attempt = await this.database.$transaction(async (tx) => {
      const created = await tx.attempt.create({
        data: {
          accountId,
          testFormId: form.id,
          status: AttemptStatus.READY,
          startIdempotencyKey: idempotencyKey,
          sessions: { create: sessions.map((session) => ({ key: session.key, sequence: session.sequence, status: session.sequence === 0 ? AttemptSessionStatus.READY : AttemptSessionStatus.LOCKED, timingPolicy: session.timingPolicy, durationSeconds: session.durationSeconds })) },
        },
        include: { sessions: true, answers: true, testForm: true },
      });
      await tx.auditEvent.create({ data: { type: AuditEventType.ATTEMPT_CREATED, accountId, attemptId: created.id, metadata: { testFormId: form.id, snapshotHash: form.snapshotHash } } });
      return created;
    });
    return this.toStartResponse(attempt, snapshot);
  }

  async availableForms() {
    const forms = await this.database.testForm.findMany({ where: { status: TestFormStatus.PUBLISHED, patternVersion: { status: PatternStatus.PUBLISHED } }, include: { patternVersion: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] });
    return forms.flatMap((form) => {
      try {
        const snapshot = parseSnapshot(form.snapshot);
        assertPublicationEligible(snapshot, form.patternVersion.status);
        return [{ id: form.id, snapshotId: snapshot.snapshotId, examCode: snapshot.blueprint.examCode, cycleCode: snapshot.blueprint.cycleCode, subjectCode: snapshot.blueprint.subjectCode, questionCount: snapshot.sections.reduce((count, section) => count + section.questions.length, 0), sectionCount: snapshot.sections.length, publishedAt: form.publishedAt?.toISOString() }];
      } catch {
        return [];
      }
    });
  }

  async state(accountId: string, attemptId: string) {
    await this.synchronizeExpiry(accountId, attemptId);
    const attempt = await this.database.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return this.toState(attempt, parseSnapshot(attempt.testForm.snapshot));
  }

  async form(accountId: string, attemptId: string) {
    await this.synchronizeExpiry(accountId, attemptId);
    const attempt = await this.database.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const snapshot = parseSnapshot(attempt.testForm.snapshot);
    for (const section of snapshot.sections) for (const question of section.questions) assertCandidateSafeQuestion(question);
    return { attemptId: attempt.id, form: snapshot, state: this.toState(attempt, snapshot) };
  }

  async activateSession(accountId: string, attemptId: string, sessionId: string) {
    const now = new Date();
    const outcome = await this.database.$transaction(async (tx) => {
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.status !== AttemptStatus.READY && attempt.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Attempt cannot start another session');
      const session = attempt.sessions.find((item) => item.id === sessionId);
      if (!session) throw new NotFoundException('Attempt session not found');
      if (session.status === AttemptSessionStatus.LOCKED) {
        const prior = attempt.sessions.filter((item) => item.sequence < session.sequence);
        if (prior.some((item) => item.status !== AttemptSessionStatus.SUBMITTED)) throw new ConflictException('Previous session must be submitted first');
      }
      if (session.status !== AttemptSessionStatus.READY && session.status !== AttemptSessionStatus.IN_PROGRESS) throw new ConflictException('Attempt session is not available');
      if (session.deadlineAt && now >= session.deadlineAt) {
        await this.expireDueSession(tx, attempt.id, session.id, accountId, now);
        return { kind: 'EXPIRED' as const };
      }
      const startedAt = session.startedAt ?? now;
      const deadlineAt = session.deadlineAt ?? new Date(startedAt.getTime() + session.durationSeconds * 1000);
      const updated = await tx.attempt.update({ where: { id: attempt.id }, data: { status: AttemptStatus.IN_PROGRESS, startedAt: attempt.startedAt ?? startedAt, revision: { increment: 1 }, sessions: { update: { where: { id: session.id }, data: { status: AttemptSessionStatus.IN_PROGRESS, startedAt, deadlineAt } } } }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      await tx.auditEvent.create({ data: { type: AuditEventType.ATTEMPT_STARTED, accountId, attemptId: attempt.id, metadata: { sessionId: session.id, deadlineAt: deadlineAt.toISOString() } } });
      return { kind: 'ACTIVATED' as const, state: this.toState(updated, parseSnapshot(updated.testForm.snapshot)) };
    });
    if (outcome.kind === 'EXPIRED') throw new ConflictException('Attempt session has expired');
    return outcome.state;
  }

  async saveAnswer(accountId: string, attemptId: string, questionVersionId: string, input: unknown) {
    const parsed = this.parseAnswer(input);
    const outcome = await this.database.$transaction(async (tx) => {
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: { include: { questions: true } } } });
      if (!attempt) throw new NotFoundException('Attempt not found');
      if (attempt.status !== AttemptStatus.IN_PROGRESS) throw new ConflictException('Attempt is not active');
      const activeSession = attempt.sessions.find((session) => session.status === AttemptSessionStatus.IN_PROGRESS);
      if (!activeSession) throw new ConflictException('No active attempt session');
      const now = new Date();
      if (activeSession.deadlineAt) {
        const deadlineGuard = await tx.attemptSession.updateMany({ where: { id: activeSession.id, attemptId: attempt.id, status: AttemptSessionStatus.IN_PROGRESS, deadlineAt: { gt: now } }, data: { updatedAt: now } });
        if (deadlineGuard.count !== 1) {
          await this.expireDueSession(tx, attempt.id, activeSession.id, accountId, now);
          return { kind: 'EXPIRED' as const };
        }
      }
      const question = attempt.testForm.questions.find((item) => item.questionVersionId === questionVersionId && item.sessionKey === activeSession.key);
      if (!question) throw new BadRequestException('Question is not part of the active session');
      const snapshotQuestion = jsonObject(question.snapshot) as unknown as AttemptSnapshotQuestion;
      const policy = this.answerPolicy(parseSnapshot(attempt.testForm.snapshot), activeSession.key, question.sectionKey);
      const options = Array.isArray(snapshotQuestion.options) ? snapshotQuestion.options.map((option) => option.id) : [];
      const selection = [...new Set(parsed.selectedOptionIds)];
      if (selection.some((option) => !options.includes(option))) throw new BadRequestException('Selected option is not available for this question');
      if (policy === 'SINGLE_SELECT' && selection.length > 1) throw new BadRequestException('Single-select questions accept at most one option');
      const currentAnswer = attempt.answers.find((answer) => answer.questionVersionId === questionVersionId);
      const effectiveMarkedForReview = parsed.markedForReview ?? currentAnswer?.markedForReview ?? false;
      const fingerprint = sha256({ questionVersionId, selectedOptionIds: selection, markedForReview: effectiveMarkedForReview, expectedRevision: parsed.expectedRevision });
      const prior = await tx.attemptAnswerEvent.findUnique({ where: { attemptId_idempotencyKey: { attemptId, idempotencyKey: parsed.idempotencyKey } } });
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new ConflictException('Idempotency key was already used with different content');
        return { kind: 'SAVED' as const, response: { accepted: true as const, attemptRevision: attempt.revision, answer: { questionVersionId, selectedOptionIds: jsonArray(prior.selectedOptionIds), markedForReview: effectiveMarkedForReview } } };
      }
      if (attempt.revision !== parsed.expectedRevision) throw new ConflictException('Attempt has changed; reload before retrying');
      await tx.attempt.updateMany({ where: { id: attempt.id, accountId, revision: parsed.expectedRevision }, data: { revision: { increment: 1 } } }).then((result) => { if (result.count !== 1) throw new ConflictException('Attempt has changed; reload before retrying'); });
      const answer = await tx.attemptAnswer.upsert({ where: { attemptId_questionVersionId: { attemptId, questionVersionId } }, update: { selectedOptionIds: selection as Prisma.InputJsonValue, markedForReview: effectiveMarkedForReview, revision: { increment: 1 }, lastIdempotencyKey: parsed.idempotencyKey }, create: { attemptId, questionVersionId, selectedOptionIds: selection as Prisma.InputJsonValue, markedForReview: effectiveMarkedForReview, lastIdempotencyKey: parsed.idempotencyKey } });
      await tx.attemptAnswerEvent.create({ data: { attemptId, questionVersionId, sequence: attempt.revision + 1, selectedOptionIds: selection as Prisma.InputJsonValue, fingerprint, idempotencyKey: parsed.idempotencyKey } });
      await tx.auditEvent.create({ data: { type: AuditEventType.ANSWER_SAVED, accountId, attemptId, questionVersionId, metadata: { attemptRevision: attempt.revision + 1 } } });
      return { kind: 'SAVED' as const, response: { accepted: true as const, attemptRevision: attempt.revision + 1, answer: { questionVersionId, selectedOptionIds: selection, markedForReview: answer.markedForReview } } };
    });
    if (outcome.kind === 'EXPIRED') throw new ConflictException('Attempt session has expired');
    return outcome.response;
  }

  async submitSession(accountId: string, attemptId: string, sessionId: string) {
    return this.database.$transaction(async (tx) => {
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      if (!attempt) throw new NotFoundException('Attempt not found');
      const session = attempt.sessions.find((item) => item.id === sessionId);
      if (!session) throw new NotFoundException('Attempt session not found');
      if (session.status !== AttemptSessionStatus.IN_PROGRESS) throw new ConflictException('Only an active session can be submitted');
      const now = new Date();
      if (session.deadlineAt) {
        const deadlineGuard = await tx.attemptSession.updateMany({ where: { id: session.id, attemptId: attempt.id, status: AttemptSessionStatus.IN_PROGRESS, deadlineAt: { gt: now } }, data: { updatedAt: now } });
        if (deadlineGuard.count !== 1) {
          await this.expireDueSession(tx, attempt.id, session.id, accountId, now);
          const refreshed = await tx.attempt.findFirst({ where: { id: attempt.id, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
          if (!refreshed) throw new NotFoundException('Attempt not found');
          return this.toState(refreshed, parseSnapshot(refreshed.testForm.snapshot));
        }
      }
      const updated = await tx.attempt.update({ where: { id: attempt.id }, data: { revision: { increment: 1 }, sessions: { update: { where: { id: session.id }, data: { status: AttemptSessionStatus.SUBMITTED, submittedAt: new Date() } } } }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      await tx.auditEvent.create({ data: { type: AuditEventType.SESSION_SUBMITTED, accountId, attemptId, metadata: { sessionId } } });
      return this.toState(updated, parseSnapshot(updated.testForm.snapshot));
    });
  }

  async submitAttempt(accountId: string, attemptId: string) {
    return this.database.$transaction(async (tx) => {
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      if (!attempt) throw new NotFoundException('Attempt not found');
      const now = new Date();
      await this.expireDueSessions(tx, attempt, accountId, now);
      const current = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      if (!current) throw new NotFoundException('Attempt not found');
      if (current.status === AttemptStatus.SUBMITTED || current.status === AttemptStatus.EXPIRED) return this.toState(current, parseSnapshot(current.testForm.snapshot));
      if (current.sessions.some((session) => session.status !== AttemptSessionStatus.SUBMITTED)) throw new ConflictException('All attempt sessions must be submitted first');
      const updated = await tx.attempt.update({ where: { id: current.id }, data: { status: AttemptStatus.SUBMITTED, submittedAt: now, revision: { increment: 1 } }, include: { sessions: { orderBy: { sequence: 'asc' } }, answers: true, testForm: true } });
      await tx.auditEvent.create({ data: { type: AuditEventType.ATTEMPT_SUBMITTED, accountId, attemptId, metadata: { snapshotHash: updated.testForm.snapshotHash } } });
      return this.toState(updated, parseSnapshot(updated.testForm.snapshot));
    });
  }

  private parseStart(input: unknown): { testFormId: string; idempotencyKey: string } {
    const value = jsonObject(input);
    const testFormId = typeof value.testFormId === 'string' ? value.testFormId.trim() : '';
    const idempotencyKey = typeof value.idempotencyKey === 'string' ? value.idempotencyKey.trim() : '';
    if (!testFormId || !idempotencyKey || idempotencyKey.length > 160) throw new BadRequestException('Test form and idempotency key are required');
    return { testFormId, idempotencyKey };
  }

  private parseAnswer(input: unknown): { selectedOptionIds: string[]; markedForReview?: boolean; expectedRevision: number; idempotencyKey: string } {
    const value = jsonObject(input);
    const selectedOptionIds = Array.isArray(value.selectedOptionIds) && value.selectedOptionIds.every((item) => typeof item === 'string') ? [...value.selectedOptionIds] as string[] : [];
    const markedForReview = typeof value.markedForReview === 'boolean' ? value.markedForReview : undefined;
    const expectedRevision = typeof value.expectedRevision === 'number' ? value.expectedRevision : Number.NaN;
    const idempotencyKey = typeof value.idempotencyKey === 'string' ? value.idempotencyKey.trim() : '';
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !idempotencyKey || idempotencyKey.length > 160) throw new BadRequestException('Answer revision and idempotency key are required');
    return { selectedOptionIds, markedForReview, expectedRevision, idempotencyKey };
  }

  private answerPolicy(snapshot: StoredSnapshot, sessionKey: string, sectionKey: string): AnswerPolicy {
    const session = snapshot.sessions.find((item) => item.key === sessionKey);
    const section = session?.sections.find((item) => item.key === sectionKey);
    if (!section?.answerPolicy) throw new BadRequestException('Published test form is missing an answer policy');
    return section.answerPolicy;
  }

  private async synchronizeExpiry(accountId: string, attemptId: string): Promise<void> {
    await this.database.$transaction(async (tx) => {
      const attempt = await tx.attempt.findFirst({ where: { id: attemptId, accountId }, include: { sessions: true } });
      if (!attempt || (attempt.status !== AttemptStatus.READY && attempt.status !== AttemptStatus.IN_PROGRESS)) return;
      await this.expireDueSessions(tx, attempt, accountId, new Date());
    });
  }

  async expireDueSessions(tx: Prisma.TransactionClient, attempt: { id: string; status: AttemptStatus; sessions: Array<{ id: string; status: AttemptSessionStatus; deadlineAt: Date | null }> }, accountId: string, now: Date): Promise<void> {
    for (const session of attempt.sessions) {
      if (session.status === AttemptSessionStatus.IN_PROGRESS && session.deadlineAt && now >= session.deadlineAt) await this.expireDueSession(tx, attempt.id, session.id, accountId, now);
    }
  }

  private async expireDueSession(tx: Prisma.TransactionClient, attemptId: string, sessionId: string, accountId: string, now: Date): Promise<void> {
    const expired = await tx.attemptSession.updateMany({ where: { id: sessionId, attemptId, status: AttemptSessionStatus.IN_PROGRESS, deadlineAt: { lte: now } }, data: { status: AttemptSessionStatus.EXPIRED, expiredAt: now } });
    if (expired.count !== 1) return;
    const sessions = await tx.attemptSession.findMany({ where: { attemptId } });
    const terminal = sessions.length > 0 && sessions.every((session) => session.status === AttemptSessionStatus.SUBMITTED || session.status === AttemptSessionStatus.EXPIRED);
    if (terminal) {
      const updated = await tx.attempt.updateMany({ where: { id: attemptId, status: { in: [AttemptStatus.READY, AttemptStatus.IN_PROGRESS] } }, data: { status: AttemptStatus.EXPIRED, expiredAt: now, revision: { increment: 1 } } });
      if (updated.count === 1) await tx.auditEvent.create({ data: { type: AuditEventType.ATTEMPT_EXPIRED, accountId, attemptId, metadata: { sessionId, expiredAt: now.toISOString() } } });
    } else {
      await tx.attempt.updateMany({ where: { id: attemptId, status: AttemptStatus.IN_PROGRESS }, data: { revision: { increment: 1 } } });
    }
  }

  private toStartResponse(attempt: { id: string; accountId: string; status: AttemptStatus; revision: number; sessions: Array<{ id: string; key: string; status: AttemptSessionStatus; timingPolicy: string; durationSeconds: number; deadlineAt: Date | null; sequence: number }>; answers: Array<{ questionVersionId: string; selectedOptionIds: Prisma.JsonValue; markedForReview: boolean }>; testForm: { snapshot: Prisma.JsonValue } }, snapshot: StoredSnapshot) {
    return { attemptId: attempt.id, form: snapshot, state: this.toState(attempt, snapshot), revision: attempt.revision };
  }

  private toState(attempt: { id: string; accountId?: string; status: AttemptStatus; revision: number; sessions: Array<{ id: string; key: string; status: AttemptSessionStatus; timingPolicy: string; durationSeconds: number; deadlineAt: Date | null; sequence: number }>; answers: Array<{ questionVersionId: string; selectedOptionIds: Prisma.JsonValue; markedForReview: boolean }>; testForm?: { snapshot: Prisma.JsonValue } }, snapshot: StoredSnapshot): CandidateAttemptState & { attemptId: string; ownerAccountId?: string; revision: number; activeSessionId?: string; sessions: Array<{ id: string; key: string; sequence: number; status: AttemptSessionStatus; timingPolicy: string; durationSeconds: number; deadlineAt?: string }>; answers: Array<{ questionVersionId: string; selectedOptionIds: string[]; markedForReview: boolean }> } {
    const active = attempt.sessions.find((session) => session.status === AttemptSessionStatus.IN_PROGRESS);
    const deadlineAt = active?.deadlineAt?.toISOString();
    const remainingSeconds = deadlineAt ? Math.max(0, Math.floor((Date.parse(deadlineAt) - Date.now()) / 1000)) : 0;
    const questionIds = snapshot.sections.flatMap((section) => section.questions.map((question) => question.questionVersionId));
    const currentQuestionIndex = Math.max(0, questionIds.findIndex((questionId) => !attempt.answers.some((answer) => answer.questionVersionId === questionId)));
    return { attemptId: attempt.id, ...(attempt.accountId ? { ownerAccountId: attempt.accountId } : {}), status: attempt.status, deadlineAt, remainingSeconds, currentQuestionIndex, revision: attempt.revision, sessions: attempt.sessions.map((session) => ({ id: session.id, key: session.key, sequence: session.sequence, status: session.status, timingPolicy: session.timingPolicy, durationSeconds: session.durationSeconds, ...(session.deadlineAt ? { deadlineAt: session.deadlineAt.toISOString() } : {}) })), answers: attempt.answers.map((answer) => ({ questionVersionId: answer.questionVersionId, selectedOptionIds: jsonArray(answer.selectedOptionIds), markedForReview: answer.markedForReview })), ...(active ? { activeSessionId: active.id } : {}) };
  }
}
