-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT', 'SUBMITTED_FOR_REVIEW', 'SME_REVIEWED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'SYLLABUS_VERSION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SYLLABUS_TAXONOMY_UPDATED';

-- AlterTable
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SyllabusVersion" (
    "id" UUID NOT NULL,
    "examCycleId" UUID NOT NULL,
    "subjectCode" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectUnit" (
    "id" UUID NOT NULL,
    "syllabusVersionId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" UUID NOT NULL,
    "subjectUnitId" UUID NOT NULL,
    "parentId" UUID,
    "code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyllabusVersion_examCycleId_subjectCode_status_idx" ON "SyllabusVersion"("examCycleId", "subjectCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_examCycleId_subjectCode_version_key" ON "SyllabusVersion"("examCycleId", "subjectCode", "version");

-- CreateIndex
CREATE INDEX "SubjectUnit_syllabusVersionId_sequence_idx" ON "SubjectUnit"("syllabusVersionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectUnit_syllabusVersionId_code_key" ON "SubjectUnit"("syllabusVersionId", "code");

-- CreateIndex
CREATE INDEX "SyllabusTopic_subjectUnitId_sequence_idx" ON "SyllabusTopic"("subjectUnitId", "sequence");

-- CreateIndex
CREATE INDEX "SyllabusTopic_parentId_idx" ON "SyllabusTopic"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopic_subjectUnitId_code_key" ON "SyllabusTopic"("subjectUnitId", "code");

-- AddForeignKey
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusVersion" ADD CONSTRAINT "SyllabusVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectUnit" ADD CONSTRAINT "SubjectUnit_syllabusVersionId_fkey" FOREIGN KEY ("syllabusVersionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_subjectUnitId_fkey" FOREIGN KEY ("subjectUnitId") REFERENCES "SubjectUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
