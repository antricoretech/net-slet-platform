-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'ASSERTION_REASON', 'MATCHING', 'ORDERING', 'READING_COMPREHENSION', 'DATA_INTERPRETATION', 'MATHEMATICAL');

-- CreateEnum
CREATE TYPE "QuestionVersionStatus" AS ENUM ('DRAFT', 'SUBMITTED_FOR_REVIEW', 'SME_REVIEWED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuestionGroupType" AS ENUM ('READING_COMPREHENSION', 'DATA_INTERPRETATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_DRAFT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_REVISION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_DRAFT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_OPTION_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_ANSWER_KEY_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_EXPLANATION_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_SYLLABUS_MAPPED';
ALTER TYPE "AuditEventType" ADD VALUE 'QUESTION_PROVENANCE_UPDATED';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "questionId" UUID,
ADD COLUMN     "questionVersionId" UUID;

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "examCycleId" UUID NOT NULL,
    "subjectCode" VARCHAR(80) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuestionVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "QuestionType" NOT NULL,
    "languageCode" VARCHAR(20) NOT NULL DEFAULT 'en',
    "prompt" JSONB NOT NULL,
    "groupId" UUID,
    "authoredById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "optionKey" VARCHAR(32) NOT NULL,
    "optionText" JSONB NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswerKeyVersion" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "correctAnswers" JSONB NOT NULL,
    "exactMatch" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAnswerKeyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionExplanationVersion" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "languageCode" VARCHAR(20) NOT NULL DEFAULT 'en',
    "explanation" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionExplanationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionRationale" (
    "id" UUID NOT NULL,
    "explanationId" UUID NOT NULL,
    "optionKey" VARCHAR(32) NOT NULL,
    "rationale" JSONB NOT NULL,

    CONSTRAINT "OptionRationale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" UUID NOT NULL,
    "examCycleId" UUID NOT NULL,
    "subjectCode" VARCHAR(80) NOT NULL,
    "type" "QuestionGroupType" NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "stimulus" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSyllabusMapping" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "syllabusTopicId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSyllabusMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTranslation" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "languageCode" VARCHAR(20) NOT NULL,
    "prompt" JSONB NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentProvenance" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "sourceTitle" VARCHAR(300) NOT NULL,
    "sourceUrl" TEXT,
    "sourceReference" TEXT,
    "sourceHash" VARCHAR(128),
    "rightsNote" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLicence" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "licenceName" VARCHAR(200) NOT NULL,
    "licenceReference" TEXT,
    "restrictions" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentLicence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_examCycleId_subjectCode_idx" ON "Question"("examCycleId", "subjectCode");

-- CreateIndex
CREATE INDEX "QuestionVersion_status_type_idx" ON "QuestionVersion"("status", "type");

-- CreateIndex
CREATE INDEX "QuestionVersion_groupId_idx" ON "QuestionVersion"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionVersionId_optionKey_key" ON "QuestionOption"("questionVersionId", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionVersionId_sequence_key" ON "QuestionOption"("questionVersionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswerKeyVersion_questionVersionId_version_key" ON "QuestionAnswerKeyVersion"("questionVersionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionExplanationVersion_questionVersionId_version_langua_key" ON "QuestionExplanationVersion"("questionVersionId", "version", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "OptionRationale_explanationId_optionKey_key" ON "OptionRationale"("explanationId", "optionKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSyllabusMapping_questionVersionId_syllabusTopicId_key" ON "QuestionSyllabusMapping"("questionVersionId", "syllabusTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTranslation_questionVersionId_languageCode_key" ON "QuestionTranslation"("questionVersionId", "languageCode");

-- CreateIndex
CREATE INDEX "AuditEvent_questionId_createdAt_idx" ON "AuditEvent"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_questionVersionId_createdAt_idx" ON "AuditEvent"("questionVersionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerKeyVersion" ADD CONSTRAINT "QuestionAnswerKeyVersion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerKeyVersion" ADD CONSTRAINT "QuestionAnswerKeyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanationVersion" ADD CONSTRAINT "QuestionExplanationVersion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionExplanationVersion" ADD CONSTRAINT "QuestionExplanationVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionRationale" ADD CONSTRAINT "OptionRationale_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "QuestionExplanationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSyllabusMapping" ADD CONSTRAINT "QuestionSyllabusMapping_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSyllabusMapping" ADD CONSTRAINT "QuestionSyllabusMapping_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTranslation" ADD CONSTRAINT "QuestionTranslation_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTranslation" ADD CONSTRAINT "QuestionTranslation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicence" ADD CONSTRAINT "ContentLicence_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLicence" ADD CONSTRAINT "ContentLicence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_published_question_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published question revisions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER question_revision_immutability
BEFORE UPDATE ON "QuestionVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_published_question_revision_mutation();

CREATE OR REPLACE FUNCTION prevent_published_question_revision_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published question revisions are immutable';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER question_revision_delete_immutability
BEFORE DELETE ON "QuestionVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_published_question_revision_delete();
