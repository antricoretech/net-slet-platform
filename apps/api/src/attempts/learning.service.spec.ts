import { NotFoundException } from '@nestjs/common';
import { ResultReleaseStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LearningService } from './learning.service';

const releasedAttempt = {
  id: 'attempt-1',
  answerEvents: [{ sequence: 1, questionVersionId: 'q-1', selectedOptionIds: ['a'] }],
  testForm: { questions: [{ questionVersionId: 'q-1', sessionKey: 'session-1', sectionKey: 'part-a', answerKeyVersion: { id: 'key-v1', version: 1, correctAnswers: ['a'] }, questionVersion: { mappings: [{ syllabusTopicId: 'topic-1' }] } }] },
};

describe('LearningService release-aware candidate projections', () => {
  it('withholds every question-derived field while the result is pending', async () => {
    const database = {
      attempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1', result: { status: ResultReleaseStatus.PENDING } }) },
      learningEvidence: { findMany: jest.fn() },
      learningRecommendation: { findMany: jest.fn() },
    };
    const result = await new LearningService(database as unknown as PrismaService).summary('account-1', 'attempt-1');
    expect(result).toEqual({ attemptId: 'attempt-1', releaseStatus: ResultReleaseStatus.PENDING, available: false, reason: 'LEARNING_FEEDBACK_WITHHELD_UNTIL_RESULT_PUBLICATION' });
    expect(JSON.stringify(result)).not.toMatch(/question|outcome|topic|mistake|recommendation|evidence/i);
    expect(database.learningEvidence.findMany).not.toHaveBeenCalled();
    expect(database.learningRecommendation.findMany).not.toHaveBeenCalled();
  });

  it('returns detailed student-owned learning only after publication', async () => {
    const database = {
      attempt: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'attempt-1', result: { status: ResultReleaseStatus.PUBLISHED } }).mockResolvedValueOnce(releasedAttempt) },
      learningEvidence: { findMany: jest.fn().mockResolvedValue([{ id: 'evidence-1', questionVersionId: 'q-1', outcome: 'CORRECT', topicIds: ['topic-1'], eligible: true, reasonCodes: ['CORRECT_RESPONSE'], createdAt: new Date() }]) },
      learningRecommendation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new LearningService(database as unknown as PrismaService).summary('account-1', 'attempt-1');
    expect(result.available).toBe(true);
    if (!result.available) throw new Error('Published learning summary was unexpectedly withheld');
    expect(result.releaseStatus).toBe(ResultReleaseStatus.PUBLISHED);
    expect(result.analytics.overall).toMatchObject({ attempted: 1, correct: 1, incorrect: 0 });
    expect(result.analytics.topics[0]).toMatchObject({ key: 'topic-1', correct: 1 });
    expect(result.durableEvidence[0]).toMatchObject({ questionVersionId: 'q-1', outcome: 'CORRECT' });
    expect(result).not.toHaveProperty('answerKey');
  });

  it('builds history only from published attempts and excludes pending aggregate state', async () => {
    const database = {
      learningEvidence: { findMany: jest.fn().mockResolvedValue([{ attemptId: 'published-attempt', topicIds: ['topic-1'], outcome: 'INCORRECT', createdAt: new Date('2026-10-16T00:00:00Z') }]) },
      mistakeMineEntry: { findMany: jest.fn().mockResolvedValue([{ attemptId: 'published-attempt', questionVersionId: 'q-1', reason: 'INCORRECT_RESPONSE' }]) },
      learningRecommendation: { findMany: jest.fn().mockResolvedValue([{ attemptId: 'published-attempt', key: 'topic-1', recommendation: 'Review the topic.' }]) },
    };
    const result = await new LearningService(database as unknown as PrismaService).history('account-1');
    expect(result.source).toBe('RELEASED_LEARNING_HISTORY');
    expect(result.releasePolicy).toBe('PUBLISHED_RESULTS_ONLY');
    expect(result.topics[0]).toMatchObject({ topicId: 'topic-1', attemptCount: 1, incorrectCount: 1, latestAttemptId: 'published-attempt' });
    expect(result.mistakes[0]).toMatchObject({ attemptId: 'published-attempt' });
    for (const query of [database.learningEvidence.findMany, database.mistakeMineEntry.findMany, database.learningRecommendation.findMany]) {
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'account-1', attempt: { result: { is: { status: ResultReleaseStatus.PUBLISHED } } } }) }));
    }
  });

  it('does not reveal whether another student owns a submitted result', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new LearningService({ attempt: { findFirst } } as unknown as PrismaService);
    await expect(service.summary('account-2', 'attempt-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'attempt-1', accountId: 'account-2' }) }));
  });

  it('uses the answer key pinned to the published form after a later key revision exists', async () => {
    const attempt = { ...releasedAttempt, testForm: { questions: [{ ...releasedAttempt.testForm.questions[0], answerKeyVersion: { id: 'key-v1', version: 1, correctAnswers: ['a'] }, questionVersion: { answerKeys: [{ id: 'key-v2', version: 2, correctAnswers: ['b'] }], mappings: [] } }] } };
    const database = {
      attempt: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'attempt-1', result: { status: ResultReleaseStatus.PUBLISHED } }).mockResolvedValueOnce(attempt) },
      learningEvidence: { findMany: jest.fn().mockResolvedValue([]) },
      learningRecommendation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new LearningService(database as unknown as PrismaService).summary('account-1', 'attempt-1');
    if (!result.available) throw new Error('Published learning summary was unexpectedly withheld');
    expect(result.analytics.overall.correct).toBe(1);
    expect(result.analytics.overall.incorrect).toBe(0);
  });
});
