import { Injectable, NotFoundException } from '@nestjs/common';
import { PatternStatus, PublicationStatus, QuestionVersionStatus, RightsStatus, SyllabusStatus, TestFormStatus } from '../generated/prisma/client';
import { resolveCurrentPattern, type PreparationPatternCandidate } from '@net-slet/exam-rules';
import { PrismaService } from '../database/prisma.service';

const CLEARED_RIGHTS = [RightsStatus.OWNED, RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED, RightsStatus.PUBLIC_DOMAIN] as const;
const code = (value: string) => value.trim().toUpperCase();
const stringQuery = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const integerQuery = (value: unknown) => typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : undefined;

@Injectable()
export class PreparationService {
  constructor(private readonly database: PrismaService) {}

  async listExaminations() {
    const examinations = await this.database.examination.findMany({ orderBy: { code: 'asc' }, select: { code: true, name: true, family: true, organizer: { select: { name: true } } } });
    return { data: examinations, source: 'PUBLISHED_EXAMINATION_CATALOGUE' };
  }

  async overview(examinationCode: string) {
    const exam = await this.database.examination.findUnique({ where: { code: code(examinationCode) }, include: { cycles: { orderBy: { code: 'asc' }, include: { subjects: { where: { status: { in: [PatternStatus.APPROVED, PatternStatus.PUBLISHED] } }, select: { code: true, name: true, status: true }, orderBy: { code: 'asc' } }, versions: { where: { status: PatternStatus.PUBLISHED }, select: { id: true, subjectCode: true, version: true, publishedAt: true, ruleHash: true }, orderBy: { publishedAt: 'desc' } } } } } });
    if (!exam) throw new NotFoundException('Examination not found');
    const subjects = [...new Map(exam.cycles.flatMap((cycle) => cycle.subjects.map((subject) => [subject.code, { code: subject.code, name: subject.name, status: subject.status }] as const))).values()].sort((left, right) => left.code.localeCompare(right.code));
    return { examination: { code: exam.code, name: exam.name, family: exam.family }, cycleIndependent: true, paperI: { subjectRequired: false, cycleRequired: false, syllabus: `/preparation/${exam.code}/paper-i/syllabus` }, paperII: { subjectRequired: true, subjects }, currentPatterns: exam.cycles.flatMap((cycle) => cycle.versions.map((version) => ({ id: version.id, cycleCode: cycle.code, subjectCode: version.subjectCode, version: version.version, publishedAt: version.publishedAt, ruleHash: version.ruleHash }))), notices: subjects.length ? [] : ['Subject catalogue is not available for publication.'] };
  }

