-- Sprint 7: authoritative historical PYQ metadata. Legacy questions remain
-- discoverable only when an explicit verified metadata row exists.
CREATE TYPE "HistoricalMetadataVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

CREATE TABLE "HistoricalQuestionMetadata" (
  "id" UUID NOT NULL,
  "questionVersionId" UUID NOT NULL,
  "examCycleId" UUID NOT NULL,
  "examinationFamily" "ExamFamilyCode" NOT NULL,
  "authority" VARCHAR(200) NOT NULL,
  "sourceYear" INTEGER,
  "historicalCycle" VARCHAR(80),
  "session" VARCHAR(80),
  "paper" VARCHAR(80),
  "subjectCode" VARCHAR(80) NOT NULL,
  "questionPaperReference" TEXT,
  "questionSequence" INTEGER,
  "languageCode" VARCHAR(20),
  "sourceReference" TEXT,
  "sourceChecksum" VARCHAR(128),
  "answerKeyProvenance" TEXT,
  "rightsStatus" "RightsStatus" NOT NULL DEFAULT 'UNKNOWN',
  "rightsScope" JSONB,
  "publicationEligible" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "HistoricalMetadataVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HistoricalQuestionMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HistoricalQuestionMetadata_questionVersionId_key" ON "HistoricalQuestionMetadata"("questionVersionId");
CREATE INDEX "HistoricalQuestionMetadata_examCycleId_sourceYear_session_paper_subjectCode_languageCode_idx" ON "HistoricalQuestionMetadata"("examCycleId", "sourceYear", "session", "paper", "subjectCode", "languageCode");
CREATE INDEX "HistoricalQuestionMetadata_verificationStatus_publicationEligible_rightsStatus_idx" ON "HistoricalQuestionMetadata"("verificationStatus", "publicationEligible", "rightsStatus");
ALTER TABLE "HistoricalQuestionMetadata" ADD CONSTRAINT "HistoricalQuestionMetadata_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricalQuestionMetadata" ADD CONSTRAINT "HistoricalQuestionMetadata_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
