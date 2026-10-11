-- Sprint 1C: subject-scoped pattern evidence, approvals and publication snapshots.
CREATE TYPE "PatternApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

ALTER TYPE "AuditEventType" ADD VALUE 'PATTERN_DRAFT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATTERN_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATTERN_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATTERN_PUBLISHED';
ALTER TYPE "AuditEventType" ADD VALUE 'PATTERN_SUPERSEDED';

DROP INDEX "ExamPatternVersion_examCycleId_version_key";

ALTER TABLE "AuditEvent" ADD COLUMN "patternVersionId" UUID;
ALTER TABLE "ExamPatternVersion" ADD COLUMN "publishedAt" TIMESTAMP(3), ADD COLUMN "publishedSnapshot" JSONB, ADD COLUMN "subjectCode" VARCHAR(80) NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "PatternEvidence" (
    "id" UUID NOT NULL,
    "patternVersionId" UUID NOT NULL,
    "officialSourceUrl" TEXT NOT NULL,
    "sourceDocumentHash" VARCHAR(128) NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "regressionReportId" VARCHAR(160) NOT NULL,
    "submittedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatternEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatternApproval" (
    "id" UUID NOT NULL,
    "patternVersionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "PatternApprovalDecision" NOT NULL,
    "notes" TEXT,
    "ruleHash" VARCHAR(128) NOT NULL,
    "regressionReportId" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatternApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatternEvidence_patternVersionId_key" ON "PatternEvidence"("patternVersionId");
CREATE INDEX "PatternApproval_patternVersionId_createdAt_idx" ON "PatternApproval"("patternVersionId", "createdAt");
CREATE INDEX "PatternApproval_reviewerId_createdAt_idx" ON "PatternApproval"("reviewerId", "createdAt");
CREATE INDEX "AuditEvent_patternVersionId_createdAt_idx" ON "AuditEvent"("patternVersionId", "createdAt");
CREATE INDEX "ExamPatternVersion_examCycleId_subjectCode_status_idx" ON "ExamPatternVersion"("examCycleId", "subjectCode", "status");
CREATE UNIQUE INDEX "ExamPatternVersion_examCycleId_subjectCode_version_key" ON "ExamPatternVersion"("examCycleId", "subjectCode", "version");

ALTER TABLE "PatternEvidence" ADD CONSTRAINT "PatternEvidence_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatternEvidence" ADD CONSTRAINT "PatternEvidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatternApproval" ADD CONSTRAINT "PatternApproval_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatternApproval" ADD CONSTRAINT "PatternApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
