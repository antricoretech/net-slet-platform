/*
  Warnings:

  - Added the required column `organizerId` to the `Examination` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('NATIONAL', 'STATE', 'UNION_TERRITORY', 'REGIONAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'CATALOGUE_EXAM_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CATALOGUE_EXAM_UPDATED';

-- AlterTable
ALTER TABLE "Examination" ADD COLUMN     "organizerId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "ExamOrganizer" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "officialWebsite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamOrganizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "JurisdictionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationJurisdiction" (
    "examinationId" UUID NOT NULL,
    "jurisdictionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationJurisdiction_pkey" PRIMARY KEY ("examinationId","jurisdictionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamOrganizer_code_key" ON "ExamOrganizer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_code_key" ON "Jurisdiction"("code");

-- CreateIndex
CREATE INDEX "ExaminationJurisdiction_jurisdictionId_idx" ON "ExaminationJurisdiction"("jurisdictionId");

-- CreateIndex
CREATE INDEX "Examination_family_idx" ON "Examination"("family");

-- CreateIndex
CREATE INDEX "Examination_organizerId_idx" ON "Examination"("organizerId");

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "ExamOrganizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationJurisdiction" ADD CONSTRAINT "ExaminationJurisdiction_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationJurisdiction" ADD CONSTRAINT "ExaminationJurisdiction_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
