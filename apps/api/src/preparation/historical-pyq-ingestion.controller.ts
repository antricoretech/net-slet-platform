import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HistoricalPyqIngestionService, type HistoricalPyqImportInput } from './historical-pyq-ingestion.service';

@Controller('admin/preparation/historical-pyq-imports')
@Roles(AccountRole.ADMIN, AccountRole.SME)
@UseGuards(AuthGuard, RolesGuard)
export class HistoricalPyqIngestionController {
  constructor(private readonly ingestion: HistoricalPyqIngestionService) {}

  @Post('dry-run')
  dryRun(@Req() request: RequestLike, @Body() input: HistoricalPyqImportInput) { return this.ingestion.dryRun(request.user!.id, input); }

  @Post(':manifestId/commit')
  @Roles(AccountRole.ADMIN)
  commit(@Req() request: RequestLike, @Param('manifestId') manifestId: string) { return this.ingestion.commit(request.user!.id, manifestId); }
}
