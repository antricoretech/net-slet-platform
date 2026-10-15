import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { calculateLearningAnalytics, type AnalyticsAnswer } from '@net-slet/exam-rules';
import { AttemptStatus, Prisma, ResultReleaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

const strings = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : [];
const equalSet = (left: readonly string[], right: readonly string[]) => left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type LearningOutcome = 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';
type ReleasedTopicAggregate = { attempts: Set<string>; questionCount: number; answeredCount: number; correctCount: number; incorrectCount: number; unattemptedCount: number; latestAttemptId: string; updatedAt: Date };

@Injectable()
export class LearningService {
  constructor(private readonly database: PrismaService) {}

  /** Rebuilds one attempt's durable learning projection inside the scoring transaction. */
  async rebuildForAttempt(tx: Prisma.TransactionClient, accountId: string, attemptId: string) {
    const attempt = await tx.attempt.findFirst({
      where: { id: attemptId, accountId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] } },
      include: { answerEvents: { orderBy: { sequence: 'asc' } }, testForm: { include: { questions: { orderBy: { sequence: 'asc' }, include: { answerKeyVersion: true, questionVersion: { include: { mappings: true } } } } } } },
    });
    if (!attempt) throw new NotFoundException('Submitted attempt not found');

    await tx.learningRecommendation.deleteMany({ where: { accountId, attemptId } });
    await tx.mistakeMineEntry.deleteMany({ where: { accountId, attemptId } });
    await tx.learningEvidence.deleteMany({ where: { accountId, attemptId } });

    const latest = new Map<string, { id: string; selectedOptionIds: string[] }>();
    for (const event of attempt.answerEvents) latest.set(event.questionVersionId, { id: event.id, selectedOptionIds: strings(event.selectedOptionIds) });
    const analytics: AnalyticsAnswer[] = [];
    const createdEvidence: Array<{ id: string; topicIds: string[] }> = [];

    for (const question of attempt.testForm.questions) {
      const answer = latest.get(question.questionVersionId);
      const selected = answer?.selectedOptionIds ?? [];
      const correct = question.answerKeyVersion ? strings(question.answerKeyVersion.correctAnswers) : [];
      const outcome: LearningOutcome = selected.length === 0 ? 'UNATTEMPTED' : equalSet(selected, correct) ? 'CORRECT' : 'INCORRECT';
      const topicIds = question.questionVersion.mappings.map((mapping) => mapping.syllabusTopicId);
      const reasonCodes = [
        ...(topicIds.length ? [] : ['MISSING_SYLLABUS_MAPPING']),
        ...(correct.length ? [] : ['MISSING_APPROVED_ANSWER_KEY']),
        outcome === 'CORRECT' ? 'CORRECT_RESPONSE' : outcome === 'INCORRECT' ? 'INCORRECT_RESPONSE' : 'UNATTEMPTED_RESPONSE',
      ];
      const sourceEventId = answer?.id ?? `unattempted:${attempt.id}:${question.questionVersionId}`;
      const evidence = await tx.learningEvidence.create({ data: { accountId, attemptId, questionVersionId: question.questionVersionId, sourceEventId, outcome, topicIds: topicIds as unknown as Prisma.InputJsonValue, eligible: topicIds.length > 0 && correct.length > 0, reasonCodes: reasonCodes as unknown as Prisma.InputJsonValue, evidenceHash: digest({ attemptId, questionVersionId: question.questionVersionId, sourceEventId, outcome, topicIds, correct }) } });
      createdEvidence.push({ id: evidence.id, topicIds });
      analytics.push({ questionVersionId: question.questionVersionId, paperKey: question.sessionKey, sectionKey: question.sectionKey, topicIds, outcome });
      if (outcome !== 'CORRECT') await tx.mistakeMineEntry.create({ data: { accountId, attemptId, learningEvidenceId: evidence.id, questionVersionId: question.questionVersionId, reason: outcome === 'INCORRECT' ? 'INCORRECT_RESPONSE' : 'UNATTEMPTED_RESPONSE', topicIds: topicIds as unknown as Prisma.InputJsonValue, recommendation: topicIds.length ? 'Review the mapped topic and retry a targeted practice item.' : 'This item needs an approved syllabus mapping before topic revision can be recommended.' } });
    }

    const computed = calculateLearningAnalytics(analytics);
    for (const [priority, recommendation] of computed.priorities.entries()) await tx.learningRecommendation.create({ data: { accountId, attemptId, key: recommendation.key, reason: recommendation.reason, recommendation: recommendation.recommendation, priority, sourceEvidenceIds: createdEvidence.filter((evidence) => evidence.topicIds.includes(recommendation.key)).map((evidence) => evidence.id) as unknown as Prisma.InputJsonValue } });
    await this.rebuildTopicPerformance(tx, accountId);
    return computed;
  }

  async summary(accountId: string, attemptId: string) {
    const release = await this.database.attempt.findFirst({
      where: { id: attemptId, accountId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] }, result: { isNot: null } },
      select: { id: true, result: { select: { status: true } } },
    });
    if (!release?.result) throw new NotFoundException('Submitted result not found');
    if (release.result.status !== ResultReleaseStatus.PUBLISHED) {
      return { attemptId, releaseStatus: release.result.status, available: false as const, reason: 'LEARNING_FEEDBACK_WITHHELD_UNTIL_RESULT_PUBLICATION' };
    }
    const attempt = await this.database.attempt.findFirst({ where: { id: attemptId, accountId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] }, result: { is: { status: ResultReleaseStatus.PUBLISHED } } }, include: { answerEvents: { orderBy: { sequence: 'asc' } }, testForm: { include: { questions: { orderBy: { sequence: 'asc' }, include: { answerKeyVersion: true, questionVersion: { include: { mappings: true } } } } } } } });
    if (!attempt) throw new NotFoundException('Published result not found');
    const latest = new Map<string, string[]>();
    for (const event of attempt.answerEvents) latest.set(event.questionVersionId, strings(event.selectedOptionIds));
    const answers: AnalyticsAnswer[] = attempt.testForm.questions.map((question) => { const selected = latest.get(question.questionVersionId) ?? []; const correct = question.answerKeyVersion ? strings(question.answerKeyVersion.correctAnswers) : []; const outcome = selected.length === 0 ? 'UNATTEMPTED' : equalSet(selected, correct) ? 'CORRECT' : 'INCORRECT'; return { questionVersionId: question.questionVersionId, paperKey: question.sessionKey, sectionKey: question.sectionKey, topicIds: question.questionVersion.mappings.map((mapping) => mapping.syllabusTopicId), outcome }; });
    const durableEvidence = await this.database.learningEvidence.findMany({ where: { accountId, attemptId }, orderBy: { createdAt: 'asc' }, select: { id: true, questionVersionId: true, outcome: true, topicIds: true, eligible: true, reasonCodes: true, createdAt: true } });
    const recommendations = await this.database.learningRecommendation.findMany({ where: { accountId, attemptId }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }], select: { key: true, reason: true, recommendation: true, priority: true, sourceEvidenceIds: true } });
    return { attemptId, releaseStatus: ResultReleaseStatus.PUBLISHED, available: true as const, source: 'PERSISTED_SUBMITTED_ATTEMPT', analytics: calculateLearningAnalytics(answers), durableEvidence, recommendations };
  }

  async history(accountId: string) {
    const publishedAttempt = { result: { is: { status: ResultReleaseStatus.PUBLISHED } } } as const;
    const [evidence, mistakes, recommendations] = await Promise.all([
      this.database.learningEvidence.findMany({ where: { accountId, attempt: publishedAttempt }, orderBy: { createdAt: 'asc' }, select: { attemptId: true, topicIds: true, outcome: true, createdAt: true } }),
      this.database.mistakeMineEntry.findMany({ where: { accountId, status: 'OPEN', attempt: publishedAttempt }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, attemptId: true, questionVersionId: true, status: true, reason: true, topicIds: true, recommendation: true, createdAt: true } }),
      this.database.learningRecommendation.findMany({ where: { accountId, attempt: publishedAttempt }, orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }], take: 100, select: { attemptId: true, key: true, reason: true, recommendation: true, priority: true, sourceEvidenceIds: true, updatedAt: true } }),
    ]);
    const aggregates = new Map<string, ReleasedTopicAggregate>();
    for (const item of evidence) for (const topicId of strings(item.topicIds)) {
      const aggregate = aggregates.get(topicId) ?? { attempts: new Set<string>(), questionCount: 0, answeredCount: 0, correctCount: 0, incorrectCount: 0, unattemptedCount: 0, latestAttemptId: item.attemptId, updatedAt: item.createdAt };
      aggregate.attempts.add(item.attemptId); aggregate.questionCount += 1;
      if (item.createdAt >= aggregate.updatedAt) { aggregate.latestAttemptId = item.attemptId; aggregate.updatedAt = item.createdAt; }
      if (item.outcome === 'CORRECT') { aggregate.answeredCount += 1; aggregate.correctCount += 1; }
      else if (item.outcome === 'INCORRECT') { aggregate.answeredCount += 1; aggregate.incorrectCount += 1; }
      else aggregate.unattemptedCount += 1;
      aggregates.set(topicId, aggregate);
    }
    const topics = [...aggregates.entries()].map(([topicId, aggregate]) => ({ topicId, attemptCount: aggregate.attempts.size, questionCount: aggregate.questionCount, answeredCount: aggregate.answeredCount, correctCount: aggregate.correctCount, incorrectCount: aggregate.incorrectCount, unattemptedCount: aggregate.unattemptedCount, latestAttemptId: aggregate.latestAttemptId, updatedAt: aggregate.updatedAt })).sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || left.topicId.localeCompare(right.topicId));
    return { source: 'RELEASED_LEARNING_HISTORY', releasePolicy: 'PUBLISHED_RESULTS_ONLY', topics, mistakes, recommendations };
  }

  private async rebuildTopicPerformance(tx: Prisma.TransactionClient, accountId: string) {
    const evidence = await tx.learningEvidence.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' }, select: { attemptId: true, topicIds: true, outcome: true } });
    const aggregates = new Map<string, { attempts: Set<string>; questionCount: number; answeredCount: number; correctCount: number; incorrectCount: number; unattemptedCount: number; latestAttemptId?: string }>();
    for (const item of evidence) for (const topicId of strings(item.topicIds)) { const aggregate = aggregates.get(topicId) ?? { attempts: new Set<string>(), questionCount: 0, answeredCount: 0, correctCount: 0, incorrectCount: 0, unattemptedCount: 0 }; aggregate.attempts.add(item.attemptId); aggregate.questionCount += 1; aggregate.latestAttemptId = item.attemptId; if (item.outcome === 'CORRECT') { aggregate.answeredCount += 1; aggregate.correctCount += 1; } else if (item.outcome === 'INCORRECT') { aggregate.answeredCount += 1; aggregate.incorrectCount += 1; } else aggregate.unattemptedCount += 1; aggregates.set(topicId, aggregate); }
    await tx.learningTopicPerformance.deleteMany({ where: { accountId } });
    for (const [topicId, aggregate] of aggregates) await tx.learningTopicPerformance.create({ data: { accountId, topicId, attemptCount: aggregate.attempts.size, questionCount: aggregate.questionCount, answeredCount: aggregate.answeredCount, correctCount: aggregate.correctCount, incorrectCount: aggregate.incorrectCount, unattemptedCount: aggregate.unattemptedCount, latestAttemptId: aggregate.latestAttemptId } });
  }
}
