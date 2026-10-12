import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole, QuestionVersionStatus, ReviewDecision } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionReviewService } from './question-review.service';
import { QuestionChallengeService } from './question-challenge.service';

@Controller('qbms/questions')
@UseGuards(AuthGuard, RolesGuard)
export class QuestionTrustController {
  constructor(private readonly reviews: QuestionReviewService, private readonly challenges: QuestionChallengeService) {}

  @Post(':questionId/revisions/:versionId/submit-review')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  submit(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Req() request: RequestLike) { return this.reviews.submit(questionId, versionId, request.user!.id); }

  @Get('review/queue')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  queue(@Query('status') status: string | undefined, @Req() request: RequestLike) { const normalized = status?.trim().toUpperCase(); const parsed = normalized && Object.values(QuestionVersionStatus).includes(normalized as QuestionVersionStatus) ? normalized as QuestionVersionStatus : undefined; return this.reviews.queue(parsed, request.user!.id, request.user!.role); }

  @Get('challenges')
  @Roles(AccountRole.STUDENT, AccountRole.SME, AccountRole.ADMIN)
  listChallenges(@Query() query: Record<string, string>, @Req() request: RequestLike) { return this.challenges.list({ ...query, actorId: request.user!.id, role: request.user!.role }); }

  @Get('challenges/:challengeId/staff-detail')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  staffChallenge(@Param('challengeId') challengeId: string) { return this.challenges.staffDetail(challengeId); }

  @Post('challenges/:challengeId/triage')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  triage(@Param('challengeId') challengeId: string, @Req() request: RequestLike) { return this.challenges.triage(challengeId, request.user!.id); }

  @Post(':questionId/revisions/:versionId/assign-reviewer')
  @Roles(AccountRole.ADMIN)
  assign(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: { reviewerId?: string }, @Req() request: RequestLike) { return this.reviews.assign(questionId, versionId, body.reviewerId ?? '', request.user!.id); }

  @Post(':questionId/revisions/:versionId/review')
  @Roles(AccountRole.SME)
  review(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.reviews.review(questionId, versionId, body, request.user!.id, ReviewDecision.APPROVED); }

  @Post(':questionId/revisions/:versionId/reject-review')
  @Roles(AccountRole.SME)
  reject(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.reviews.review(questionId, versionId, body, request.user!.id, ReviewDecision.REJECTED); }

  @Post(':questionId/revisions/:versionId/approve')
  @Roles(AccountRole.ADMIN)
  approve(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.reviews.approve(questionId, versionId, body, request.user!.id); }

  @Post(':questionId/revisions/:versionId/publish')
  @Roles(AccountRole.ADMIN)
  publish(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Req() request: RequestLike) { return this.reviews.publish(questionId, versionId, request.user!.id); }

  @Get(':questionId/publication-history')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  history(@Param('questionId') questionId: string, @Req() request: RequestLike) { return this.reviews.publicationHistory(questionId, request.user!.id, request.user!.role); }

  @Post(':questionId/revisions/:versionId/challenges')
  @Roles(AccountRole.STUDENT, AccountRole.SME, AccountRole.ADMIN)
  challenge(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.challenges.create(questionId, versionId, body, request.user!.id); }

  @Post('challenges/:challengeId/resolve')
  @Roles(AccountRole.SME, AccountRole.ADMIN)
  resolve(@Param('challengeId') challengeId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.challenges.resolve(challengeId, body, request.user!.id); }

  @Get('challenges/:challengeId')
  @Roles(AccountRole.STUDENT, AccountRole.SME, AccountRole.ADMIN)
  getChallenge(@Param('challengeId') challengeId: string, @Req() request: RequestLike) { return this.challenges.get(challengeId, request.user!.id, request.user!.role); }
}
