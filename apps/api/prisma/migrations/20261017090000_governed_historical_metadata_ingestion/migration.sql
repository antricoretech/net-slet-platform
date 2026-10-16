-- Sprint 8: governed ingestion and explicit rights authorization.
CREATE TYPE "HistoricalMetadataRecordStatus" AS ENUM ('IMPORTED', 'VALIDATED', 'VERIFIED', 'REJECTED', 'DUPLICATE');
CREATE TYPE "HistoricalMetadataImportStatus" AS ENUM ('DRY_RUN', 'VALIDATED', 'COMMITTED', 'PARTIAL_REJECTED');
CREATE TYPE "HistoricalMetadataImportRowStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'DUPLICATE');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_IMPORT_DRY_RUN';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_IMPORT_COMMITTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_IMPORT_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HISTORICAL_METADATA_VERIFIED';

ALTER TABLE "HistoricalQuestionMetadata"
  ADD COLUMN "recordStatus" "HistoricalMetadataRecordStatus" NOT NULL DEFAULT 'IMPORTED',
  ADD COLUMN "rightsEvidenceReference" TEXT,
  ADD COLUMN "rightsExpiresAt" TIMESTAMP(3),
  ADD COLUMN "rightsLicenceId" UUID,
  ADD COLUMN "metadataFingerprint" CHAR(64);

CREATE UNIQUE INDEX "HistoricalQuestionMetadata_metadataFingerprint_key" ON "HistoricalQuestionMetadata"("metadataFingerprint");
CREATE INDEX "HistoricalQuestionMetadata_recordStatus_idx" ON "HistoricalQuestionMetadata"("recordStatus");
ALTER TABLE "HistoricalQuestionMetadata" ADD CONSTRAINT "HistoricalQuestionMetadata_rightsLicenceId_fkey" FOREIGN KEY ("rightsLicenceId") REFERENCES "ContentLicence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HistoricalMetadataImport" (
  "id" UUID NOT NULL,
  "manifestHash" CHAR(64) NOT NULL,
  "sourceName" VARCHAR(240) NOT NULL,
  "sourceChecksum" CHAR(64) NOT NULL,
  "format" VARCHAR(16) NOT NULL,
  "status" "HistoricalMetadataImportStatus" NOT NULL DEFAULT 'DRY_RUN',
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3),
  CONSTRAINT "HistoricalMetadataImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalMetadataImport_manifestHash_key" ON "HistoricalMetadataImport"("manifestHash");
CREATE INDEX "HistoricalMetadataImport_createdById_createdAt_idx" ON "HistoricalMetadataImport"("createdById", "createdAt");
ALTER TABLE "HistoricalMetadataImport" ADD CONSTRAINT "HistoricalMetadataImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HistoricalMetadataImportRow" (
  "id" UUID NOT NULL,
  "importId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "questionVersionId" UUID,
  "metadataId" UUID,
  "fingerprint" CHAR(64),
  "payload" JSONB NOT NULL,
  "status" "HistoricalMetadataImportRowStatus" NOT NULL DEFAULT 'REJECTED',
  "rejectionReasons" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalMetadataImportRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalMetadataImportRow_importId_rowNumber_key" ON "HistoricalMetadataImportRow"("importId", "rowNumber");
CREATE INDEX "HistoricalMetadataImportRow_questionVersionId_idx" ON "HistoricalMetadataImportRow"("questionVersionId");
CREATE INDEX "HistoricalMetadataImportRow_metadataId_idx" ON "HistoricalMetadataImportRow"("metadataId");
ALTER TABLE "HistoricalMetadataImportRow" ADD CONSTRAINT "HistoricalMetadataImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HistoricalMetadataImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricalMetadataImportRow" ADD CONSTRAINT "HistoricalMetadataImportRow_metadataId_fkey" FOREIGN KEY ("metadataId") REFERENCES "HistoricalQuestionMetadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;
