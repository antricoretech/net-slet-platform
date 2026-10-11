-- Sprint 1 remediation: normalized cycle subjects and rule-engine configuration.
CREATE TYPE "DeliveryMode" AS ENUM ('CBT', 'OMR_SIMULATION');
CREATE TYPE "SessionTimingPolicy" AS ENUM ('CONTINUOUS', 'INDEPENDENT', 'SEQUENTIAL_LOCKED');
CREATE TYPE "AnswerPolicy" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT', 'EXACT_MATCH');

ALTER TABLE "PatternEvidence"
  ADD COLUMN "artifactReference" TEXT,
  ADD COLUMN "effectiveAt" TIMESTAMP(3),
  ADD COLUMN "evidenceExcerpt" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "issuingAuthority" VARCHAR(240) NOT NULL DEFAULT '',
  ADD COLUMN "officialDocumentTitle" VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN "questionBankCoverage" JSONB;

CREATE TABLE "ExamSubject" (
  "id" UUID NOT NULL,
  "examCycleId" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "status" "PatternStatus" NOT NULL DEFAULT 'RESEARCH_ONLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectPatternOverride" (
  "id" UUID NOT NULL,
  "patternVersionId" UUID NOT NULL,
  "subjectCode" VARCHAR(80) NOT NULL,
  "rules" JSONB NOT NULL,
  "ruleHash" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "examSubjectId" UUID,
  CONSTRAINT "SubjectPatternOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamSessionConfig" (
  "id" UUID NOT NULL,
  "patternVersionId" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "deliveryMode" "DeliveryMode" NOT NULL,
  "timingPolicy" "SessionTimingPolicy" NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "submitSeparately" BOOLEAN NOT NULL DEFAULT false,
  "allowReturn" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSessionConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamSectionConfig" (
  "id" UUID NOT NULL,
  "sessionConfigId" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "offeredQuestions" INTEGER NOT NULL,
  "maximumAttempts" INTEGER NOT NULL,
  "answerPolicy" "AnswerPolicy" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSectionConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScoringPolicy" (
  "id" UUID NOT NULL,
  "sectionConfigId" UUID NOT NULL,
  "marksCorrect" DECIMAL(10,4) NOT NULL,
  "marksWrong" DECIMAL(10,4) NOT NULL,
  "exactMatch" BOOLEAN NOT NULL DEFAULT false,
  "allowMultipleCorrect" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoringPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LanguagePolicy" (
  "id" UUID NOT NULL,
  "patternVersionId" UUID NOT NULL,
  "languageCode" VARCHAR(20) NOT NULL,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LanguagePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamRuleSource" (
  "id" UUID NOT NULL,
  "patternVersionId" UUID NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "issuingAuthority" VARCHAR(240) NOT NULL,
  "cycleCode" VARCHAR(60) NOT NULL,
  "publicationDate" TIMESTAMP(3),
  "effectiveDate" TIMESTAMP(3),
  "sourceUrl" TEXT NOT NULL,
  "evidenceExcerpt" TEXT NOT NULL,
  "documentHash" VARCHAR(128) NOT NULL,
  "artifactReference" TEXT,
  "rightsNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamRuleSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamSubject_examCycleId_code_key" ON "ExamSubject"("examCycleId", "code");
CREATE INDEX "ExamSubject_status_idx" ON "ExamSubject"("status");
CREATE UNIQUE INDEX "SubjectPatternOverride_patternVersionId_subjectCode_key" ON "SubjectPatternOverride"("patternVersionId", "subjectCode");
CREATE INDEX "SubjectPatternOverride_subjectCode_idx" ON "SubjectPatternOverride"("subjectCode");
CREATE UNIQUE INDEX "ExamSessionConfig_patternVersionId_key_key" ON "ExamSessionConfig"("patternVersionId", "key");
CREATE INDEX "ExamSessionConfig_patternVersionId_sequence_idx" ON "ExamSessionConfig"("patternVersionId", "sequence");
CREATE UNIQUE INDEX "ExamSectionConfig_sessionConfigId_key_key" ON "ExamSectionConfig"("sessionConfigId", "key");
CREATE UNIQUE INDEX "ScoringPolicy_sectionConfigId_key" ON "ScoringPolicy"("sectionConfigId");
CREATE UNIQUE INDEX "LanguagePolicy_patternVersionId_languageCode_key" ON "LanguagePolicy"("patternVersionId", "languageCode");
CREATE INDEX "ExamRuleSource_patternVersionId_idx" ON "ExamRuleSource"("patternVersionId");

ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectPatternOverride" ADD CONSTRAINT "SubjectPatternOverride_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectPatternOverride" ADD CONSTRAINT "SubjectPatternOverride_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamSessionConfig" ADD CONSTRAINT "ExamSessionConfig_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSectionConfig" ADD CONSTRAINT "ExamSectionConfig_sessionConfigId_fkey" FOREIGN KEY ("sessionConfigId") REFERENCES "ExamSessionConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringPolicy" ADD CONSTRAINT "ScoringPolicy_sectionConfigId_fkey" FOREIGN KEY ("sectionConfigId") REFERENCES "ExamSectionConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LanguagePolicy" ADD CONSTRAINT "LanguagePolicy_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRuleSource" ADD CONSTRAINT "ExamRuleSource_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES "ExamPatternVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_published_pattern_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'Superseded pattern versions are immutable';
  END IF;
  IF OLD.status = 'PUBLISHED' AND NOT (
    NEW.status = 'SUPERSEDED'
    AND NEW.id = OLD.id
    AND NEW.examCycleId = OLD.examCycleId
    AND NEW.subjectCode = OLD.subjectCode
    AND NEW.version = OLD.version
    AND NEW.rules = OLD.rules
    AND NEW.publishedSnapshot = OLD.publishedSnapshot
    AND NEW.ruleHash = OLD.ruleHash
    AND NEW.publishedAt = OLD.publishedAt
  ) THEN
    RAISE EXCEPTION 'Published pattern versions are immutable';
  END IF;
  IF NEW.status = 'PUBLISHED' AND NEW.publishedSnapshot IS NULL THEN
    RAISE EXCEPTION 'Published pattern versions require a snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER exam_pattern_version_immutability
  BEFORE UPDATE ON "ExamPatternVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_mutation();
