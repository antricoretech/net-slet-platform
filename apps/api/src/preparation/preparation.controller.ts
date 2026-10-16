import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AccountRole } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RequestLike } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PreparationService } from './preparation.service';

@Controller('preparation')
@Roles(AccountRole.STUDENT)
@UseGuards(AuthGuard, RolesGuard)
export class PreparationController {
  constructor(private readonly preparation: PreparationService) {}

  @Get('examinations') listExaminations() { return this.preparation.listExaminations(); }
  @Get(':examinationCode') overview(@Param('examinationCode') examinationCode: string) { return this.preparation.overview(examinationCode); }
  @Get(':examinationCode/paper-i/syllabus') paperISyllabus(@Param('examinationCode') examinationCode: string) { return this.preparation.syllabus(examinationCode, 'PAPER_I'); }
  @Get(':examinationCode/paper-ii/subjects') paperIISubjects(@Param('examinationCode') examinationCode: string) { return this.preparation.subjects(examinationCode); }
  @Get(':examinationCode/paper-ii/:subjectCode') paperII(@Param('examinationCode') examinationCode: string, @Param('subjectCode') subjectCode: string) { return this.preparation.subjectOverview(examinationCode, subjectCode); }
  @Get(':examinationCode/pyqs') pyqs(@Param('examinationCode') examinationCode: string, @Query() query: Record<string, unknown>) { return this.preparation.pyqs(examinationCode, query); }
  @Get(':examinationCode/mocks') mocks(@Param('examinationCode') examinationCode: string, @Query('subjectCode') subjectCode?: string) { return this.preparation.mocks(examinationCode, subjectCode); }
  @Get('learning/summary') learning(@Req() request: RequestLike) { return this.preparation.learningSummary(request.user!.id); }
}
