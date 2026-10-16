-- Sprint 9: governed academic verification and publication eligibility.
CREATE TYPE "HistoricalMetadataGovernanceStatus" AS ENUM ('IMPORTED', 'VALIDATED', 'ACADEMICALLY_REVIEWED', 'RIGHTS_VERIFIED', 'APPROVED', 'PUBLICATION_ELIGIBLE', 'REJECTED', 'REVOKED', 'SUPERSEDED');

ALTER TYPE "GovernanceApprovalType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_ACADEMIC_REVIEW';
ALTER TYPE "GovernanceApprovalType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_RIGHTS_VERIFICATION';
ALTER TYPE "GovernanceApprovalType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_PUBLICATION';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_VALIDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_ACADEMICALLY_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_RIGHTS_VERIFIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_PUBLICATION_ELIGIBLE';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_SUPERSEDED';

ALTER TABLE "HistoricalQuestionMetadata"
  ADD COLUMN "governanceStatus" "HistoricalMetadataGovernanceStatus" NOT NULL DEFAULT 'IMPORTED';
CREATE INDEX "HistoricalQuestionMetadata_governanceStatus_updatedAt_idx" ON "HistoricalQuestionMetadata"("governanceStatus", "updatedAt");

ALTER TABLE "GovernanceApproval"
  ADD COLUMN "targetHistoricalMetadataId" UUID;
CREATE INDEX "GovernanceApproval_targetHistoricalMetadataId_type_status_idx" ON "GovernanceApproval"("targetHistoricalMetadataId", "type", "status");
CREATE UNIQUE INDEX "GovernanceApproval_targetHistoricalMetadataId_type_status_key" ON "GovernanceApproval"("targetHistoricalMetadataId", "type", "status");
ALTER TABLE "GovernanceApproval" ADD CONSTRAINT "GovernanceApproval_targetHistoricalMetadataId_fkey" FOREIGN KEY ("targetHistoricalMetadataId") REFERENCES "HistoricalQuestionMetadata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
