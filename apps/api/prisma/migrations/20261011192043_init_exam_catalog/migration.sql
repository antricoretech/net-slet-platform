-- CreateEnum
CREATE TYPE "ExamFamilyCode" AS ENUM ('UGC_NET', 'CSIR_NET', 'STATE_SET_SLET');

-- CreateEnum
CREATE TYPE "PatternStatus" AS ENUM ('RESEARCH_ONLY', 'DISCOVERED', 'RESEARCHED', 'DRAFT', 'SME_REVIEWED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "Examination" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "family" "ExamFamilyCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamCycle" (
    "id" UUID NOT NULL,
    "examinationId" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPatternVersion" (
    "id" UUID NOT NULL,
    "examCycleId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PatternStatus" NOT NULL DEFAULT 'RESEARCH_ONLY',
    "sourceUrl" TEXT,
    "reviewedBy" VARCHAR(120),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "ruleHash" VARCHAR(128),
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPatternVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Examination_code_key" ON "Examination"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCycle_examinationId_code_key" ON "ExamCycle"("examinationId", "code");

-- CreateIndex
CREATE INDEX "ExamPatternVersion_status_idx" ON "ExamPatternVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPatternVersion_examCycleId_version_key" ON "ExamPatternVersion"("examCycleId", "version");

-- AddForeignKey
ALTER TABLE "ExamCycle" ADD CONSTRAINT "ExamCycle_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPatternVersion" ADD CONSTRAINT "ExamPatternVersion_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
