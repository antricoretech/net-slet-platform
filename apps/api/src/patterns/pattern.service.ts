import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { validateBlueprint, type SectionBlueprint, type SessionBlueprint } from '@net-slet/exam-rules';
import { AnswerPolicy, AuditEventType, DeliveryMode, PatternApprovalDecision, PatternStatus, Prisma, SessionTimingPolicy } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface EvidenceInput { officialSourceUrl: string; sourceDocumentHash: string; retrievedAt?: Date; sourcePublishedAt?: Date; effectiveAt?: Date; officialDocumentTitle: string; issuingAuthority: string; evidenceExcerpt: string; artifactReference: string; questionBankCoverage: Prisma.InputJsonValue; regressionReportId: string; }
interface SectionInput { key: string; durationSeconds: number; offeredQuestions: number; maximumAttempts: number; answerPolicy: AnswerPolicy; marksCorrect: string; marksWrong: string; exactMatch: boolean; allowMultipleCorrect: boolean; }
interface SessionInput { key: string; durationSeconds: number; sequence: number; deliveryMode: DeliveryMode; timingPolicy: SessionTimingPolicy; submitSeparately: boolean; allowReturn: boolean; sections: SectionInput[]; }
interface OverrideInput { subjectCode: string; rules: Prisma.InputJsonValue; }
interface DraftInput { cycleCode: string; subjectCode: string; version: number; rules: Prisma.InputJsonValue; sessions: SessionInput[]; languages: string[]; overrides: OverrideInput[]; evidence?: EvidenceInput; }
interface ApprovalInput { notes?: string; }

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

export function ruleHash(value: unknown): string { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }

@Injectable()
export class PatternService {
  constructor(private readonly database: PrismaService) {}

  async listPublished(examinationCode: string, cycleCode?: string, subjectCode?: string) {
    const versions = await this.database.examPatternVersion.findMany({
      where: { status: PatternStatus.PUBLISHED, subjectCode: subjectCode?.trim().toUpperCase(), examCycle: { examination: { code: examinationCode.trim().toUpperCase() }, ...(cycleCode ? { code: cycleCode.trim() } : {}) } },
      include: { examCycle: { include: { examination: true } }, evidence: true },
      orderBy: [{ subjectCode: 'asc' }, { version: 'desc' }],
    });
    return versions.map((version) => this.toPublic(version));
  }

  async getPublished(examinationCode: string, id: string) {
    const version = await this.database.examPatternVersion.findFirst({ where: { id, status: PatternStatus.PUBLISHED, examCycle: { examination: { code: examinationCode.trim().toUpperCase() } } }, include: { examCycle: { include: { examination: true } }, evidence: true } });
    if (!version) throw new NotFoundException('Published pattern not found');
    return this.toPublic(version);
  }

