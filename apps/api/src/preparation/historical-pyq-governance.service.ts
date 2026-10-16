import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, AuditEventType, GovernanceApprovalStatus, GovernanceApprovalType, HistoricalMetadataGovernanceStatus, HistoricalMetadataRecordStatus, HistoricalMetadataVerificationStatus, Prisma, PublicationStatus, QuestionVersionStatus, RightsStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

const CLEARED_RIGHTS: RightsStatus[] = [RightsStatus.OWNED, RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED, RightsStatus.PUBLIC_DOMAIN, RightsStatus.FAIR_USE_JUSTIFIED];
const REQUIRED_PUBLICATION_USES = ['QUESTION_DISPLAY', 'PRACTICE_USE', 'MOCK_USE'];

export interface GovernanceDecisionInput { evidenceReference: string; notes?: string; sourceVerification?: string; scope?: { allowedUses?: string[]; languages?: string[] }; }

@Injectable()
export class HistoricalPyqGovernanceService {
  constructor(private readonly database: PrismaService) {}

  async queue(actorId: string, status?: HistoricalMetadataGovernanceStatus) {
    const account = await this.database.account.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!account || !([AccountRole.ADMIN, AccountRole.SME] as AccountRole[]).includes(account.role)) throw new ForbiddenException('Academic governance access required');
    return this.database.historicalQuestionMetadata.findMany({
      where: { governanceStatus: status ?? { in: [HistoricalMetadataGovernanceStatus.IMPORTED, HistoricalMetadataGovernanceStatus.VALIDATED, HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED, HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED, HistoricalMetadataGovernanceStatus.APPROVED] } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 100,
      select: { id: true, questionVersionId: true, governanceStatus: true, recordStatus: true, verificationStatus: true, publicationEligible: true, revokedAt: true, subjectCode: true, examinationFamily: true, sourceReference: true, sourceChecksum: true, examCycle: { select: { code: true, examination: { select: { code: true } } } }, questionVersion: { select: { status: true, authoredById: true, languageCode: true } }, governanceApprovals: { orderBy: { createdAt: 'desc' }, take: 10, select: { type: true, status: true, reviewerId: true, evidenceReference: true, decisionAt: true } } },
    });
  }

  async validate(metadataId: string, actorId: string, input: GovernanceDecisionInput) {
    const metadata = await this.requireMetadata(metadataId);
    this.requireEvidence(input);
    if (metadata.governanceStatus === HistoricalMetadataGovernanceStatus.VALIDATED) return { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.VALIDATED };
    if (metadata.governanceStatus !== HistoricalMetadataGovernanceStatus.IMPORTED) throw new ConflictException('Only imported metadata can be validated');
    await this.database.$transaction(async (tx) => {
      const updated = await tx.historicalQuestionMetadata.updateMany({ where: { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.IMPORTED }, data: { governanceStatus: HistoricalMetadataGovernanceStatus.VALIDATED, recordStatus: HistoricalMetadataRecordStatus.VALIDATED } });
      if (updated.count !== 1) throw new ConflictException('Metadata validation became stale');
      await this.audit(tx, AuditEventType.HISTORICAL_METADATA_VALIDATED, actorId, metadata, { evidenceReference: input.evidenceReference, notes: input.notes });
    });
    return { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.VALIDATED };
  }

  async academicallyReview(metadataId: string, actorId: string, input: GovernanceDecisionInput) {
    const metadata = await this.requireMetadata(metadataId);
    this.requireEvidence(input);
    const replay = this.replay(metadata, GovernanceApprovalType.HISTORICAL_METADATA_ACADEMIC_REVIEW, HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED); if (replay) return replay;
    if (metadata.governanceStatus !== HistoricalMetadataGovernanceStatus.VALIDATED) throw new ConflictException('Validated metadata is required');
    if (metadata.importerId === actorId || metadata.questionVersion.authoredById === actorId) throw new ForbiddenException('The importer or question author cannot perform the academic review');
    if (!metadata.sourceReference || !metadata.sourceChecksum || metadata.examinationFamily !== metadata.examCycle.examination.family || metadata.subjectCode !== metadata.questionVersion.question.subjectCode) throw new BadRequestException('Source, examination and subject compatibility evidence is required');
    return this.decision(metadata, actorId, input, GovernanceApprovalType.HISTORICAL_METADATA_ACADEMIC_REVIEW, HistoricalMetadataGovernanceStatus.VALIDATED, HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED, AuditEventType.HISTORICAL_METADATA_ACADEMICALLY_REVIEWED);
  }

