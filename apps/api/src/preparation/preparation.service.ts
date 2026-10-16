import { Injectable, NotFoundException } from '@nestjs/common';
import { PatternStatus, PublicationStatus, QuestionVersionStatus, ReviewDecision, SyllabusStatus, TestFormStatus } from '../generated/prisma/client';
import { resolveCurrentPattern, type PreparationPatternCandidate } from '@net-slet/exam-rules';
import { PrismaService } from '../database/prisma.service';
import { CLEARED_RIGHTS, evaluateFormEligibility, evaluateQuestionEligibility } from './eligibility';

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
    const exam = await this.database.examination.findUnique({ where: { code: code(examinationCode) }, select: { code: true, name: true, family: true, cycles: { orderBy: { code: 'asc' }, select: { id: true, code: true, subjects: { where: { status: { in: [PatternStatus.APPROVED, PatternStatus.PUBLISHED] } }, select: { code: true, name: true, status: true }, orderBy: { code: 'asc' } } } } } });
    if (!exam) throw new NotFoundException('Examination not found');
    const subjects = [...new Map(exam.cycles.flatMap((cycle) => cycle.subjects.map((subject) => [subject.code, { code: subject.code, name: subject.name, status: subject.status }] as const))).values()].sort((left, right) => left.code.localeCompare(right.code));
    const patterns = await this.database.examPatternVersion.findMany({ where: { examCycleId: { in: exam.cycles.map((cycle) => cycle.id) }, status: PatternStatus.PUBLISHED }, select: { id: true, subjectCode: true, version: true, publishedAt: true, ruleHash: true, examCycle: { select: { code: true } } }, orderBy: { publishedAt: 'desc' } });
    return { examination: { code: exam.code, name: exam.name, family: exam.family }, cycleIndependent: true, paperI: { subjectRequired: false, cycleRequired: false, syllabus: `/preparation/${exam.code}/paper-i/syllabus` }, paperII: { subjectRequired: true, subjects }, currentPatterns: patterns.map((version) => ({ id: version.id, cycleCode: version.examCycle.code, subjectCode: version.subjectCode, version: version.version, publishedAt: version.publishedAt, ruleHash: version.ruleHash })), notices: subjects.length ? [] : ['Subject catalogue is not available for publication.'] };
  }

  async syllabus(examinationCode: string, subjectCode: string) {
    const syllabus = await this.database.syllabusVersion.findFirst({ where: { subjectCode: code(subjectCode), status: SyllabusStatus.PUBLISHED, examCycle: { examination: { code: code(examinationCode) } } }, orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }], include: { examCycle: { select: { code: true } }, units: { orderBy: { sequence: 'asc' }, include: { topics: { orderBy: { sequence: 'asc' }, select: { id: true, code: true, title: true, sequence: true, children: { orderBy: { sequence: 'asc' }, select: { id: true, code: true, title: true, sequence: true } } } } } } } });
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
    const [syllabus, pattern, practice, mocks] = await Promise.all([this.syllabus(examinationCode, subject), this.resolvePattern(examinationCode, subject, 'PAPER_II'), this.practice(examinationCode, subject), this.mocks(examinationCode, subject)]);
    return { available: true as const, subject: match, syllabus, pattern, practice, mocks };
  }

  async practice(examinationCode: string, subjectCode: string, topicId?: string) {
    const subject = code(subjectCode);
    const syllabus = await this.syllabus(examinationCode, subject);
    if (!syllabus.available) return { available: false as const, reason: syllabus.reason, subjectCode: subject, topics: [] };
    const topicIds = syllabus.units.flatMap((unit) => unit.topics.flatMap((topic) => [topic.id, ...topic.children.map((child) => child.id)]));
    const requestedTopic = stringQuery(topicId);
    const revisions = await this.database.questionVersion.findMany({
      where: { status: QuestionVersionStatus.PUBLISHED, question: { subjectCode: subject, examCycle: { examination: { code: code(examinationCode) } } }, ...(requestedTopic ? { mappings: { some: { syllabusTopicId: requestedTopic } } } : { mappings: { some: { syllabusTopicId: { in: topicIds } } } }), publication: { status: PublicationStatus.ACTIVE }, answerKeys: { some: {} }, explanations: { some: {} }, provenance: { some: { rightsStatus: { in: [...CLEARED_RIGHTS] } } } },
      select: { id: true, mappings: { select: { syllabusTopicId: true } }, answerKeys: { select: { id: true } }, explanations: { select: { id: true } }, provenance: { select: { rightsStatus: true } }, reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } }, publication: { select: { status: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const counts = new Map<string, number>();
    const excludedReasons = new Map<string, Set<string>>();
    for (const revision of revisions) {
      const eligibility = evaluateQuestionEligibility({ status: QuestionVersionStatus.PUBLISHED, publicationStatus: revision.publication?.status, answerKeyCount: revision.answerKeys.length, explanationCount: revision.explanations.length, mappingCount: revision.mappings.length, provenanceRights: revision.provenance.map((item) => item.rightsStatus), approvedReviewerIds: revision.reviews.map((review) => review.reviewerId) });
      const mappedTopics = revision.mappings.map((mapping) => mapping.syllabusTopicId);
      if (eligibility.eligible) for (const mappedTopic of mappedTopics) counts.set(mappedTopic, (counts.get(mappedTopic) ?? 0) + 1);
      else for (const mappedTopic of mappedTopics) { const reasons = excludedReasons.get(mappedTopic) ?? new Set<string>(); eligibility.reasons.forEach((reason) => reasons.add(reason)); excludedReasons.set(mappedTopic, reasons); }
    }
    const topics = syllabus.units.flatMap((unit) => unit.topics.flatMap((topic) => [topic, ...topic.children])).filter((topic) => !requestedTopic || topic.id === requestedTopic).map((topic) => { const questionCount = counts.get(topic.id) ?? 0; return { topicId: topic.id, code: topic.code, title: topic.title, questionCount, available: questionCount > 0, reason: questionCount ? undefined : [...(excludedReasons.get(topic.id) ?? new Set(['QUALIFIED_QUESTION_INVENTORY_PENDING']))][0] }; });
    return { available: topics.some((topic) => topic.available), subjectCode: subject, topics, reason: topics.some((topic) => topic.available) ? undefined : 'QUALIFIED_QUESTION_INVENTORY_PENDING' };
  }

  async pyqs(examinationCode: string, query: Record<string, unknown>) {
    const cycleCode = stringQuery(query.cycleCode);
    const subjectCode = stringQuery(query.subjectCode);
    const session = stringQuery(query.session);
    const year = integerQuery(query.year);
    const records = await this.database.question.findMany({ where: { examCycle: { examination: { code: code(examinationCode) }, ...(cycleCode ? { code: cycleCode } : {}) }, ...(subjectCode ? { subjectCode: code(subjectCode) } : {}), versions: { some: { status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } }, provenance: { some: { rightsStatus: { in: CLEARED_RIGHTS } } } } } }, select: { id: true, subjectCode: true, examCycleId: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    const cycleCodes = new Map((await this.database.examCycle.findMany({ where: { id: { in: records.map((item) => item.examCycleId) } }, select: { id: true, code: true } })).map((cycle) => [cycle.id, cycle.code]));
    const versions = await this.database.questionVersion.findMany({ where: { questionId: { in: records.map((item) => item.id) }, status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } }, provenance: { some: { rightsStatus: { in: [...CLEARED_RIGHTS] } } }, answerKeys: { some: {} }, explanations: { some: {} }, mappings: { some: {} } }, select: { id: true, questionId: true, publishedAt: true, provenance: { where: { rightsStatus: { in: [...CLEARED_RIGHTS] } }, select: { sourceTitle: true, sourceReference: true, rightsStatus: true } }, answerKeys: { select: { id: true } }, explanations: { select: { id: true } }, mappings: { select: { syllabusTopicId: true } }, reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } }, publication: { select: { status: true } } }, orderBy: { version: 'desc' } });
    const latestVersion = new Map<string, (typeof versions)[number]>();
    for (const version of versions) {
      const eligibility = evaluateQuestionEligibility({ status: QuestionVersionStatus.PUBLISHED, publicationStatus: version.publication?.status, answerKeyCount: version.answerKeys.length, explanationCount: version.explanations.length, mappingCount: version.mappings.length, provenanceRights: version.provenance.map((item) => item.rightsStatus), approvedReviewerIds: version.reviews.map((review) => review.reviewerId) });
      if (eligibility.eligible && !latestVersion.has(version.questionId)) latestVersion.set(version.questionId, version);
    }
    const filtered = records.filter((item) => { const currentCycleCode = cycleCodes.get(item.examCycleId) ?? ''; const parsedYear = Number(currentCycleCode.match(/(?:19|20)\d{2}/)?.[0]); return (!year || parsedYear === year) && (!session || currentCycleCode.toLowerCase().includes(session.toLowerCase())) && latestVersion.has(item.id); });
    return { data: filtered.map((item) => { const currentCycleCode = cycleCodes.get(item.examCycleId) ?? ''; const version = latestVersion.get(item.id); return { questionId: item.id, questionVersionId: version?.id, examinationCode: code(examinationCode), cycleCode: currentCycleCode, subjectCode: item.subjectCode, publishedAt: version?.publishedAt, provenance: version?.provenance[0] }; }), filters: { year, cycleCode, session, subjectCode }, rightsPolicy: 'CLEARED_PROVENANCE_ONLY', notices: filtered.length ? [] : ['No rights-cleared historical questions match these filters.'] };
  }

  async mocks(examinationCode: string, subjectCode?: string) {
    const forms = await this.database.testForm.findMany({ where: { status: TestFormStatus.PUBLISHED, ...(subjectCode ? { subjectCode: code(subjectCode) } : {}), examCycle: { examination: { code: code(examinationCode) } }, patternVersion: { status: PatternStatus.PUBLISHED } }, select: { id: true, subjectCode: true, version: true, snapshot: true, snapshotHash: true, publishedAt: true, examCycle: { select: { code: true } }, patternVersion: { select: { id: true, version: true, ruleHash: true, status: true } }, questions: { select: { answerKeyVersionId: true } } }, orderBy: { publishedAt: 'desc' }, take: 50 });
    const eligible = forms.flatMap((form) => { const publication = form.snapshot && typeof form.snapshot === 'object' && !Array.isArray(form.snapshot) && 'publication' in form.snapshot && form.snapshot.publication && typeof form.snapshot.publication === 'object' ? form.snapshot.publication as Record<string, unknown> : {}; const decision = evaluateFormEligibility({ status: TestFormStatus.PUBLISHED, patternStatus: form.patternVersion.status, questionCount: form.questions.length, answerKeyCount: form.questions.filter((question) => Boolean(question.answerKeyVersionId)).length, snapshotPublication: publication }); return decision.eligible ? [{ id: form.id, subjectCode: form.subjectCode, cycleCode: form.examCycle.code, version: form.version, snapshotHash: form.snapshotHash, publishedAt: form.publishedAt, patternVersion: form.patternVersion.version, patternId: form.patternVersion.id }] : []; });
    return { data: eligible, available: eligible.length > 0, reason: eligible.length ? undefined : 'NO_PUBLICATION_READY_MOCK_FOR_SCOPE' };
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
