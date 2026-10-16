ALTER TYPE "AuditEventType" ADD VALUE 'ANSWER_KEY_CORRECTION_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'RESULT_RESCORED';

ALTER TABLE "AttemptResult"
  ADD COLUMN "releasedById" UUID,
  ADD COLUMN "releaseApprovalReference" VARCHAR(160),
  ADD COLUMN "releaseReason" TEXT;

CREATE INDEX "AttemptResult_releasedById_idx" ON "AttemptResult"("releasedById");
ALTER TABLE "AttemptResult"
  ADD CONSTRAINT "AttemptResult_releasedById_fkey"
  FOREIGN KEY ("releasedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AnswerKeyCorrection" (
  "id" UUID NOT NULL,
  "questionVersionId" UUID NOT NULL,
  "originalAnswerKeyVersionId" UUID NOT NULL,
  "revisedAnswerKeyVersionId" UUID NOT NULL,
  "authorizedById" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "approvalReference" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnswerKeyCorrection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnswerKeyCorrection_revisedAnswerKeyVersionId_key" ON "AnswerKeyCorrection"("revisedAnswerKeyVersionId");
CREATE UNIQUE INDEX "AnswerKeyCorrection_approvalReference_key" ON "AnswerKeyCorrection"("approvalReference");
CREATE INDEX "AnswerKeyCorrection_questionVersionId_createdAt_idx" ON "AnswerKeyCorrection"("questionVersionId", "createdAt");
ALTER TABLE "AnswerKeyCorrection"
  ADD CONSTRAINT "AnswerKeyCorrection_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AnswerKeyCorrection_originalAnswerKeyVersionId_fkey" FOREIGN KEY ("originalAnswerKeyVersionId") REFERENCES "QuestionAnswerKeyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AnswerKeyCorrection_revisedAnswerKeyVersionId_fkey" FOREIGN KEY ("revisedAnswerKeyVersionId") REFERENCES "QuestionAnswerKeyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AnswerKeyCorrection_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ScoreRunLineage" (
  "id" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "originalScoreRunId" UUID NOT NULL,
  "revisedScoreRunId" UUID NOT NULL,
  "originalAnswerKeyReferences" JSONB NOT NULL,
  "revisedAnswerKeyReferences" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "approvalReference" VARCHAR(160) NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "authorizedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreRunLineage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScoreRunLineage_revisedScoreRunId_key" ON "ScoreRunLineage"("revisedScoreRunId");
CREATE UNIQUE INDEX "ScoreRunLineage_idempotencyKey_key" ON "ScoreRunLineage"("idempotencyKey");
CREATE UNIQUE INDEX "ScoreRunLineage_attemptId_originalScoreRunId_key" ON "ScoreRunLineage"("attemptId", "originalScoreRunId");
CREATE INDEX "ScoreRunLineage_attemptId_createdAt_idx" ON "ScoreRunLineage"("attemptId", "createdAt");
ALTER TABLE "ScoreRunLineage"
  ADD CONSTRAINT "ScoreRunLineage_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScoreRunLineage_originalScoreRunId_fkey" FOREIGN KEY ("originalScoreRunId") REFERENCES "ScoreRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScoreRunLineage_revisedScoreRunId_fkey" FOREIGN KEY ("revisedScoreRunId") REFERENCES "ScoreRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScoreRunLineage_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
