import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuestionVersionStatus, ReviewDecision, RightsStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QuestionReviewService } from './question-review.service';
import { QuestionChallengeService } from './question-challenge.service';

describe('QuestionReviewService', () => {
  const database: {
    questionVersion: { findFirst: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    questionReview: { findFirst: jest.Mock; create: jest.Mock };
    account: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  } = {
    questionVersion: { findFirst: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    questionReview: { findFirst: jest.fn(), create: jest.fn() },
    account: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new QuestionReviewService(database as unknown as PrismaService);
  const revision = { id: 'version', questionId: 'question', authoredById: 'author', status: QuestionVersionStatus.DRAFT, version: 1, type: 'SINGLE_CHOICE', prompt: { text: 'Question' }, options: [{ optionKey: 'A', optionText: { text: 'A' }, sequence: 0 }, { optionKey: 'B', optionText: { text: 'B' }, sequence: 1 }], answerKeys: [{ correctAnswers: ['A'], exactMatch: false }], explanations: [{ explanation: { text: 'Because' } }], mappings: [{ syllabusTopicId: 'topic' }], provenance: [{ rightsStatus: RightsStatus.UNKNOWN }], licences: [], question: { id: 'question' } };

  beforeEach(() => jest.clearAllMocks());

  it('blocks submission without acceptable rights evidence', async () => {
    database.questionVersion.findFirst.mockResolvedValue(revision);
    await expect(service.submit('question', 'version', 'author')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks an author from reviewing their own submission', async () => {
    database.questionVersion.findFirst.mockResolvedValue({ ...revision, status: QuestionVersionStatus.SUBMITTED_FOR_REVIEW });
    await expect(service.review('question', 'version', { notes: 'review' }, 'author', ReviewDecision.APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('QuestionChallengeService', () => {
  it('only accepts challenges for published revisions', async () => {
    const database = { questionVersion: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as ConstructorParameters<typeof QuestionChallengeService>[0];
    const service = new QuestionChallengeService(database);
    await expect(service.create('question', 'version', { category: 'AMBIGUOUS_QUESTION', description: 'Unclear' }, 'student')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes student queue results to the reporter and returns pagination', async () => {
    const database = { questionChallenge: { count: jest.fn(), findMany: jest.fn() }, $transaction: jest.fn().mockResolvedValue([1, [{ id: 'challenge', status: 'OPEN' }]]) } as unknown as ConstructorParameters<typeof QuestionChallengeService>[0];
    const service = new QuestionChallengeService(database);
    const result = await service.list({ actorId: 'student', role: 'STUDENT', page: '2', pageSize: '10', status: 'OPEN' });
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect((database.questionChallenge.count as jest.Mock).mock.calls[0][0].where).toMatchObject({ reporterId: 'student', status: 'OPEN' });
  });
});
