import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HistoricalMetadataGovernanceStatus, HistoricalMetadataRecordStatus, HistoricalMetadataVerificationStatus, PatternStatus, Prisma, PublicationStatus, QuestionVersionStatus, ReviewDecision, SyllabusStatus, TestFormStatus } from '../generated/prisma/client';
import { resolveCurrentPattern, type PreparationPatternCandidate } from '@net-slet/exam-rules';
import { PrismaService } from '../database/prisma.service';
import { CLEARED_RIGHTS, evaluateFormEligibility, evaluateHistoricalMetadataEligibility, evaluateQuestionEligibility } from './eligibility';

const code = (value: string) => value.trim().toUpperCase();
const stringQuery = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const integerQuery = (value: unknown) => typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : undefined;
const positiveIntegerQuery = (value: unknown, fallback: number, maximum: number) => typeof value === 'string' && /^\d+$/.test(value) ? Math.min(Math.max(Number(value), 1), maximum) : fallback;
const HISTORICAL_PYQ_BATCH_SIZE = 100;
type HistoricalContentUse = 'QUESTION_DISPLAY' | 'PRACTICE_USE' | 'MOCK_USE';
type HistoricalPyqCursor = { year: number; sequence: number; id: string };
const decodeHistoricalPyqCursor = (value: unknown): HistoricalPyqCursor | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<HistoricalPyqCursor>;
    if (!Number.isInteger(parsed.year) || !Number.isInteger(parsed.sequence) || typeof parsed.id !== 'string' || !parsed.id) throw new Error('invalid');
    return { year: Number(parsed.year), sequence: Number(parsed.sequence), id: parsed.id };
  } catch { throw new BadRequestException('Invalid PYQ pagination cursor'); }
};
const encodeHistoricalPyqCursor = (value: HistoricalPyqCursor) => Buffer.from(JSON.stringify(value)).toString('base64url');

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
    const cursor = decodeHistoricalPyqCursor(query.cursor);
    if (page > 1 && !cursor) throw new BadRequestException('A cursor is required after the first PYQ page');
    const baseWhere: Prisma.HistoricalQuestionMetadataWhereInput = {
        examCycle: { examination: { code: code(examinationCode) }, ...(cycleCode ? { code: cycleCode } : {}) },
        sourceYear: year ?? { not: null },
        questionSequence: { not: null },
        ...(session ? { session: { equals: session, mode: 'insensitive' as const } } : {}),
        ...(paper ? { paper: { equals: paper, mode: 'insensitive' as const } } : {}),
        ...(language ? { languageCode: { equals: language, mode: 'insensitive' as const } } : {}),
        ...(subjectCode ? { subjectCode: code(subjectCode) } : {}),
        verificationStatus: HistoricalMetadataVerificationStatus.VERIFIED,
        governanceStatus: HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE,
        publicationEligible: true,
        revokedAt: null,
        rightsStatus: { in: [...CLEARED_RIGHTS] },
        questionVersion: { status: QuestionVersionStatus.PUBLISHED, publication: { is: { status: PublicationStatus.ACTIVE } }, answerKeys: { some: {} }, explanations: { some: {} }, mappings: { some: {} } },
      };
    const eligible = [];
    let anchor = cursor;
    let exhausted = false;
    while (eligible.length <= pageSize && !exhausted) {
      const metadata = await this.database.historicalQuestionMetadata.findMany({
        where: { ...baseWhere, ...(anchor ? { OR: [{ sourceYear: { lt: anchor.year } }, { sourceYear: anchor.year, questionSequence: { gt: anchor.sequence } }, { sourceYear: anchor.year, questionSequence: anchor.sequence, id: { gt: anchor.id } }] } : {}) },
        select: { id: true, questionVersionId: true, examinationFamily: true, authority: true, sourceYear: true, historicalCycle: true, session: true, paper: true, subjectCode: true, questionPaperReference: true, questionSequence: true, languageCode: true, sourceReference: true, sourceChecksum: true, answerKeyProvenance: true, rightsStatus: true, rightsScope: true, rightsExpiresAt: true, revokedAt: true, recordStatus: true, verificationStatus: true, publicationEligible: true, examCycle: { select: { code: true, examination: { select: { family: true } } } }, questionVersion: { select: { languageCode: true, publishedAt: true, question: { select: { subjectCode: true } }, translations: { where: { status: 'APPROVED' }, select: { languageCode: true } }, reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } }, answerKeys: { select: { id: true } }, explanations: { select: { id: true } }, mappings: { select: { syllabusTopicId: true } }, publication: { select: { status: true } } } } },
        orderBy: [{ sourceYear: 'desc' }, { questionSequence: 'asc' }, { id: 'asc' }],
        take: HISTORICAL_PYQ_BATCH_SIZE,
      });
      if (!metadata.length) { exhausted = true; break; }
      for (const item of metadata) {
        const requestedLanguage = language ?? item.languageCode ?? item.questionVersion.languageCode;
        const languageAuthorized = !requestedLanguage || item.questionVersion.languageCode.toLowerCase() === requestedLanguage.toLowerCase() || item.questionVersion.translations.some((translation) => translation.languageCode.toLowerCase() === requestedLanguage.toLowerCase());
        const decision = evaluateHistoricalMetadataEligibility({ verificationStatus: item.verificationStatus, recordStatus: item.recordStatus, publicationEligible: item.publicationEligible, rightsStatus: item.rightsStatus, rightsScope: item.rightsScope, rightsExpiresAt: item.rightsExpiresAt, revokedAt: item.revokedAt, requestedLanguage, examinationFamilyMatches: item.examinationFamily === item.examCycle.examination.family, subjectMatches: item.subjectCode === item.questionVersion.question.subjectCode, question: { status: QuestionVersionStatus.PUBLISHED, publicationStatus: item.questionVersion.publication?.status, answerKeyCount: item.questionVersion.answerKeys.length, explanationCount: item.questionVersion.explanations.length, mappingCount: item.questionVersion.mappings.length, provenanceRights: [item.rightsStatus], approvedReviewerIds: item.questionVersion.reviews.map((review) => review.reviewerId) } });
        if (languageAuthorized && decision.eligible) eligible.push(item);
        if (eligible.length > pageSize) break;
      }
      const last = metadata[metadata.length - 1];
      anchor = { year: last.sourceYear!, sequence: last.questionSequence!, id: last.id };
      exhausted = metadata.length < HISTORICAL_PYQ_BATCH_SIZE;
    }
    const visible = eligible.slice(0, pageSize);
    const hasNextPage = eligible.length > pageSize || (!exhausted && visible.length > 0);
    const nextCursor = hasNextPage && visible.length ? encodeHistoricalPyqCursor({ year: Number(visible[visible.length - 1].sourceYear), sequence: Number(visible[visible.length - 1].questionSequence), id: String(visible[visible.length - 1].id) }) : undefined;
    return { data: visible.map((item) => ({ questionId: item.questionVersionId, questionVersionId: item.questionVersionId, examinationCode: code(examinationCode), examinationFamily: item.examinationFamily, cycleCode: item.examCycle.code, authority: item.authority, year: item.sourceYear, cycle: item.historicalCycle, session: item.session, paper: item.paper, subjectCode: item.subjectCode, questionPaperReference: item.questionPaperReference, questionSequence: item.questionSequence, language: item.languageCode, sourceReference: item.sourceReference, sourceChecksum: item.sourceChecksum, answerKeyProvenance: item.answerKeyProvenance, rightsStatus: item.rightsStatus, rightsScope: item.rightsScope, publishedAt: item.questionVersion.publishedAt })), pagination: { page, pageSize, returned: visible.length, hasNextPage, nextCursor }, filters: { year, cycleCode, session, paper, language, subjectCode }, rightsPolicy: 'VERIFIED_METADATA_AND_CLEARED_RIGHTS_ONLY', notices: visible.length ? [] : ['No verified rights-cleared historical questions match these filters.'] };
  }

  async historicalQuestion(examinationCode: string, questionVersionId: string, languageCode = 'en', use: HistoricalContentUse = 'QUESTION_DISPLAY') {
    const metadata = await this.database.historicalQuestionMetadata.findFirst({
      where: { questionVersionId, examCycle: { examination: { code: code(examinationCode) } }, governanceStatus: HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE, publicationEligible: true, revokedAt: null },
      select: {
        questionVersionId: true, examinationFamily: true, rightsStatus: true, rightsScope: true, rightsExpiresAt: true, verificationStatus: true, recordStatus: true,
        examCycle: { select: { examination: { select: { family: true } } } },
        questionVersion: {
          select: {
            languageCode: true, prompt: true, status: true, question: { select: { subjectCode: true } },
            options: { orderBy: { sequence: 'asc' }, select: { optionKey: true, optionText: true, sequence: true } },
            translations: { where: { languageCode, status: 'APPROVED' }, select: { languageCode: true, prompt: true } },
            publication: { select: { status: true } }, reviews: { where: { decision: ReviewDecision.APPROVED }, select: { reviewerId: true } },
            answerKeys: { select: { id: true } }, explanations: { select: { id: true } }, mappings: { select: { id: true } },
          },
        },
      },
    });
    if (!metadata) throw new NotFoundException('Historical question is not publication eligible');
    const translation = metadata.questionVersion.translations[0];
    const decision = evaluateHistoricalMetadataEligibility({ verificationStatus: metadata.verificationStatus, recordStatus: metadata.recordStatus, publicationEligible: true, rightsStatus: metadata.rightsStatus, rightsScope: metadata.rightsScope, rightsExpiresAt: metadata.rightsExpiresAt, revokedAt: null, requestedLanguage: languageCode, requiredUse: use, examinationFamilyMatches: metadata.examinationFamily === metadata.examCycle.examination.family, subjectMatches: true, question: { status: metadata.questionVersion.status, publicationStatus: metadata.questionVersion.publication?.status, answerKeyCount: metadata.questionVersion.answerKeys.length, explanationCount: metadata.questionVersion.explanations.length, mappingCount: metadata.questionVersion.mappings.length, provenanceRights: [metadata.rightsStatus], approvedReviewerIds: metadata.questionVersion.reviews.map((review) => review.reviewerId) } });
    if (!decision.eligible) throw new NotFoundException('Historical question is not authorized for this use');
    return { questionVersionId: metadata.questionVersionId, languageCode: translation?.languageCode ?? metadata.questionVersion.languageCode, prompt: translation?.prompt ?? metadata.questionVersion.prompt, options: metadata.questionVersion.options, rightsPolicy: use };
  }

  async historicalInventoryReadiness(examinationCode?: string) {
    const records = await this.database.historicalQuestionMetadata.findMany({
      where: examinationCode ? { examCycle: { examination: { code: code(examinationCode) } } } : {},
      select: {
        recordStatus: true,
        governanceStatus: true,
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
            id: true, questionId: true, status: true,
            question: { select: { id: true, subjectCode: true } },
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
    const counts = { imported: records.length, uniqueQuestions: 0, questionVersions: 0, validated: 0, academicallyApproved: 0, rightsCleared: 0, verified: 0, reviewPending: 0, rightsPending: 0, rejected: 0, duplicated: 0, revoked: 0, superseded: 0, publicationReady: 0, missingExplanations: 0, missingAnswerKeys: 0, missingSyllabusMappings: 0, missingIndependentApprovals: 0, totalMetadata: records.length };
    counts.questionVersions = new Set(records.map((item) => item.questionVersion.id)).size;
    counts.uniqueQuestions = new Set(records.map((item) => item.questionVersion.questionId)).size;
    const byScope = new Map<string, { examinationCode: string; family: string; cycleCode: string; subjectCode: string; paper: string; language: string; unit: string; topic: string; reviewStatus: string; rightsStatus: string; sourceVerification: string; publicationEligible: boolean; total: number; ready: number }>();
    for (const item of records) {
      if (item.recordStatus === HistoricalMetadataRecordStatus.VALIDATED || item.recordStatus === HistoricalMetadataRecordStatus.VERIFIED) counts.validated++;
      if (item.verificationStatus === HistoricalMetadataVerificationStatus.VERIFIED) counts.verified++;
      if (([HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED, HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED, HistoricalMetadataGovernanceStatus.APPROVED, HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE] as HistoricalMetadataGovernanceStatus[]).includes(item.governanceStatus)) counts.academicallyApproved++;
      if (item.recordStatus === HistoricalMetadataRecordStatus.REJECTED) counts.rejected++;
      if (item.recordStatus === HistoricalMetadataRecordStatus.DUPLICATE) counts.duplicated++;
      if (item.revokedAt) counts.revoked++;
      if (item.governanceStatus === HistoricalMetadataGovernanceStatus.SUPERSEDED) counts.superseded++;
      const reviewReady = new Set(item.questionVersion.reviews.map((review) => review.reviewerId)).size >= 2;
      if (!reviewReady) counts.reviewPending++;
      const scope = item.rightsScope && typeof item.rightsScope === 'object' && !Array.isArray(item.rightsScope) ? item.rightsScope as { allowedUses?: unknown[]; languages?: unknown[] } : undefined;
      const rightsReady = CLEARED_RIGHTS.includes(item.rightsStatus) && !item.revokedAt && (!item.rightsExpiresAt || item.rightsExpiresAt > new Date()) && Boolean(scope?.allowedUses?.includes('PYQ_DISCOVERY') && scope.languages?.some((value) => String(value).toLowerCase() === '*' || String(value).toLowerCase() === (item.languageCode ?? '').toLowerCase()));
      if (!rightsReady) counts.rightsPending++;
      if (rightsReady) counts.rightsCleared++;
      if (!item.questionVersion.explanations.length) counts.missingExplanations++;
      if (!item.questionVersion.answerKeys.length) counts.missingAnswerKeys++;
      if (!item.questionVersion.mappings.length) counts.missingSyllabusMappings++;
      const ready = item.verificationStatus === HistoricalMetadataVerificationStatus.VERIFIED && item.publicationEligible && rightsReady && item.examinationFamily === item.examCycle.examination.family && item.subjectCode === item.questionVersion.question.subjectCode && reviewReady && item.questionVersion.status === QuestionVersionStatus.PUBLISHED && item.questionVersion.publication?.status === PublicationStatus.ACTIVE && item.questionVersion.answerKeys.length > 0 && item.questionVersion.explanations.length > 0 && item.questionVersion.mappings.length > 0;
      if (ready) counts.publicationReady++;
      if (!reviewReady || !rightsReady) counts.missingIndependentApprovals++;
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
