import { PrismaService } from '../database/prisma.service';
import { LearningService } from './learning.service';

describe('LearningService', () => {
  it('derives student-owned analytics from a persisted submitted attempt without exposing keys', async () => {
    const database = { attempt: { findFirst: jest.fn().mockResolvedValue({
      id: 'attempt-1', answerEvents: [{ sequence: 1, questionVersionId: 'q-1', selectedOptionIds: ['a'] }],
      testForm: { questions: [{ questionVersionId: 'q-1', sessionKey: 'session-1', sectionKey: 'part-a', answerKeyVersion: { id: 'key-v1', version: 1, correctAnswers: ['a'] }, questionVersion: { mappings: [{ syllabusTopicId: 'topic-1' }] } }] },
    }) }, learningEvidence: { findMany: jest.fn().mockResolvedValue([]) }, learningRecommendation: { findMany: jest.fn().mockResolvedValue([]) } };
    const result = await new LearningService(database as unknown as PrismaService).summary('account-1', 'attempt-1');
    expect(result.analytics.overall).toMatchObject({ attempted: 1, correct: 1, incorrect: 0 });
    expect(result.analytics.topics[0]).toMatchObject({ key: 'topic-1', correct: 1 });
    expect(result).not.toHaveProperty('answerKey');
  });

  it('returns only durable, student-owned history projections', async () => {
    const database = {
      learningTopicPerformance: { findMany: jest.fn().mockResolvedValue([{ topicId: 'topic-1', correctCount: 2 }]) },
      mistakeMineEntry: { findMany: jest.fn().mockResolvedValue([{ attemptId: 'attempt-1', reason: 'INCORRECT_RESPONSE' }]) },
      learningRecommendation: { findMany: jest.fn().mockResolvedValue([{ attemptId: 'attempt-1', key: 'topic-1', recommendation: 'Review the topic.' }]) },
    };
    const result = await new LearningService(database as unknown as PrismaService).history('account-1');
    expect(result.source).toBe('DURABLE_LEARNING_HISTORY');
    expect(result.topics[0]).toMatchObject({ topicId: 'topic-1', correctCount: 2 });
    expect(result.mistakes[0]).toMatchObject({ attemptId: 'attempt-1' });
    expect(result).not.toHaveProperty('selectedOptionIds');
    expect(result).not.toHaveProperty('correctAnswers');
  });

  it('uses the pinned answer key for learning evidence after a later key revision exists', async () => {
    const database = { attempt: { findFirst: jest.fn().mockResolvedValue({
      id: 'attempt-1', answerEvents: [{ sequence: 1, questionVersionId: 'q-1', selectedOptionIds: ['a'] }],
      testForm: { questions: [{ questionVersionId: 'q-1', sessionKey: 'session-1', sectionKey: 'part-a', answerKeyVersion: { id: 'key-v1', version: 1, correctAnswers: ['a'] }, questionVersion: { answerKeys: [{ id: 'key-v2', version: 2, correctAnswers: ['b'] }], mappings: [] } }] },
    }) }, learningEvidence: { findMany: jest.fn().mockResolvedValue([]) }, learningRecommendation: { findMany: jest.fn().mockResolvedValue([]) } };
    const result = await new LearningService(database as unknown as PrismaService).summary('account-1', 'attempt-1');
    expect(result.analytics.overall.correct).toBe(1);
    expect(result.analytics.overall.incorrect).toBe(0);
  });
});
