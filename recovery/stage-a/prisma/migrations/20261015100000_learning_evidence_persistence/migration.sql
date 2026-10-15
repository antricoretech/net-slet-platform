-- CreateTable
CREATE TABLE "LearningEvidence" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "sourceEventId" VARCHAR(160) NOT NULL,
    "outcome" VARCHAR(24) NOT NULL,
    "topicIds" JSONB NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "reasonCodes" JSONB NOT NULL,
    "evidenceHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MistakeMineEntry" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "learningEvidenceId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "reason" VARCHAR(80) NOT NULL,
    "topicIds" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MistakeMineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningTopicPerformance" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unattemptedCount" INTEGER NOT NULL DEFAULT 0,
    "latestAttemptId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningTopicPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRecommendation" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "recommendation" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sourceEvidenceIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningEvidence_accountId_createdAt_idx" ON "LearningEvidence"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningEvidence_accountId_outcome_createdAt_idx" ON "LearningEvidence"("accountId", "outcome", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvidence_attemptId_sourceEventId_key" ON "LearningEvidence"("attemptId", "sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MistakeMineEntry_learningEvidenceId_key" ON "MistakeMineEntry"("learningEvidenceId");

-- CreateIndex
CREATE INDEX "MistakeMineEntry_accountId_status_updatedAt_idx" ON "MistakeMineEntry"("accountId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MistakeMineEntry_attemptId_idx" ON "MistakeMineEntry"("attemptId");

-- CreateIndex
CREATE INDEX "LearningTopicPerformance_accountId_updatedAt_idx" ON "LearningTopicPerformance"("accountId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningTopicPerformance_accountId_topicId_key" ON "LearningTopicPerformance"("accountId", "topicId");

-- CreateIndex
CREATE INDEX "LearningRecommendation_accountId_priority_updatedAt_idx" ON "LearningRecommendation"("accountId", "priority", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningRecommendation_accountId_attemptId_key_reason_key" ON "LearningRecommendation"("accountId", "attemptId", "key", "reason");

-- AddForeignKey
ALTER TABLE "LearningEvidence" ADD CONSTRAINT "LearningEvidence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvidence" ADD CONSTRAINT "LearningEvidence_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvidence" ADD CONSTRAINT "LearningEvidence_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeMineEntry" ADD CONSTRAINT "MistakeMineEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeMineEntry" ADD CONSTRAINT "MistakeMineEntry_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeMineEntry" ADD CONSTRAINT "MistakeMineEntry_learningEvidenceId_fkey" FOREIGN KEY ("learningEvidenceId") REFERENCES "LearningEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeMineEntry" ADD CONSTRAINT "MistakeMineEntry_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningTopicPerformance" ADD CONSTRAINT "LearningTopicPerformance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecommendation" ADD CONSTRAINT "LearningRecommendation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecommendation" ADD CONSTRAINT "LearningRecommendation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
