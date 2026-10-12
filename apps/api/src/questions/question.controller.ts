import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuestionService } from './question.service';

@Controller('qbms/questions')
@Roles(AccountRole.ADMIN, AccountRole.SME)
@UseGuards(AuthGuard, RolesGuard)
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: RequestLike) { return this.questions.create(body, request.user!.id); }
  @Get()
  list(@Query() query: Record<string, unknown>, @Req() request: RequestLike) { return this.questions.list(query, request.user!.id, request.user!.role); }
  @Get(':questionId')
  get(@Param('questionId') questionId: string, @Req() request: RequestLike) { return this.questions.get(questionId, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions')
  createRevision(@Param('questionId') questionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.createRevision(questionId, body, request.user!.id, request.user!.role); }
  @Patch(':questionId/revisions/:versionId')
  updateDraft(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.updateDraft(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/options')
  addOption(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addOption(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/answer-keys')
  addAnswerKey(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addAnswerKey(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/explanations')
  addExplanation(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addExplanation(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/mappings')
  addMapping(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addMapping(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/provenance')
  addProvenance(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addProvenance(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/translations')
  addTranslation(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addTranslation(questionId, versionId, body, request.user!.id, request.user!.role); }
  @Post(':questionId/revisions/:versionId/licences')
  addLicence(@Param('questionId') questionId: string, @Param('versionId') versionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.questions.addLicence(questionId, versionId, body, request.user!.id, request.user!.role); }
}