  async syllabus(examinationCode: string, subjectCode: string) {
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { subjectCode: code(subjectCode), status: SyllabusStatus.PUBLISHED, examCycle: { examination: { code: code(examinationCode) } } }, orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }], include: { examCycle: { select: { code: true } }, units: { orderBy: { sequence: 'asc' }, include: { topics: { orderBy: { sequence: 'asc' }, select: { code: true, title: true, sequence: true, children: { orderBy: { sequence: 'asc' }, select: { code: true, title: true, sequence: true } } } } } } } });
    if (!syllabus) return { available: false as const, reason: 'SYLLABUS_EVIDENCE_PENDING', examinationCode: code(examinationCode), subjectCode: code(subjectCode) };
    return { available: true as const, id: syllabus.id, title: syllabus.title, version: syllabus.version, cycleCode: syllabus.examCycle.code, subjectCode: syllabus.subjectCode, units: syllabus.units };
  }

  async subjects(examinationCode: string) {
    const records = await this.database.examSubject.findMany({ where: { status: { in: [PatternStatus.APPROVED, PatternStatus.PUBLISHED] }, examCycle: { examination: { code: code(examinationCode) } } }, select: { code: true, name: true, status: true, examCycle: { select: { code: true } } }, orderBy: [{ code: 'asc' }, { createdAt: 'desc' }] });
    const uniqueMap = new Map<string, { code: string; name: string; status: PatternStatus; historicalCycles: string[] }>();
    for (const subject of records) { const current = uniqueMap.get(subject.code); if (current) { if (!current.historicalCycles.includes(subject.examCycle.code)) current.historicalCycles.push(subject.examCycle.code); } else uniqueMap.set(subject.code, { code: subject.code, name: subject.name, status: subject.status, historicalCycles: [subject.examCycle.code] }); }
    const unique = [...uniqueMap.values()];
    return { data: unique, subjectRequired: true, source: 'APPROVED_SUBJECT_CATALOGUE' };
  }

  async subjectOverview(examinationCode: string, subjectCode: string) {
    const subject = code(subjectCode);
    const listed = await this.subjects(examinationCode);
    const match = listed.data.find((item) => item.code === subject);
    if (!match) return { available: false as const, subjectCode: subject, reason: 'SUBJECT_CURRENTLY_UNAVAILABLE' };
    const [syllabus, pattern] = await Promise.all([this.syllabus(examinationCode, subject), this.resolvePattern(examinationCode, subject, 'PAPER_II')]);
    return { available: true as const, subject: match, syllabus, pattern, practice: { available: false, reason: 'QUALIFIED_QUESTION_INVENTORY_PENDING' }, mocks: { available: false, reason: 'PUBLICATION_READINESS_PENDING' } };
  }

  async pyqs(examinationCode: string, query: Record<string, unknown>) {
    const cycleCode = stringQuery(query.cycleCode);
    const subjectCode = stringQuery(query.subjectCode);
    const session = stringQuery(query.session);
    const year = integerQuery(query.year);
    const records = await this.database.question.findMany({ where: { examCycle: { examination: { code: code(examinationCode) }, ...(cycleCode ? { code: cycleCode } : {}) }, ...(subjectCode ? { subjectCode: code(subjectCode) } : {}), versions: { some: { status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } }, provenance: { some: { rightsStatus: { in: CLEARED_RIGHTS } } } } } }, select: { id: true, subjectCode: true, examCycle: { select: { code: true } }, versions: { where: { status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } } }, select: { id: true, publishedAt: true, provenance: { where: { rightsStatus: { in: CLEARED_RIGHTS } }, select: { sourceTitle: true, sourceReference: true } } }, orderBy: { version: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 100 });
    const filtered = records.filter((item) => { const parsedYear = Number(item.examCycle.code.match(/(?:19|20)\d{2}/)?.[0]); return (!year || parsedYear === year) && (!session || item.examCycle.code.toLowerCase().includes(session.toLowerCase())); });
    return { data: filtered.map((item) => ({ questionId: item.id, questionVersionId: item.versions[0]?.id, examinationCode: code(examinationCode), cycleCode: item.examCycle.code, subjectCode: item.subjectCode, publishedAt: item.versions[0]?.publishedAt, provenance: item.versions[0]?.provenance[0] })), filters: { year, cycleCode, session, subjectCode }, rightsPolicy: 'CLEARED_PROVENANCE_ONLY', notices: filtered.length ? [] : ['No rights-cleared historical questions match these filters.'] };
  }

  async mocks(examinationCode: string, subjectCode?: string) {
    const forms = await this.database.testForm.findMany({ where: { status: TestFormStatus.PUBLISHED, ...(subjectCode ? { subjectCode: code(subjectCode) } : {}), examCycle: { examination: { code: code(examinationCode) } }, patternVersion: { status: PatternStatus.PUBLISHED } }, select: { id: true, subjectCode: true, version: true, snapshotHash: true, publishedAt: true, examCycle: { select: { code: true } }, patternVersion: { select: { id: true, version: true, ruleHash: true, status: true } } }, orderBy: { publishedAt: 'desc' }, take: 50 });
    return { data: forms.map((form) => ({ id: form.id, subjectCode: form.subjectCode, cycleCode: form.examCycle.code, version: form.version, snapshotHash: form.snapshotHash, publishedAt: form.publishedAt, patternVersion: form.patternVersion.version, patternId: form.patternVersion.id })), available: forms.length > 0, reason: forms.length ? undefined : 'NO_PUBLICATION_READY_MOCK_FOR_SCOPE' };
  }

  async learningSummary(accountId: string) {
    const topics = await this.database.learningTopicPerformance.findMany({ where: { accountId }, orderBy: [{ updatedAt: 'desc' }, { topicId: 'asc' }], take: 100, select: { topicId: true, attemptCount: true, questionCount: true, answeredCount: true, correctCount: true, incorrectCount: true, unattemptedCount: true, updatedAt: true } });
    return { available: topics.length > 0, source: 'ACCOUNT_SCOPED_PERSISTED_LEARNING_PROJECTION', topics, notices: topics.length ? [] : ['Learning analytics will appear after an eligible released result.'] };
  }

  private async resolvePattern(examinationCode: string, subjectCode: string, product: 'PAPER_I' | 'PAPER_II') {
    const patternSubjects = product === 'PAPER_I' ? ['GENERAL', 'PAPER_I'] : [subjectCode];
    const versions = await this.database.examPatternVersion.findMany({ where: { status: PatternStatus.PUBLISHED, subjectCode: { in: patternSubjects }, examCycle: { examination: { code: code(examinationCode) } } }, include: { evidence: true, examCycle: { select: { code: true } } }, orderBy: { publishedAt: 'desc' } });
    const candidates: PreparationPatternCandidate[] = versions.map((version) => ({ id: version.id, examinationCode: code(examinationCode), family: 'UGC_NET', cycleCode: version.examCycle.code, ...(version.subjectCode === 'GENERAL' || version.subjectCode === 'PAPER_I' ? {} : { subjectCode: version.subjectCode }), version: version.version, status: 'PUBLISHED', verified: Boolean(version.evidence && version.evidence.sourceDocumentHash && version.evidence.regressionReportId), effectiveFrom: version.evidence?.effectiveAt?.toISOString() ?? version.publishedAt?.toISOString() ?? version.createdAt.toISOString(), evidenceRef: version.evidence?.artifactReference ?? '', ruleHash: version.ruleHash ?? '', papers: product === 'PAPER_I' ? ['PAPER_I'] : ['PAPER_II'] }));
    return resolveCurrentPattern({ examinationCode: code(examinationCode), subjectCode, product, asOf: new Date().toISOString(), candidates });
  }
}
