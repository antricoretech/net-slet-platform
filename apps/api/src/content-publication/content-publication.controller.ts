import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ContentPublicationService } from './content-publication.service';

@Controller('admin/content-publication')
@UseGuards(AuthGuard, RolesGuard)
@Roles(AccountRole.ADMIN, AccountRole.SME)
export class ContentPublicationController {
  constructor(private readonly publication: ContentPublicationService) {}

  @Get('patterns/:patternId/readiness')
  patternReadiness(@Param('patternId') patternId: string) { return this.publication.patternReadiness(patternId); }

  @Post('patterns/:patternId/inventory/qualify')
  qualifyInventory(@Param('patternId') patternId: string, @Body() body: unknown) { return this.publication.qualifyInventory(patternId, body); }

  @Post('patterns/:patternId/forms/compile')
  compile(@Param('patternId') patternId: string, @Body() body: unknown, @Req() request: RequestLike) { return this.publication.compileDraft(patternId, body, request.user!.id); }

  @Post('forms/:formId/publish')
  publish(@Param('formId') formId: string, @Req() request: RequestLike) { return this.publication.publish(formId, request.user!.id); }

  @Get('forms')
  forms() { return this.publication.listAdminForms(); }
}
