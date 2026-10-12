import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SyllabusService } from './syllabus.service';

@Controller('catalogue/examinations/:examinationCode/cycles/:cycleCode/subjects/:subjectCode/syllabi')
export class SyllabusController {
  constructor(private readonly syllabus: SyllabusService) {}

  @Post()
  @Roles(AccountRole.ADMIN, AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  create(@Param() params: Record<string, string>, @Body() body: unknown, @Req() request: RequestLike) {
    return this.syllabus.create(params.examinationCode, params.cycleCode, params.subjectCode, body, request.user!.id);
  }

  @Get(':syllabusId')
  getPublished(@Param() params: Record<string, string>) {
    return this.syllabus.getPublished(params.examinationCode, params.cycleCode, params.subjectCode, params.syllabusId);
  }

  @Get(':syllabusId/authoring')
  @Roles(AccountRole.ADMIN, AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  getAuthoring(@Param() params: Record<string, string>) {
    return this.syllabus.getAuthoring(params.examinationCode, params.cycleCode, params.subjectCode, params.syllabusId);
  }

  @Post(':syllabusId/units')
  @Roles(AccountRole.ADMIN, AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  addUnit(@Param() params: Record<string, string>, @Body() body: unknown, @Req() request: RequestLike) {
    return this.syllabus.addUnit(params.examinationCode, params.cycleCode, params.subjectCode, params.syllabusId, body, request.user!.id);
  }

  @Post(':syllabusId/units/:unitCode/topics')
  @Roles(AccountRole.ADMIN, AccountRole.SME)
  @UseGuards(AuthGuard, RolesGuard)
  addTopic(@Param() params: Record<string, string>, @Body() body: unknown, @Req() request: RequestLike) {
    return this.syllabus.addTopic(params.examinationCode, params.cycleCode, params.subjectCode, params.syllabusId, params.unitCode, body, request.user!.id);
  }
}
