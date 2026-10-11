import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole, PatternApprovalDecision } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PatternService } from './pattern.service';

@Controller('catalogue/examinations/:examinationCode/patterns')
export class PatternController {
  constructor(private readonly patterns: PatternService) {}

  @Get()
  list(@Param('examinationCode') examinationCode: string, @Query('cycleCode') cycleCode?: string, @Query('subjectCode') subjectCode?: string) { return this.patterns.listPublished(examinationCode, cycleCode, subjectCode); }

  @Get(':patternId')
  get(@Param('examinationCode') examinationCode: string, @Param('patternId') patternId: string) { return this.patterns.getPublished(examinationCode, patternId); }

  @Post()
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  create(@Param('examinationCode') examinationCode: string, @Body() body: unknown, @Req() request: RequestLike) { return this.patterns.createDraft(examinationCode, body, request.user!.id); }

  @Post(':patternId/submit-review')
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  submitReview(@Param('examinationCode') examinationCode: string, @Param('patternId') patternId: string, @Req() request: RequestLike) { return this.patterns.submitForReview(examinationCode, patternId, request.user!.id); }

  @Post(':patternId/approve')
  @Roles(AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  approve(@Param('examinationCode') examinationCode: string, @Param('patternId') patternId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.patterns.approve(examinationCode, patternId, body, request.user!.id, PatternApprovalDecision.APPROVED); }

  @Post(':patternId/reject')
  @Roles(AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  reject(@Param('examinationCode') examinationCode: string, @Param('patternId') patternId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.patterns.approve(examinationCode, patternId, body, request.user!.id, PatternApprovalDecision.REJECTED); }

  @Post(':patternId/publish')
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  publish(@Param('examinationCode') examinationCode: string, @Param('patternId') patternId: string, @Req() request: RequestLike) { return this.patterns.publish(examinationCode, patternId, request.user!.id); }
}
