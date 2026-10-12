import { Controller, Get, Param, Query } from '@nestjs/common';
import { QuestionReviewService } from './question-review.service';

@Controller('qbms/public/questions')
export class QuestionPublicController {
  constructor(private readonly reviews: QuestionReviewService) {}

  @Get(':questionId')
  get(@Param('questionId') questionId: string, @Query('language') language?: string) { return this.reviews.getPublic(questionId, language ?? 'en'); }
}