  async verifyRights(metadataId: string, actorId: string, input: GovernanceDecisionInput) {
    const metadata = await this.requireMetadata(metadataId);
    this.requireEvidence(input);
    const replay = this.replay(metadata, GovernanceApprovalType.HISTORICAL_METADATA_RIGHTS_VERIFICATION, HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED); if (replay) return replay;
    if (metadata.governanceStatus !== HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED) throw new ConflictException('Independent academic review is required first');
    if (metadata.importerId === actorId || metadata.academicReviewerId === actorId) throw new ForbiddenException('Rights verification requires an independent reviewer');
    const scope = this.inputScope(input.scope, metadata.rightsScope);
    this.assertRights(metadata.rightsStatus, metadata.rightsExpiresAt, scope);
    return this.decision(metadata, actorId, { ...input, scope }, GovernanceApprovalType.HISTORICAL_METADATA_RIGHTS_VERIFICATION, HistoricalMetadataGovernanceStatus.ACADEMICALLY_REVIEWED, HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED, AuditEventType.HISTORICAL_METADATA_RIGHTS_VERIFIED, { recordStatus: HistoricalMetadataRecordStatus.VERIFIED, verificationStatus: HistoricalMetadataVerificationStatus.VERIFIED });
  }

  async approve(metadataId: string, actorId: string, input: GovernanceDecisionInput) {
    const metadata = await this.requireMetadata(metadataId);
    this.requireEvidence(input);
    const replay = this.replay(metadata, GovernanceApprovalType.HISTORICAL_METADATA_PUBLICATION, HistoricalMetadataGovernanceStatus.APPROVED); if (replay) return replay;
    if (metadata.governanceStatus !== HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED) throw new ConflictException('Rights verification is required first');
    if (metadata.importerId === actorId || metadata.academicReviewerId === actorId || metadata.rightsReviewerId === actorId) throw new ForbiddenException('Publication approval requires separation of duties');
    return this.decision(metadata, actorId, input, GovernanceApprovalType.HISTORICAL_METADATA_PUBLICATION, HistoricalMetadataGovernanceStatus.RIGHTS_VERIFIED, HistoricalMetadataGovernanceStatus.APPROVED, AuditEventType.HISTORICAL_METADATA_APPROVED);
  }

  async makePublicationEligible(metadataId: string, actorId: string, input: GovernanceDecisionInput) {
    const metadata = await this.requireMetadata(metadataId);
    this.requireEvidence(input);
    if (metadata.governanceStatus === HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE) return { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE, publicationEligible: true };
    if (metadata.governanceStatus !== HistoricalMetadataGovernanceStatus.APPROVED) throw new ConflictException('Approved metadata is required');
    if (metadata.importerId === actorId || metadata.academicReviewerId === actorId || metadata.rightsReviewerId === actorId || metadata.approvalReviewerId === actorId) throw new ForbiddenException('Publication eligibility requires an independent authorized actor');
    const scope = this.inputScope(input.scope, metadata.rightsScope);
    this.assertRights(metadata.rightsStatus, metadata.rightsExpiresAt, scope);
    if (!REQUIRED_PUBLICATION_USES.every((use) => scope.allowedUses.includes(use))) throw new BadRequestException('Display, practice and mock rights are all required for publication eligibility');
    if (metadata.questionVersion.status !== QuestionVersionStatus.PUBLISHED || metadata.questionVersion.publication?.status !== PublicationStatus.ACTIVE || !metadata.questionVersion.answerKeys.length || !metadata.questionVersion.explanations.length || !metadata.questionVersion.mappings.length) throw new BadRequestException('Published question, answer key, explanation and syllabus mapping are required');
    await this.database.$transaction(async (tx) => {
      const updated = await tx.historicalQuestionMetadata.updateMany({ where: { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.APPROVED, revokedAt: null }, data: { governanceStatus: HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE, publicationEligible: true } });
      if (updated.count !== 1) throw new ConflictException('Publication eligibility became stale or was revoked');
      await this.audit(tx, AuditEventType.HISTORICAL_METADATA_PUBLICATION_ELIGIBLE, actorId, metadata, { evidenceReference: input.evidenceReference });
    });
    return { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.PUBLICATION_ELIGIBLE, publicationEligible: true };
  }

