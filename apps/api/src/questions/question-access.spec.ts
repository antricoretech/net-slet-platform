import { ForbiddenException } from '@nestjs/common';
import { AccountRole, QuestionVersionStatus, ReviewDecision } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QuestionService } from './question.service';

describe('assigned reviewer question inspection', () => {
  const question = { id: 'question', createdById: 'author', versions: [
    { id: 'current', status: QuestionVersionStatus.SUBMITTED_FOR_REVIEW, prompt: { text: 'Current' } },
    { id: 'earlier', status: QuestionVersionStatus.DRAFT, prompt: { text: 'Earlier' } },
  ] };
  const database = {
    question: { findUnique: jest.fn().mockResolvedValue(question) },
    questionReview: { findFirst: jest.fn() },
  };
  const service = new QuestionService(database as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('allows an assigned independent SME to inspect only the assigned revision', async () => {
    database.questionReview.findFirst.mockResolvedValue({ id: 'assignment', questionVersionId: 'current', decision: ReviewDecision.ASSIGNED });
    const result = await service.get('question', 'reviewer', AccountRole.SME);
    expect(result.versions.map((version) => version.id)).toEqual(['current']);
    expect(database.questionReview.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { questionVersionId: { in: ['current'] }, reviewerId: 'reviewer', decision: ReviewDecision.ASSIGNED } }));
  });

  it('finds an assigned submitted revision behind a newer private draft', async () => {
    database.question.findUnique.mockResolvedValueOnce({ ...question, versions: [question.versions[1], question.versions[0]] });
    database.questionReview.findFirst.mockResolvedValueOnce({ id: 'assignment', questionVersionId: 'current' });
    const result = await service.get('question', 'reviewer', AccountRole.SME);
    expect(result.versions.map((version) => version.id)).toEqual(['current']);
  });

  it('denies an unassigned SME', async () => {
    database.questionReview.findFirst.mockResolvedValue(null);
    await expect(service.get('question', 'stranger', AccountRole.SME)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
