import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RequestLike } from '../auth/auth.types';
import { CatalogueService } from './catalogue.service';

@Controller('catalogue/examinations')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) { return this.catalogue.listPublic(query); }

  @Get(':code')
  detail(@Param('code') code: string) { return this.catalogue.getPublic(code); }

  @Get(':code/cycles')
  cycles(@Param('code') code: string) { return this.catalogue.listCycles(code); }

  @Post()
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body() body: unknown, @Req() request: RequestLike) { return this.catalogue.create(body, request.user!.id); }

  @Patch(':code')
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  update(@Param('code') code: string, @Body() body: unknown, @Req() request: RequestLike) { return this.catalogue.update(code, body, request.user!.id); }

  @Post(':code/cycles/:cycleCode/subjects')
  @Roles(AccountRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  createSubject(@Param('code') code: string, @Param('cycleCode') cycleCode: string, @Body() body: unknown, @Req() request: RequestLike) { return this.catalogue.createSubject(code, cycleCode, body, request.user!.id); }
}