  async reject(metadataId: string, actorId: string, input: GovernanceDecisionInput) { return this.close(metadataId, actorId, input, HistoricalMetadataGovernanceStatus.REJECTED, AuditEventType.HISTORICAL_METADATA_REJECTED); }
  async revoke(metadataId: string, actorId: string, input: GovernanceDecisionInput) { return this.close(metadataId, actorId, input, HistoricalMetadataGovernanceStatus.REVOKED, AuditEventType.HISTORICAL_METADATA_REVOKED, { revokedAt: new Date() }); }

  async supersede(metadataId: string, replacementId: string, actorId: string, input: GovernanceDecisionInput) {
    const current = await this.requireMetadata(metadataId);
    const replacement = await this.requireMetadata(replacementId);
    if (metadataId === replacementId || current.questionVersionId === replacement.questionVersionId) throw new BadRequestException('A record cannot supersede itself');
    this.requireEvidence(input);
    await this.database.$transaction(async (tx) => {
      const updated = await tx.historicalQuestionMetadata.updateMany({ where: { id: metadataId, governanceStatus: { notIn: [HistoricalMetadataGovernanceStatus.REVOKED, HistoricalMetadataGovernanceStatus.SUPERSEDED] } }, data: { governanceStatus: HistoricalMetadataGovernanceStatus.SUPERSEDED, publicationEligible: false } });
      if (updated.count !== 1) throw new ConflictException('Metadata was already revoked or superseded');
      await this.audit(tx, AuditEventType.HISTORICAL_METADATA_SUPERSEDED, actorId, current, { evidenceReference: input.evidenceReference, replacementId });
    });
    return { id: metadataId, governanceStatus: HistoricalMetadataGovernanceStatus.SUPERSEDED, replacementId };
  }

