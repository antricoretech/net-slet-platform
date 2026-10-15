-- CreateEnum
CREATE TYPE "TestFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'READY', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttemptSessionStatus" AS ENUM ('LOCKED', 'READY', 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ResultReleaseStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'ATTEMPT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'ATTEMPT_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE 'ANSWER_SAVED';
ALTER TYPE "AuditEventType" ADD VALUE 'SESSION_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'ATTEMPT_SUBMITTED';
ALTER TYPE "AuditEventType" ADD VALUE 'ATTEMPT_EXPIRED';
ALTER TYPE "AuditEventType" ADD VALUE 'SCORE_RUN_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'RESULT_RELEASED';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "attemptId" UUID;

-- CreateTable
CREATE TABLE "TestForm" (
    "id" UUID NOT NULL,
    "examCycleId" UUID NOT NULL,
    "patternVersionId" UUID NOT NULL,
    "subjectCode" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TestFormStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "snapshotHash" CHAR(64) NOT NULL,
    "createdById" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestFormQuestion" (
    "id" UUID NOT NULL,
    "testFormId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "sessionKey" VARCHAR(80) NOT NULL,
    "sectionKey" VARCHAR(80) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestFormQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "testFormId" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startIdempotencyKey" VARCHAR(160) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptSession" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "AttemptSessionStatus" NOT NULL DEFAULT 'READY',
    "timingPolicy" "SessionTimingPolicy" NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttemptSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "selectedOptionIds" JSONB NOT NULL,
    "markedForReview" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastIdempotencyKey" VARCHAR(160),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswerEvent" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "selectedOptionIds" JSONB NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptAnswerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptSubmissionEvent" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "eventType" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptSubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptCommand" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "attemptId" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreRun" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "scoreRunHash" VARCHAR(128) NOT NULL,
    "policyId" VARCHAR(160) NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "inputSnapshotHash" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptResult" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "scoreRunId" UUID,
    "status" "ResultReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttemptResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultExplanation" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "selectedOptionIds" JSONB NOT NULL,
    "explanation" JSONB,
    "topicIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestForm_status_publishedAt_idx" ON "TestForm"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "TestForm_patternVersionId_idx" ON "TestForm"("patternVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestForm_examCycleId_subjectCode_version_key" ON "TestForm"("examCycleId", "subjectCode", "version");

-- CreateIndex
CREATE INDEX "TestFormQuestion_testFormId_sessionKey_sectionKey_sequence_idx" ON "TestFormQuestion"("testFormId", "sessionKey", "sectionKey", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TestFormQuestion_testFormId_questionVersionId_key" ON "TestFormQuestion"("testFormId", "questionVersionId");

-- CreateIndex
CREATE INDEX "Attempt_accountId_status_createdAt_idx" ON "Attempt"("accountId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_accountId_startIdempotencyKey_key" ON "Attempt"("accountId", "startIdempotencyKey");

-- CreateIndex
CREATE INDEX "AttemptSession_attemptId_status_idx" ON "AttemptSession"("attemptId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptSession_attemptId_key_key" ON "AttemptSession"("attemptId", "key");

-- CreateIndex
CREATE INDEX "AttemptAnswer_attemptId_updatedAt_idx" ON "AttemptAnswer"("attemptId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionVersionId_key" ON "AttemptAnswer"("attemptId", "questionVersionId");

-- CreateIndex
CREATE INDEX "AttemptAnswerEvent_attemptId_sequence_idx" ON "AttemptAnswerEvent"("attemptId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswerEvent_attemptId_idempotencyKey_key" ON "AttemptAnswerEvent"("attemptId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AttemptSubmissionEvent_attemptId_createdAt_idx" ON "AttemptSubmissionEvent"("attemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptSubmissionEvent_attemptId_idempotencyKey_key" ON "AttemptSubmissionEvent"("attemptId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AttemptCommand_attemptId_createdAt_idx" ON "AttemptCommand"("attemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptCommand_accountId_kind_idempotencyKey_key" ON "AttemptCommand"("accountId", "kind", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRun_attemptId_runNumber_key" ON "ScoreRun"("attemptId", "runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreRun_attemptId_scoreRunHash_key" ON "ScoreRun"("attemptId", "scoreRunHash");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptResult_attemptId_key" ON "AttemptResult"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptResult_scoreRunId_key" ON "AttemptResult"("scoreRunId");

-- CreateIndex
CREATE INDEX "ResultExplanation_attemptId_idx" ON "ResultExplanation"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultExplanation_attemptId_questionVersionId_key" ON "ResultExplanation"("attemptId", "questionVersionId");

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestForm" ADD CONSTRAINT "TestForm_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestForm" ADD CONSTRAINT "TestForm_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestForm" ADD CONSTRAINT "TestForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestFormQuestion" ADD CONSTRAINT "TestFormQuestion_testFormId_fkey" FOREIGN KEY ("testFormId") REFERENCES "TestForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestFormQuestion" ADD CONSTRAINT "TestFormQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_testFormId_fkey" FOREIGN KEY ("testFormId") REFERENCES "TestForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptSession" ADD CONSTRAINT "AttemptSession_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswerEvent" ADD CONSTRAINT "AttemptAnswerEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswerEvent" ADD CONSTRAINT "AttemptAnswerEvent_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptSubmissionEvent" ADD CONSTRAINT "AttemptSubmissionEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptCommand" ADD CONSTRAINT "AttemptCommand_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptCommand" ADD CONSTRAINT "AttemptCommand_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptResult" ADD CONSTRAINT "AttemptResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptResult" ADD CONSTRAINT "AttemptResult_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultExplanation" ADD CONSTRAINT "ResultExplanation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultExplanation" ADD CONSTRAINT "ResultExplanation_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
