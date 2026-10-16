import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResultGovernanceService } from './result-governance.service';

@Controller('admin/results')
@UseGuards(AuthGuard, RolesGuard)
@Roles(AccountRole.ADMIN)
export class ResultGovernanceController {
  constructor(private readonly governance: ResultGovernanceService) {}

  @Get('pending')
  pending() { return this.governance.listPending(); }

  @Post(':attemptId/publish')
  publish(@Param('attemptId') attemptId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.governance.publish(attemptId, request.user!.id, body); }

  @Post('answer-key-corrections/:questionVersionId')
  authorizeCorrection(@Param('questionVersionId') questionVersionId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.governance.authorizeCorrection(questionVersionId, request.user!.id, body); }

  @Post(':attemptId/rescore')
  rescore(@Param('attemptId') attemptId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.governance.rescore(attemptId, request.user!.id, body); }
}