  async history(metadataId: string, actorId: string) {
    const account = await this.database.account.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!account || !([AccountRole.ADMIN, AccountRole.SME] as AccountRole[]).includes(account.role)) throw new ForbiddenException('Academic governance access required');
    const metadata = await this.requireMetadata(metadataId);
    const [approvals, audit] = await Promise.all([
      this.database.governanceApproval.findMany({ where: { targetHistoricalMetadataId: metadataId }, orderBy: { createdAt: 'asc' }, select: { approvalReference: true, type: true, status: true, reviewerId: true, reviewerRole: true, decisionAt: true, evidenceReference: true, scope: true, revokedAt: true, supersededAt: true } }),
      this.database.auditEvent.findMany({ where: { questionVersionId: metadata.questionVersionId }, orderBy: { createdAt: 'asc' }, select: { type: true, accountId: true, metadata: true, createdAt: true } }),
    ]);
    return { metadataId, approvals, audit };
  }

  private async decision(metadata: Awaited<ReturnType<HistoricalPyqGovernanceService['requireMetadata']>>, actorId: string, input: GovernanceDecisionInput, type: GovernanceApprovalType, expected: HistoricalMetadataGovernanceStatus, next: HistoricalMetadataGovernanceStatus, auditType: AuditEventType, extra: Record<string, unknown> = {}) {
    const existing = metadata.governanceApprovals.find((approval) => approval.type === type && approval.status === GovernanceApprovalStatus.APPROVED);
    if (metadata.governanceStatus === next && existing) return { id: metadata.id, governanceStatus: next, approvalReference: existing.approvalReference };
    if (metadata.governanceStatus !== expected) throw new ConflictException('Metadata governance state changed concurrently');
    const approvalReference = `PYQ-${metadata.id}-${Date.now()}-${actorId.slice(0, 8)}`;
    await this.database.$transaction(async (tx) => {
      const updated = await tx.historicalQuestionMetadata.updateMany({ where: { id: metadata.id, governanceStatus: expected, revokedAt: null }, data: { governanceStatus: next, ...extra } });
      if (updated.count !== 1) throw new ConflictException('Metadata governance state changed concurrently');
      await tx.governanceApproval.create({ data: { approvalReference, type, status: GovernanceApprovalStatus.APPROVED, targetHistoricalMetadataId: metadata.id, targetQuestionVersionId: metadata.questionVersionId, scope: { metadataId: metadata.id, examinationFamily: metadata.examinationFamily, subjectCode: metadata.subjectCode, ...(input.scope ?? {}), ...(input.sourceVerification ? { sourceVerification: input.sourceVerification } : {}) }, reviewerId: actorId, reviewerRole: (await tx.account.findUniqueOrThrow({ where: { id: actorId }, select: { role: true } })).role, decisionAt: new Date(), evidenceReference: input.evidenceReference } });
      await this.audit(tx, auditType, actorId, metadata, { approvalReference, evidenceReference: input.evidenceReference, notes: input.notes });
    });
    return { id: metadata.id, governanceStatus: next, approvalReference };
  }

  private async close(metadataId: string, actorId: string, input: GovernanceDecisionInput, status: HistoricalMetadataGovernanceStatus, auditType: AuditEventType, extra: Record<string, unknown> = {}) {
    const metadata = await this.requireMetadata(metadataId); this.requireEvidence(input);
    if (metadata.governanceStatus === status) return { id: metadataId, governanceStatus: status };
    await this.database.$transaction(async (tx) => { const updated = await tx.historicalQuestionMetadata.updateMany({ where: { id: metadataId, governanceStatus: { notIn: [HistoricalMetadataGovernanceStatus.REVOKED, HistoricalMetadataGovernanceStatus.SUPERSEDED] } }, data: { governanceStatus: status, publicationEligible: false, ...extra } }); if (updated.count !== 1) throw new ConflictException('Metadata governance state changed concurrently'); await this.audit(tx, auditType, actorId, metadata, { evidenceReference: input.evidenceReference, notes: input.notes }); });
    return { id: metadataId, governanceStatus: status };
  }

  private async requireMetadata(id: string) {
    const metadata = await this.database.historicalQuestionMetadata.findUnique({ where: { id }, include: { examCycle: { include: { examination: true } }, importRows: { include: { import: { select: { createdById: true } } } }, questionVersion: { include: { question: true, publication: true, answerKeys: true, explanations: true, mappings: true } }, governanceApprovals: { where: { status: GovernanceApprovalStatus.APPROVED }, orderBy: { createdAt: 'desc' } } } });
    if (!metadata) throw new NotFoundException('Historical metadata not found');
    return { ...metadata, importerId: metadata.importRows[0]?.import.createdById, academicReviewerId: metadata.governanceApprovals.find((item) => item.type === GovernanceApprovalType.HISTORICAL_METADATA_ACADEMIC_REVIEW)?.reviewerId, rightsReviewerId: metadata.governanceApprovals.find((item) => item.type === GovernanceApprovalType.HISTORICAL_METADATA_RIGHTS_VERIFICATION)?.reviewerId, approvalReviewerId: metadata.governanceApprovals.find((item) => item.type === GovernanceApprovalType.HISTORICAL_METADATA_PUBLICATION)?.reviewerId };
  }

  private rightsScope(value: Prisma.JsonValue | null) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Explicit rights scope is required'); const scope = value as { allowedUses?: unknown; languages?: unknown }; return { allowedUses: Array.isArray(scope.allowedUses) ? scope.allowedUses.map(String) : [], languages: Array.isArray(scope.languages) ? scope.languages.map(String) : [] }; }
  private inputScope(input: GovernanceDecisionInput['scope'] | undefined, fallback: Prisma.JsonValue | null) { return input?.allowedUses && input.languages ? { allowedUses: input.allowedUses, languages: input.languages } : this.rightsScope(fallback); }
  private replay(metadata: Awaited<ReturnType<HistoricalPyqGovernanceService['requireMetadata']>>, type: GovernanceApprovalType, status: HistoricalMetadataGovernanceStatus) { if (metadata.governanceStatus !== status) return undefined; const approval = metadata.governanceApprovals.find((item) => item.type === type && item.status === GovernanceApprovalStatus.APPROVED); return approval ? { id: metadata.id, governanceStatus: status, approvalReference: approval.approvalReference } : undefined; }
  private assertRights(status: RightsStatus, expiresAt: Date | null, scope: { allowedUses: string[]; languages: string[] }) { if (!CLEARED_RIGHTS.includes(status) || (expiresAt && expiresAt <= new Date()) || !scope.allowedUses.length || !scope.languages.length) throw new BadRequestException('Current explicit rights evidence and scope are required'); }
  private requireEvidence(input: GovernanceDecisionInput) { if (!input || typeof input.evidenceReference !== 'string' || !input.evidenceReference.trim() || input.evidenceReference.length > 5000) throw new BadRequestException('Decision evidence reference is required'); }
  private async audit(tx: Prisma.TransactionClient, type: AuditEventType, actorId: string, metadata: { questionVersionId: string; id: string }, event: Record<string, unknown>) { await tx.auditEvent.create({ data: { type, accountId: actorId, questionVersionId: metadata.questionVersionId, metadata: { historicalMetadataId: metadata.id, ...event } as Prisma.InputJsonValue } }); }
}
