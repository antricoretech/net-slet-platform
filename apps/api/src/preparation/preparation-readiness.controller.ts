import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PreparationService } from './preparation.service';

/** Development-only administrative inventory report; never exposes question text or answer keys. */
@Controller('preparation/readiness')
@Roles(AccountRole.ADMIN, AccountRole.SME)
@UseGuards(AuthGuard, RolesGuard)
export class PreparationReadinessController {
  constructor(private readonly preparation: PreparationService) {}

  @Get('historical-questions')
  report(@Query('examinationCode') examinationCode?: string) {
    return this.preparation.historicalInventoryReadiness(examinationCode);
  }
}