  async createDraft(examinationCode: string, input: unknown, actorId: string) {
    const exam = await this.database.examination.findUnique({ where: { code: examinationCode.trim().toUpperCase() } });
    if (!exam) throw new NotFoundException('Examination not found');
    const parsed = this.parseDraft(input, exam.code);
    try {
      return await this.database.$transaction(async (tx) => {
        const cycle = await tx.examCycle.upsert({ where: { examinationId_code: { examinationId: exam.id, code: parsed.cycleCode } }, update: {}, create: { examinationId: exam.id, code: parsed.cycleCode } });
        await tx.examSubject.upsert({ where: { examCycleId_code: { examCycleId: cycle.id, code: parsed.subjectCode } }, update: { name: parsed.subjectCode }, create: { examCycleId: cycle.id, code: parsed.subjectCode, name: parsed.subjectCode, status: PatternStatus.DRAFT } });
        const version = await tx.examPatternVersion.create({ data: { examCycleId: cycle.id, subjectCode: parsed.subjectCode, version: parsed.version, status: PatternStatus.DRAFT, rules: parsed.rules, ruleHash: ruleHash(parsed.rules), sourceUrl: parsed.evidence?.officialSourceUrl } });
        for (const session of parsed.sessions) {
          const sessionRecord = await tx.examSessionConfig.create({ data: { patternVersionId: version.id, key: session.key, deliveryMode: session.deliveryMode, timingPolicy: session.timingPolicy, durationSeconds: session.durationSeconds, sequence: session.sequence, submitSeparately: session.submitSeparately, allowReturn: session.allowReturn } });
          for (const section of session.sections) {
            const sectionRecord = await tx.examSectionConfig.create({ data: { sessionConfigId: sessionRecord.id, key: section.key, offeredQuestions: section.offeredQuestions, maximumAttempts: section.maximumAttempts, answerPolicy: section.answerPolicy } });
            await tx.scoringPolicy.create({ data: { sectionConfigId: sectionRecord.id, marksCorrect: section.marksCorrect, marksWrong: section.marksWrong, exactMatch: section.exactMatch, allowMultipleCorrect: section.allowMultipleCorrect } });
          }
        }
        for (const languageCode of parsed.languages) await tx.languagePolicy.create({ data: { patternVersionId: version.id, languageCode, isFallback: false } });
        for (const override of parsed.overrides) {
          const subject = await tx.examSubject.upsert({ where: { examCycleId_code: { examCycleId: cycle.id, code: override.subjectCode } }, update: { name: override.subjectCode }, create: { examCycleId: cycle.id, code: override.subjectCode, name: override.subjectCode, status: PatternStatus.DRAFT } });
          await tx.subjectPatternOverride.create({ data: { patternVersionId: version.id, subjectCode: override.subjectCode, rules: override.rules, ruleHash: ruleHash(override.rules), examSubjectId: subject.id } });
        }
        if (parsed.evidence) {
          await tx.patternEvidence.create({ data: { patternVersionId: version.id, officialSourceUrl: parsed.evidence.officialSourceUrl, sourceDocumentHash: parsed.evidence.sourceDocumentHash, retrievedAt: parsed.evidence.retrievedAt, sourcePublishedAt: parsed.evidence.sourcePublishedAt, effectiveAt: parsed.evidence.effectiveAt, officialDocumentTitle: parsed.evidence.officialDocumentTitle, issuingAuthority: parsed.evidence.issuingAuthority, evidenceExcerpt: parsed.evidence.evidenceExcerpt, artifactReference: parsed.evidence.artifactReference, questionBankCoverage: parsed.evidence.questionBankCoverage, regressionReportId: parsed.evidence.regressionReportId, submittedById: actorId } });
          await tx.examRuleSource.create({ data: { patternVersionId: version.id, title: parsed.evidence.officialDocumentTitle, issuingAuthority: parsed.evidence.issuingAuthority, cycleCode: parsed.cycleCode, retrievedAt: parsed.evidence.retrievedAt, publicationDate: parsed.evidence.sourcePublishedAt, effectiveDate: parsed.evidence.effectiveAt, sourceUrl: parsed.evidence.officialSourceUrl, evidenceExcerpt: parsed.evidence.evidenceExcerpt, documentHash: parsed.evidence.sourceDocumentHash, artifactReference: parsed.evidence.artifactReference } });
        }
        await tx.auditEvent.create({ data: { type: AuditEventType.PATTERN_DRAFT_CREATED, accountId: actorId, patternVersionId: version.id, metadata: { examinationCode: exam.code, cycleCode: parsed.cycleCode, subjectCode: parsed.subjectCode, version: parsed.version } } });
        return { id: version.id, status: version.status, examinationCode: exam.code, cycleCode: parsed.cycleCode, subjectCode: parsed.subjectCode, version: parsed.version, ruleHash: version.ruleHash };
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('A pattern version already exists for this cycle, subject and version');
      throw error;
    }
  }

  async approve(examinationCode: string, id: string, input: unknown, actorId: string, decision: PatternApprovalDecision) {
    const pattern = await this.database.examPatternVersion.findFirst({ where: { id, examCycle: { examination: { code: examinationCode.trim().toUpperCase() } } }, include: { evidence: true, examCycle: { include: { examination: true } } } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    if (pattern.status !== PatternStatus.SME_REVIEWED) throw new BadRequestException('Only submitted patterns can be reviewed');
    if (!pattern.evidence) throw new BadRequestException('Official evidence and regression evidence are required before review');
    if (pattern.ruleHash !== ruleHash(pattern.rules)) throw new BadRequestException('Pattern rules changed without a matching checksum');
    const approvalInput = this.parseApproval(input);
    return this.database.$transaction(async (tx) => {
      await tx.patternApproval.create({ data: { patternVersionId: pattern.id, reviewerId: actorId, decision, notes: approvalInput.notes, ruleHash: pattern.ruleHash!, regressionReportId: pattern.evidence!.regressionReportId } });
      const status = decision === PatternApprovalDecision.APPROVED ? PatternStatus.APPROVED : PatternStatus.REJECTED;
      const updated = await tx.examPatternVersion.update({ where: { id: pattern.id }, data: { status, reviewedBy: actorId, reviewedAt: new Date(), approvedAt: decision === PatternApprovalDecision.APPROVED ? new Date() : null } });
      await tx.auditEvent.create({ data: { type: decision === PatternApprovalDecision.APPROVED ? AuditEventType.PATTERN_APPROVED : AuditEventType.PATTERN_REJECTED, accountId: actorId, patternVersionId: pattern.id, metadata: { decision, ruleHash: pattern.ruleHash } } });
      return { id: updated.id, status: updated.status, ruleHash: updated.ruleHash };
    });
  }

  async submitForReview(examinationCode: string, id: string, actorId: string) {
    const pattern = await this.database.examPatternVersion.findFirst({ where: { id, examCycle: { examination: { code: examinationCode.trim().toUpperCase() } } }, include: { evidence: true } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    if (pattern.status !== PatternStatus.DRAFT) throw new BadRequestException('Only draft patterns can be submitted');
    if (!pattern.evidence) throw new BadRequestException('Complete source evidence is required before review');
    if (pattern.ruleHash !== ruleHash(pattern.rules)) throw new BadRequestException('Pattern rules changed without a matching checksum');
    const updated = await this.database.examPatternVersion.update({ where: { id: pattern.id }, data: { status: PatternStatus.SME_REVIEWED } });
    await this.database.auditEvent.create({ data: { type: AuditEventType.PATTERN_SUBMITTED_FOR_REVIEW, accountId: actorId, patternVersionId: pattern.id, metadata: { ruleHash: pattern.ruleHash } } });
    return { id: updated.id, status: updated.status, ruleHash: updated.ruleHash };
  }

  async publish(examinationCode: string, id: string, actorId: string) {
    const pattern = await this.database.examPatternVersion.findFirst({ where: { id, examCycle: { examination: { code: examinationCode.trim().toUpperCase() } } }, include: { evidence: true, approvals: { orderBy: { createdAt: 'desc' } }, examCycle: { include: { examination: true } } } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    if (pattern.status !== PatternStatus.APPROVED) throw new BadRequestException('Only approved patterns can be published');
    const latestApproval = pattern.approvals[0];
    if (!pattern.evidence || !latestApproval || latestApproval.decision !== PatternApprovalDecision.APPROVED || latestApproval.ruleHash !== ruleHash(pattern.rules) || pattern.ruleHash !== latestApproval.ruleHash) throw new BadRequestException('Approved evidence and checksum are required before publication');
    return this.database.$transaction(async (tx) => {
      const priorPublished = await tx.examPatternVersion.findMany({ where: { examCycleId: pattern.examCycleId, subjectCode: pattern.subjectCode, status: PatternStatus.PUBLISHED, id: { not: pattern.id } } });
      for (const prior of priorPublished) {
        await tx.examPatternVersion.update({ where: { id: prior.id }, data: { status: PatternStatus.SUPERSEDED } });
        await tx.auditEvent.create({ data: { type: AuditEventType.PATTERN_SUPERSEDED, accountId: actorId, patternVersionId: prior.id, metadata: { supersededBy: pattern.id } } });
      }
      const updated = await tx.examPatternVersion.update({ where: { id: pattern.id }, data: { status: PatternStatus.PUBLISHED, publishedAt: new Date(), publishedSnapshot: pattern.rules as Prisma.InputJsonValue } });
      await tx.auditEvent.create({ data: { type: AuditEventType.PATTERN_PUBLISHED, accountId: actorId, patternVersionId: pattern.id, metadata: { ruleHash: pattern.ruleHash, subjectCode: pattern.subjectCode } } });
      return { id: updated.id, status: updated.status, publishedAt: updated.publishedAt, ruleHash: updated.ruleHash };
    });
  }

  private parseDraft(input: unknown, examinationCode: string): DraftInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Pattern draft payload is required');
    const value = input as Record<string, unknown>;
    const cycleCode = typeof value.cycleCode === 'string' ? value.cycleCode.trim() : '';
    const subjectCode = typeof value.subjectCode === 'string' ? value.subjectCode.trim().toUpperCase() : '';
    const version = typeof value.version === 'number' ? value.version : Number(value.version);
    const rules = value.rules;
    if (!cycleCode || cycleCode.length > 60 || !/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(subjectCode) || !Number.isSafeInteger(version) || version < 1 || version > 10_000 || !rules || typeof rules !== 'object' || Array.isArray(rules)) throw new BadRequestException('Invalid pattern draft data');
    const blueprint = rules as Record<string, unknown>;
    const sections = Array.isArray(blueprint.sections) ? blueprint.sections as SectionBlueprint[] : [];
    const sessions = Array.isArray(blueprint.sessions) ? blueprint.sessions as SessionBlueprint[] : undefined;
    const errors = validateBlueprint({ examCode: examinationCode, cycleCode, subjectCode, status: 'DRAFT', sections, sessions, languages: Array.isArray(blueprint.languages) ? blueprint.languages as string[] : undefined });
    if (errors.length) throw new BadRequestException({ message: 'Pattern rules failed validation', errors });
    const evidence = this.parseEvidence(value.evidence);
    const normalizedSessions = sessions?.map((session) => this.parseSession(session)) ?? [{ key: 'MAIN', durationSeconds: sections.reduce((total, section) => total + section.durationSeconds, 0), sequence: 0, deliveryMode: DeliveryMode.CBT, timingPolicy: SessionTimingPolicy.CONTINUOUS, submitSeparately: false, allowReturn: true, sections: sections.map((section) => this.parseSection(section)) }];
    const overrides = Array.isArray(blueprint.subjectOverrides) ? blueprint.subjectOverrides.map((item) => this.parseOverride(item)) : [];
    return { cycleCode, subjectCode, version, rules: rules as Prisma.InputJsonValue, sessions: normalizedSessions, languages: Array.isArray(blueprint.languages) ? blueprint.languages as string[] : [], overrides, evidence };
  }

  private parseSession(session: SessionBlueprint): SessionInput { return { key: session.key, durationSeconds: session.durationSeconds, sequence: session.sequence, deliveryMode: session.deliveryMode as DeliveryMode, timingPolicy: session.timingPolicy as SessionTimingPolicy, submitSeparately: session.submitSeparately ?? false, allowReturn: session.allowReturn ?? true, sections: session.sections.map((section) => this.parseSection(section)) }; }
  private parseSection(section: SectionBlueprint): SectionInput { return { key: section.key, durationSeconds: section.durationSeconds, offeredQuestions: section.offeredQuestions, maximumAttempts: section.maximumAttempts, answerPolicy: (section.answerPolicy ?? 'SINGLE_SELECT') as AnswerPolicy, marksCorrect: String(section.marksCorrect ?? '0'), marksWrong: String(section.marksWrong ?? '0'), exactMatch: section.exactMatch ?? (section.answerPolicy === 'EXACT_MATCH'), allowMultipleCorrect: section.allowMultipleCorrect ?? (section.answerPolicy === 'MULTI_SELECT' || section.answerPolicy === 'EXACT_MATCH') }; }
  private parseOverride(input: unknown): OverrideInput { if (!input || typeof input !== 'object') throw new BadRequestException('Invalid subject override'); const value = input as Record<string, unknown>; const subjectCode = typeof value.subjectCode === 'string' ? value.subjectCode.trim().toUpperCase() : ''; const rules = value.rules; if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(subjectCode) || !rules || typeof rules !== 'object' || Array.isArray(rules)) throw new BadRequestException('Invalid subject override'); return { subjectCode, rules: rules as Prisma.InputJsonValue }; }

  private parseEvidence(input: unknown): EvidenceInput | undefined {
    if (input === undefined) return undefined;
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid pattern evidence');
    const value = input as Record<string, unknown>;
    const officialSourceUrl = typeof value.officialSourceUrl === 'string' ? value.officialSourceUrl.trim() : '';
    const sourceDocumentHash = typeof value.sourceDocumentHash === 'string' ? value.sourceDocumentHash.trim().toLowerCase() : '';
    const regressionReportId = typeof value.regressionReportId === 'string' ? value.regressionReportId.trim() : '';
    const retrievedAt = typeof value.retrievedAt === 'string' ? new Date(value.retrievedAt) : undefined;
    const officialDocumentTitle = typeof value.officialDocumentTitle === 'string' ? value.officialDocumentTitle.trim() : '';
    const issuingAuthority = typeof value.issuingAuthority === 'string' ? value.issuingAuthority.trim() : '';
    const evidenceExcerpt = typeof value.evidenceExcerpt === 'string' ? value.evidenceExcerpt.trim() : '';
    const artifactReference = typeof value.artifactReference === 'string' ? value.artifactReference.trim() : '';
    const questionBankCoverage = value.questionBankCoverage;
    const sourcePublishedAt = typeof value.sourcePublishedAt === 'string' ? new Date(value.sourcePublishedAt) : undefined;
    const effectiveAt = typeof value.effectiveAt === 'string' ? new Date(value.effectiveAt) : undefined;
    if (!this.isHttpsUrl(officialSourceUrl) || !/^[a-f0-9]{64}$/.test(sourceDocumentHash) || !regressionReportId || regressionReportId.length > 160 || !officialDocumentTitle || !issuingAuthority || !evidenceExcerpt || !artifactReference || !questionBankCoverage || typeof questionBankCoverage !== 'object' || (retrievedAt && Number.isNaN(retrievedAt.getTime())) || (sourcePublishedAt && Number.isNaN(sourcePublishedAt.getTime())) || (effectiveAt && Number.isNaN(effectiveAt.getTime()))) throw new BadRequestException('Complete official source, retrieval, authority, excerpt, artifact, coverage and regression evidence are required');
    return { officialSourceUrl, sourceDocumentHash, retrievedAt, sourcePublishedAt, effectiveAt, officialDocumentTitle, issuingAuthority, evidenceExcerpt, artifactReference, questionBankCoverage: questionBankCoverage as Prisma.InputJsonValue, regressionReportId };
  }

  private parseApproval(input: unknown): ApprovalInput {
    if (input === undefined) return {};
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid approval input');
    const notes = (input as Record<string, unknown>).notes;
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) throw new BadRequestException('Approval notes are invalid');
    return { notes: notes as string | undefined };
  }

  private isHttpsUrl(value: string): boolean { try { return new URL(value).protocol === 'https:'; } catch { return false; } }
  private isUniqueError(error: unknown): boolean { return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'); }

  private toPublic(version: { id: string; subjectCode: string; version: number; status: PatternStatus; ruleHash: string | null; publishedAt: Date | null; publishedSnapshot: Prisma.JsonValue | null; rules: Prisma.JsonValue; sourceUrl: string | null; examCycle: { code: string; examination: { code: string } }; evidence: { officialSourceUrl: string } | null }) {
    return { id: version.id, examinationCode: version.examCycle.examination.code, cycleCode: version.examCycle.code, subjectCode: version.subjectCode, version: version.version, status: version.status, ruleHash: version.ruleHash, publishedAt: version.publishedAt, sourceUrl: version.evidence?.officialSourceUrl ?? version.sourceUrl, rules: version.publishedSnapshot ?? version.rules };
  }
}
