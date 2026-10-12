-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('ASSIGNED', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RightsStatus" AS ENUM ('OWNED', 'LICENSED', 'PERMISSION_GRANTED', 'PUBLIC_DOMAIN', 'FAIR_USE_JUSTIFIED', 'RESTRICTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ChallengeCategory" AS ENUM ('INCORRECT_ANSWER_KEY', 'AMBIGUOUS_QUESTION', 'INCORRECT_EXPLANATION', 'TRANSLATION_ERROR', 'OUTDATED_FACTS', 'INCORRECT_SYLLABUS_MAPPING', 'COPYRIGHT_PROVENANCE', 'TECHNICAL_FORMATTING');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'DUPLICATE', 'QUARANTINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_SUBMITTED_FOR_REVIEW';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_REVIEW_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_REVIEWED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_PUBLISHED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_SUPERSEDED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_CHALLENGED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_CHALLENGE_RESOLVED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_TRANSLATION_REVIEWED';

-- AlterTable
ALTER TABLE "ContentProvenance" ADD COLUMN     "rightsStatus" "RightsStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "sourceType" VARCHAR(80) NOT NULL DEFAULT 'RESEARCH_REFERENCE';

-- AlterTable
ALTER TABLE "QuestionTranslation" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" UUID;

-- AlterTable
ALTER TABLE "QuestionVersion" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "QuestionReview" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "notes" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPublication" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "publishedById" UUID NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "contentHash" VARCHAR(128) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "QuestionPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionChallenge" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "category" "ChallengeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeHash" CHAR(64) NOT NULL,
    "resolutionNotes" TEXT,
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionReview_questionVersionId_createdAt_idx" ON "QuestionReview"("questionVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionReview_reviewerId_createdAt_idx" ON "QuestionReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPublication_questionVersionId_key" ON "QuestionPublication"("questionVersionId");

-- CreateIndex
CREATE INDEX "QuestionPublication_status_publishedAt_idx" ON "QuestionPublication"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionChallenge_dedupeHash_key" ON "QuestionChallenge"("dedupeHash");

-- CreateIndex
CREATE INDEX "QuestionChallenge_questionVersionId_status_idx" ON "QuestionChallenge"("questionVersionId", "status");

-- CreateIndex
CREATE INDEX "QuestionChallenge_reporterId_createdAt_idx" ON "QuestionChallenge"("reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionTranslation" ADD CONSTRAINT "QuestionTranslation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReview" ADD CONSTRAINT "QuestionReview_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReview" ADD CONSTRAINT "QuestionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPublication" ADD CONSTRAINT "QuestionPublication_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPublication" ADD CONSTRAINT "QuestionPublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionChallenge" ADD CONSTRAINT "QuestionChallenge_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionChallenge" ADD CONSTRAINT "QuestionChallenge_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionChallenge" ADD CONSTRAINT "QuestionChallenge_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
