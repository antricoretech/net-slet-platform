import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { generateTestForm, type ExamBlueprint, type PublishedQuestionInput } from '@net-slet/exam-rules';
import { PatternApprovalDecision, PatternStatus, Prisma, QuestionVersionStatus, ReviewDecision, RightsStatus, TestFormStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ruleHash } from '../patterns/pattern.service';

type JsonRecord = Record<string, unknown>;
type Selection = { questionVersionId: string; sectionKey: string; sequence?: number; languageCode?: string };

function object(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}; }
function sha256(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function inputObject(value: unknown, label: string): JsonRecord { const result = object(value); if (!Object.keys(result).length) throw new BadRequestException(`${label} is required`); return result; }

@Injectable()
export class ContentPublicationService {
  constructor(private readonly database: PrismaService) {}

  async patternReadiness(patternId: string) {
    const pattern = await this.database.examPatternVersion.findUnique({ where: { id: patternId }, include: { evidence: true, approvals: { orderBy: { createdAt: 'desc' } }, examCycle: { include: { examination: true } } } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    const latest = pattern.approvals[0];
    const errors: string[] = [];
    if (pattern.status !== PatternStatus.APPROVED && pattern.status !== PatternStatus.PUBLISHED) errors.push(`Pattern status is ${pattern.status}, not approved or published`);
    if (!pattern.evidence) errors.push('Authoritative pattern evidence is missing');
    if (!latest || latest.decision !== PatternApprovalDecision.APPROVED) errors.push('Distinct SME approval is missing');
    if (!pattern.ruleHash || pattern.ruleHash !== ruleHash(pattern.rules)) errors.push('Pattern rule checksum is missing or stale');
    if (latest && latest.ruleHash !== pattern.ruleHash) errors.push('Approval was recorded for a different rule checksum');
    return {
      patternId: pattern.id,
      examinationCode: pattern.examCycle.examination.code,
      cycleCode: pattern.examCycle.code,
      subjectCode: pattern.subjectCode,
      status: pattern.status,
      officialEligible: errors.length === 0,
      errors,
      evidence: pattern.evidence ? { sourceUrl: pattern.evidence.officialSourceUrl, documentHash: pattern.evidence.sourceDocumentHash, issuingAuthority: pattern.evidence.issuingAuthority, regressionReportId: pattern.evidence.regressionReportId } : null,
      approval: latest ? { decision: latest.decision, reviewerId: latest.reviewerId, approvalRef: latest.regressionReportId, createdAt: latest.createdAt } : null,
      notice: errors.length ? 'This pattern cannot support an official publication claim.' : 'Technical readiness only; publication authorization remains a separate decision.',
    };
  }

  async qualifyInventory(patternId: string, input: unknown) {
    const body = inputObject(input, 'Inventory qualification request');
    const requiredLanguages = Array.isArray(body.requiredLanguages) ? body.requiredLanguages.filter((value): value is string => typeof value === 'string').map((value) => value.trim()) : ['en'];
    const pattern = await this.database.examPatternVersion.findUnique({ where: { id: patternId }, include: { examCycle: { include: { examination: true } } } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    const revisions = await this.database.questionVersion.findMany({
      where: { status: QuestionVersionStatus.PUBLISHED, question: { examCycleId: pattern.examCycleId, subjectCode: pattern.subjectCode }, publication: { status: 'ACTIVE' } },
      include: { question: { include: { examCycle: { include: { examination: true } } } }, options: { orderBy: { sequence: 'asc' } }, answerKeys: { orderBy: { version: 'desc' }, take: 1 }, explanations: { orderBy: { version: 'desc' }, take: 1 }, mappings: true, provenance: true, licences: true, translations: true, reviews: true, publication: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const issues: string[] = [];
    const qualified = revisions.flatMap((revision) => {
      const prefix = revision.id;
      const errors: string[] = [];
      if (!revision.publication || revision.publication.status !== 'ACTIVE') errors.push('active publication snapshot missing');
      if (!revision.answerKeys[0]) errors.push('answer key missing');
      if (!revision.explanations[0]) errors.push('reviewed explanation missing');
      if (!revision.mappings.length) errors.push('syllabus mapping missing');
      if (!revision.provenance.length || revision.provenance.some((item) => item.rightsStatus === RightsStatus.UNKNOWN || item.rightsStatus === RightsStatus.RESTRICTED)) errors.push('rights/provenance evidence incomplete');
      if (revision.provenance.some((item) => item.rightsStatus === RightsStatus.LICENSED || item.rightsStatus === RightsStatus.PERMISSION_GRANTED) && !revision.licences.length) errors.push('licence evidence missing');
      const approvedReviewers = new Set(revision.reviews.filter((review) => review.decision === ReviewDecision.APPROVED).map((review) => review.reviewerId).filter((reviewerId) => reviewerId !== revision.authoredById));
      if (approvedReviewers.size < 2) errors.push('two-person review evidence missing');
      for (const language of requiredLanguages) if (language !== revision.languageCode && !revision.translations.some((translation) => translation.languageCode === language && translation.status === 'APPROVED')) errors.push(`approved translation missing: ${language}`);
      if (errors.length) { issues.push(`${prefix}: ${errors.join(', ')}`); return []; }
      return [{ questionVersionId: revision.id, questionId: revision.questionId, version: revision.version, languageCode: revision.languageCode, answerKeyVersionId: revision.answerKeys[0]!.id, sectionKey: text(body.sectionKey) || 'MAIN', groupId: revision.groupId, contentHash: revision.publication!.contentHash }];
    });
    const ids = qualified.map((item) => item.questionVersionId);
    if (new Set(ids).size !== ids.length) issues.push('duplicate question version selected');
    return { patternId, examinationCode: pattern.examCycle.examination.code, cycleCode: pattern.examCycle.code, subjectCode: pattern.subjectCode, requiredLanguages, inspectedCount: revisions.length, qualifiedCount: qualified.length, qualified, issues, eligible: issues.length === 0 && qualified.length > 0, notice: 'Qualification is technical content readiness; it is not academic certification.' };
  }

  async compileDraft(patternId: string, input: unknown, actorId: string) {
    const body = inputObject(input, 'Form compilation request');
    const selections = this.parseSelections(body.selections);
    const pattern = await this.database.examPatternVersion.findUnique({ where: { id: patternId }, include: { examCycle: { include: { examination: true } } } });
    if (!pattern) throw new NotFoundException('Pattern version not found');
    if (pattern.status !== PatternStatus.APPROVED && pattern.status !== PatternStatus.PUBLISHED) throw new ConflictException('Only approved patterns can compile a form');
    const revisions = await this.database.questionVersion.findMany({ where: { id: { in: selections.map((item) => item.questionVersionId) }, status: QuestionVersionStatus.PUBLISHED, question: { examCycleId: pattern.examCycleId, subjectCode: pattern.subjectCode }, publication: { status: 'ACTIVE' } }, include: { options: { orderBy: { sequence: 'asc' } }, answerKeys: { orderBy: { version: 'desc' }, take: 1 }, publication: true, question: true } });
    if (revisions.length !== selections.length) throw new ConflictException('Every selected question must be published in the exact pattern scope');
    const byId = new Map(revisions.map((revision) => [revision.id, revision]));
    const blueprint = pattern.rules as unknown as ExamBlueprint;
    const inventory: PublishedQuestionInput[] = selections.map((selection) => {
      const revision = byId.get(selection.questionVersionId)!;
      if (!revision.answerKeys[0]) throw new ConflictException(`Answer key missing for ${revision.id}`);
      const snapshot = object(revision.publication?.snapshot);
      return { id: revision.id, questionVersionId: revision.id, status: 'PUBLISHED', examCode: pattern.examCycle.examination.code, cycleCode: pattern.examCycle.code, subjectCode: pattern.subjectCode, sectionKey: selection.sectionKey, type: revision.type, languageCodes: [selection.languageCode ?? revision.languageCode], prompt: JSON.stringify(snapshot.prompt ?? revision.prompt), options: revision.options.map((option) => ({ id: option.optionKey, label: JSON.stringify(option.optionText) })), groupId: revision.groupId ?? undefined };
    });
    let generated;
    try { generated = generateTestForm({ blueprint, inventory, languageCode: text(body.languageCode) || 'en', seed: text(body.seed) || 'release-1', generatedAt: new Date().toISOString() }); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Deterministic form compilation failed'); }
    const qaOnly = body.qaOnly === true;
    const publication = { status: 'DRAFT', qaOnly, officialEvidenceVerified: false, contentInventoryQualified: true, rightsCleared: true, reviewerApproved: false, regressionEvidence: [], notice: 'QA-only or unapproved forms are not official examination content.' };
    const snapshot = { ...generated, publication } as unknown as Prisma.InputJsonValue;
    const snapshotHash = sha256(snapshot);
    const version = typeof body.version === 'number' ? body.version : 1;
    return this.database.$transaction(async (tx) => {
      const form = await tx.testForm.create({ data: { examCycleId: pattern.examCycleId, patternVersionId: pattern.id, subjectCode: pattern.subjectCode, version, status: TestFormStatus.DRAFT, snapshot, snapshotHash, createdById: actorId, questions: { create: selections.map((selection, index) => { const revision = byId.get(selection.questionVersionId)!; return { questionVersionId: revision.id, answerKeyVersionId: revision.answerKeys[0]!.id, sessionKey: 'MAIN', sectionKey: selection.sectionKey, sequence: selection.sequence ?? index, snapshot: generated.sections.flatMap((section) => section.questions).find((question) => question.questionVersionId === revision.id) as unknown as Prisma.InputJsonValue }; }) } }, include: { questions: true } });
      return { id: form.id, status: form.status, version: form.version, snapshotId: generated.snapshotId, snapshotHash: form.snapshotHash, questionCount: form.questions.length, qaOnly, answerKeyVersionIds: form.questions.map((question) => question.answerKeyVersionId) };
    });
  }

  async publish(formId: string, actorId: string) {
    const form = await this.database.testForm.findUnique({ where: { id: formId }, include: { patternVersion: true, questions: true } });
    if (!form) throw new NotFoundException('Test form not found');
    if (form.status === TestFormStatus.PUBLISHED) return { id: form.id, status: form.status, publishedAt: form.publishedAt, idempotent: true };
    if (form.status !== TestFormStatus.DRAFT) throw new ConflictException('Only draft forms can be published');
    if (form.patternVersion.status !== PatternStatus.APPROVED && form.patternVersion.status !== PatternStatus.PUBLISHED) throw new ConflictException('The linked pattern is not approved');
    const snapshot = object(form.snapshot); const publication = object(snapshot.publication);
    if (publication.qaOnly !== true && (publication.officialEvidenceVerified !== true || publication.reviewerApproved !== true)) throw new ConflictException('Strict publication requires explicit evidence and reviewer authorization');
    const updated = await this.database.testForm.updateMany({ where: { id: form.id, status: TestFormStatus.DRAFT, snapshotHash: form.snapshotHash }, data: { status: TestFormStatus.PUBLISHED, publishedAt: new Date() } });
    if (updated.count !== 1) throw new ConflictException('Form changed concurrently');
    return { id: form.id, status: TestFormStatus.PUBLISHED, publishedAt: new Date(), idempotent: false, actorId };
  }

  async listAdminForms() { return this.database.testForm.findMany({ select: { id: true, subjectCode: true, version: true, status: true, snapshotHash: true, publishedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }); }

  private parseSelections(value: unknown): Selection[] { if (!Array.isArray(value) || !value.length) throw new BadRequestException('At least one question selection is required'); const result = value.map((item) => { const row = inputObject(item, 'Question selection'); const questionVersionId = text(row.questionVersionId); const sectionKey = text(row.sectionKey); if (!questionVersionId || !sectionKey) throw new BadRequestException('Question version and section are required'); return { questionVersionId, sectionKey, sequence: typeof row.sequence === 'number' ? row.sequence : undefined, languageCode: text(row.languageCode) || undefined }; }); if (new Set(result.map((item) => item.questionVersionId)).size !== result.length) throw new BadRequestException('Question versions must be unique'); return result; }
}
