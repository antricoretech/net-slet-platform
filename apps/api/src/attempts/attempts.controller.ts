import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RequestLike } from '../auth/auth.types';
import { AttemptsService } from './attempts.service';
import { ScoringService } from './scoring.service';
import { LearningService } from './learning.service';

@Controller('attempts')
@Roles(AccountRole.STUDENT)
@UseGuards(AuthGuard, RolesGuard)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService, private readonly scoring: ScoringService, private readonly learning: LearningService) {}

  @Post()
  start(@Body() body: unknown, @Req() request: RequestLike): Promise<unknown> { return this.attempts.start(request.user!.id, body); }

  @Get('forms')
  forms(): Promise<unknown> { return this.attempts.availableForms(); }

  @Get(':id/state')
  state(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.attempts.state(request.user!.id, id); }

  @Get(':id/form')
  form(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.attempts.form(request.user!.id, id); }

  @Post(':id/sessions/:sessionId/start')
  startSession(@Param('id') id: string, @Param('sessionId') sessionId: string, @Req() request: RequestLike): Promise<unknown> { return this.attempts.activateSession(request.user!.id, id, sessionId); }

  @Put(':id/answers/:questionId')
  answer(@Param('id') id: string, @Param('questionId') questionId: string, @Body() body: unknown, @Req() request: RequestLike): Promise<unknown> { return this.attempts.saveAnswer(request.user!.id, id, questionId, body); }

  @Post(':id/sessions/:sessionId/submit')
  submitSession(@Param('id') id: string, @Param('sessionId') sessionId: string, @Req() request: RequestLike): Promise<unknown> { return this.attempts.submitSession(request.user!.id, id, sessionId); }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.scoring.finalize(request.user!.id, id); }

  @Post(':id/score')
  score(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.scoring.score(request.user!.id, id); }

  @Get(':id/result')
  result(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.scoring.getResult(request.user!.id, id); }

  @Get(':id/learning-summary')
  learningSummary(@Param('id') id: string, @Req() request: RequestLike): Promise<unknown> { return this.learning.summary(request.user!.id, id); }

  @Get('learning-history')
  learningHistory(@Req() request: RequestLike): Promise<unknown> { return this.learning.history(request.user!.id); }
}
