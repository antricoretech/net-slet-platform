import { Injectable, NotFoundException } from '@nestjs/common';
import { HistoricalMetadataRecordStatus, HistoricalMetadataVerificationStatus, PatternStatus, PublicationStatus, QuestionVersionStatus, ReviewDecision, SyllabusStatus, TestFormStatus } from '../generated/prisma/client';
import { resolveCurrentPattern, type PreparationPatternCandidate } from '@net-slet/exam-rules';
import { PrismaService } from '../database/prisma.service';
import { CLEARED_RIGHTS, evaluateFormEligibility, evaluateHistoricalMetadataEligibility, evaluateQuestionEligibility } from './eligibility';

const code = (value: string) => value.trim().toUpperCase();
const stringQuery = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const integerQuery = (value: unknown) => typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : undefined;
const positiveIntegerQuery = (value: unknown, fallback: number, maximum: number) => typeof value === 'string' && /^\d+$/.test(value) ? Math.min(Math.max(Number(value), 1), maximum) : fallback;
const MAX_HISTORICAL_PYQ_SCAN = 10001;

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
    const paper = stringQuery(query.paper);
    const language = stringQuery(query.language);
    const year = integerQuery(query.year);
    const page = positiveIntegerQuery(query.page, 1, 100);
    const pageSize = positiveIntegerQuery(query.pageSize, 20, 100);
    const metadata = await this.database.historicalQuestionMetadata.findMany({
      where: {
        examCycle: { examination: { code: code(examinationCode) }, ...(cycleCode ? { code: cycleCode } : {}) },
        ...(year ? { sourceYear: year } : {}),
        ...(session ? { session: { equals: session, mode: 'insensitive' as const } } : {}),
        ...(paper ? { paper: { equals: paper, mode: 'insensitive' as const } } : {}),
        ...(language ? { languageCode: { equals: language, mode: 'insensitive' as const } } : {}),
        ...(subjectCode ? { subjectCode: code(subjectCode) } : {}),
        verificationStatus: HistoricalMetadataVerificationStatus.VERIFIED,
        publicationEligible: true,
        revokedAt: null,
        rightsStatus: { in: [...CLEARED_RIGHTS] },
        questionVersion: { status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } }, answerKeys: { some: {} }, explanations: { some: {} }, mappings: { some: {} } },
      },
      select: { id: true, questionVersionId: true, examinationFamily: true, authority: true, sourceYear: true, historicalCycle: true, session: true, paper: true, subjectCode: true, questionPaperReference: true, questionSequence: true, languageCode: true, sourceReference: true, sourceChecksum: true, answerKeyProvenance: true, rightsStatus: true, rightsScope: true, rightsExpiresAt: true, revokedAt: true, recordStatus: true, verificationStatus: true, publicationEligible: true, examCycle: { select: { code: true, examination: { select: { family: true } } } }, questionVersion: { select: { languageCode: true, publishedAt: true, question: { select: { subjectCode: true } }, translations: { where: { status: 'APPROVED' }, select: { languageCode: true } }, reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } }, answerKeys: { select: { id: true } }, explanations: { select: { id: true } }, mappings: { select: { syllabusTopicId: true } }, publication: { select: { status: true } } } } },
      orderBy: [{ sourceYear: 'desc' }, { questionSequence: 'asc' }, { id: 'asc' }],
      take: MAX_HISTORICAL_PYQ_SCAN,
    });
    const eligible = metadata.filter((item) => {
      const requestedLanguage = language ?? item.languageCode ?? item.questionVersion.languageCode;
      const languageAuthorized = !requestedLanguage || item.questionVersion.languageCode.toLowerCase() === requestedLanguage.toLowerCase() || item.questionVersion.translations.some((translation) => translation.languageCode.toLowerCase() === requestedLanguage.toLowerCase());
      const decision = evaluateHistoricalMetadataEligibility({ verificationStatus: item.verificationStatus, recordStatus: item.recordStatus, publicationEligible: item.publicationEligible, rightsStatus: item.rightsStatus, rightsScope: item.rightsScope, rightsExpiresAt: item.rightsExpiresAt, revokedAt: item.revokedAt, requestedLanguage, examinationFamilyMatches: item.examinationFamily === item.examCycle.examination.family, subjectMatches: item.subjectCode === item.questionVersion.question.subjectCode, question: { status: QuestionVersionStatus.PUBLISHED, publicationStatus: item.questionVersion.publication?.status, answerKeyCount: item.questionVersion.answerKeys.length, explanationCount: item.questionVersion.explanations.length, mappingCount: item.questionVersion.mappings.length, provenanceRights: [item.rightsStatus], approvedReviewerIds: item.questionVersion.reviews.map((review) => review.reviewerId) } });
      return languageAuthorized && decision.eligible;
    });
    const start = (page - 1) * pageSize;
    const visible = eligible.slice(start, start + pageSize);
    const hasNextPage = eligible.length > start + pageSize || metadata.length === MAX_HISTORICAL_PYQ_SCAN;
    return { data: visible.map((item) => ({ questionId: item.questionVersionId, questionVersionId: item.questionVersionId, examinationCode: code(examinationCode), examinationFamily: item.examinationFamily, cycleCode: item.examCycle.code, authority: item.authority, year: item.sourceYear, cycle: item.historicalCycle, session: item.session, paper: item.paper, subjectCode: item.subjectCode, questionPaperReference: item.questionPaperReference, questionSequence: item.questionSequence, language: item.languageCode, sourceReference: item.sourceReference, sourceChecksum: item.sourceChecksum, answerKeyProvenance: item.answerKeyProvenance, rightsStatus: item.rightsStatus, rightsScope: item.rightsScope, publishedAt: item.questionVersion.publishedAt })), pagination: { page, pageSize, returned: visible.length, hasNextPage }, filters: { year, cycleCode, session, paper, language, subjectCode }, rightsPolicy: 'VERIFIED_METADATA_AND_CLEARED_RIGHTS_ONLY', notices: visible.length ? [] : ['No verified rights-cleared historical questions match these filters.'] };
  }

  async historicalInventoryReadiness(examinationCode?: string) {
    const records = await this.database.historicalQuestionMetadata.findMany({
      where: examinationCode ? { examCycle: { examination: { code: code(examinationCode) } } } : {},
      select: {
        recordStatus: true,
        verificationStatus: true,
        publicationEligible: true,
        rightsStatus: true,
        revokedAt: true,
        sourceYear: true,
        session: true,
        paper: true,
        subjectCode: true,
        languageCode: true,
        examinationFamily: true,
        rightsScope: true,
        rightsExpiresAt: true,
        examCycle: { select: { code: true, examination: { select: { code: true, family: true } } } },
        questionVersion: {
          select: {
            status: true,
            question: { select: { subjectCode: true } },
            languageCode: true,
            translations: { where: { status: 'APPROVED' }, select: { languageCode: true } },
            publication: { select: { status: true } },
            reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } },
            answerKeys: { select: { id: true } },
            explanations: { select: { id: true } },
            mappings: { select: { syllabusTopic: { select: { code: true, title: true, subjectUnit: { select: { code: true, title: true } } } } } },
          },
        },
      },
    });
    const counts = { imported: records.length, validated: 0, verified: 0, reviewPending: 0, rightsPending: 0, rejected: 0, duplicated: 0, revoked: 0, publicationReady: 0, totalMetadata: records.length };
    const byScope = new Map<string, { examinationCode: string; family: string; cycleCode: string; subjectCode: string; paper: string; language: string; unit: string; topic: string; reviewStatus: string; rightsStatus: string; sourceVerification: string; publicationEligible: boolean; total: number; ready: number }>();
    for (const item of records) {
      if (item.recordStatus === HistoricalMetadataRecordStatus.VALIDATED || item.recordStatus === HistoricalMetadataRecordStatus.VERIFIED) counts.validated++;
      if (item.verificationStatus === HistoricalMetadataVerificationStatus.VERIFIED) counts.verified++;
      if (item.recordStatus === HistoricalMetadataRecordStatus.REJECTED) counts.rejected++;
      if (item.recordStatus === HistoricalMetadataRecordStatus.DUPLICATE) counts.duplicated++;
      if (item.revokedAt) counts.revoked++;
      const reviewReady = new Set(item.questionVersion.reviews.map((review) => review.reviewerId)).size >= 2;
      if (!reviewReady) counts.reviewPending++;
      const scope = item.rightsScope && typeof item.rightsScope === 'object' && !Array.isArray(item.rightsScope) ? item.rightsScope as { allowedUses?: unknown[]; languages?: unknown[] } : undefined;
      const rightsReady = CLEARED_RIGHTS.includes(item.rightsStatus) && !item.revokedAt && (!item.rightsExpiresAt || item.rightsExpiresAt > new Date()) && Boolean(scope?.allowedUses?.includes('PYQ_DISCOVERY') && scope.languages?.some((value) => String(value).toLowerCase() === '*' || String(value).toLowerCase() === (item.languageCode ?? '').toLowerCase()));
      if (!rightsReady) counts.rightsPending++;
      const ready = item.verificationStatus === HistoricalMetadataVerificationStatus.VERIFIED && item.publicationEligible && rightsReady && item.examinationFamily === item.examCycle.examination.family && item.subjectCode === item.questionVersion.question.subjectCode && reviewReady && item.questionVersion.status === QuestionVersionStatus.PUBLISHED && item.questionVersion.publication?.status === PublicationStatus.ACTIVE && item.questionVersion.answerKeys.length > 0 && item.questionVersion.explanations.length > 0 && item.questionVersion.mappings.length > 0;
      if (ready) counts.publicationReady++;
      const mappings = item.questionVersion.mappings.length ? item.questionVersion.mappings : [{ syllabusTopic: { code: 'UNMAPPED', title: 'Topic mapping pending', subjectUnit: { code: 'UNMAPPED', title: 'Unit mapping pending' } } }];
      for (const mapping of mappings) {
        const key = [item.examCycle.examination.code, item.examCycle.code, item.subjectCode, item.paper ?? 'UNSPECIFIED', item.languageCode ?? 'UNSPECIFIED', mapping.syllabusTopic.subjectUnit.code, mapping.syllabusTopic.code].join('|');
        const current = byScope.get(key) ?? { examinationCode: item.examCycle.examination.code, family: item.examinationFamily, cycleCode: item.examCycle.code, subjectCode: item.subjectCode, paper: item.paper ?? 'UNSPECIFIED', language: item.languageCode ?? 'UNSPECIFIED', unit: mapping.syllabusTopic.subjectUnit.title, topic: mapping.syllabusTopic.title, reviewStatus: reviewReady ? 'REVIEWED' : 'REVIEW_PENDING', rightsStatus: rightsReady ? String(item.rightsStatus) : 'PENDING', sourceVerification: String(item.verificationStatus), publicationEligible: item.publicationEligible, total: 0, ready: 0 };
        current.total++; if (ready) current.ready++; byScope.set(key, current);
      }
    }
    return { scope: examinationCode ? code(examinationCode) : 'ALL_EXAMINATIONS', counts, byScope: [...byScope.values()], policy: 'Only VERIFIED, non-revoked, rights-cleared, explicitly scoped, publication-eligible records with published qualified question versions are student-discoverable.' };
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
