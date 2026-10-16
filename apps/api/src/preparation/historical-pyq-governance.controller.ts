import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole, HistoricalMetadataGovernanceStatus } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HistoricalPyqGovernanceService, type GovernanceDecisionInput } from './historical-pyq-governance.service';

@Controller('admin/preparation/historical-pyq-governance')
@Roles(AccountRole.ADMIN, AccountRole.SME)
@UseGuards(AuthGuard, RolesGuard)
export class HistoricalPyqGovernanceController {
  constructor(private readonly governance: HistoricalPyqGovernanceService) {}

  @Get('queue') queue(@Req() request: RequestLike, @Query('status') status?: HistoricalMetadataGovernanceStatus) { return this.governance.queue(request.user!.id, status); }
  @Get(':metadataId/history') history(@Req() request: RequestLike, @Param('metadataId') id: string) { return this.governance.history(id, request.user!.id); }

  @Post(':metadataId/validate') validate(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.validate(id, request.user!.id, input); }
  @Post(':metadataId/academic-review') @Roles(AccountRole.SME, AccountRole.ADMIN) academicReview(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.academicallyReview(id, request.user!.id, input); }
  @Post(':metadataId/rights-verification') @Roles(AccountRole.ADMIN) rightsVerification(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.verifyRights(id, request.user!.id, input); }
  @Post(':metadataId/approve') @Roles(AccountRole.ADMIN) approve(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.approve(id, request.user!.id, input); }
  @Post(':metadataId/publication-eligibility') @Roles(AccountRole.ADMIN) publicationEligibility(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.makePublicationEligible(id, request.user!.id, input); }
  @Post(':metadataId/reject') @Roles(AccountRole.ADMIN, AccountRole.SME) reject(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.reject(id, request.user!.id, input); }
  @Post(':metadataId/revoke') @Roles(AccountRole.ADMIN) revoke(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput) { return this.governance.revoke(id, request.user!.id, input); }
  @Post(':metadataId/supersede') @Roles(AccountRole.ADMIN) supersede(@Req() request: RequestLike, @Param('metadataId') id: string, @Body() input: GovernanceDecisionInput & { replacementId: string }) { return this.governance.supersede(id, input.replacementId, request.user!.id, input); }
}
