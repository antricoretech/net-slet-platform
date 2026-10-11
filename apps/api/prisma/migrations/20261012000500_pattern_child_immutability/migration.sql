-- Protect published pattern configuration and evidence from direct ORM mutation.
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
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.sourceUrl IS NOT DISTINCT FROM OLD.sourceUrl
    AND NEW.reviewedBy IS NOT DISTINCT FROM OLD.reviewedBy
    AND NEW.reviewedAt IS NOT DISTINCT FROM OLD.reviewedAt
    AND NEW.approvedAt IS NOT DISTINCT FROM OLD.approvedAt
    AND NEW.publishedAt IS NOT DISTINCT FROM OLD.publishedAt
    AND NEW.ruleHash IS NOT DISTINCT FROM OLD.ruleHash
    AND NEW.rules IS NOT DISTINCT FROM OLD.rules
    AND NEW.publishedSnapshot IS NOT DISTINCT FROM OLD.publishedSnapshot
    AND NEW.createdAt IS NOT DISTINCT FROM OLD.createdAt
  ) THEN
    RAISE EXCEPTION 'Published pattern versions are immutable';
  END IF;
  IF NEW.status = 'PUBLISHED' AND NEW.publishedSnapshot IS NULL THEN
    RAISE EXCEPTION 'Published pattern versions require a snapshot';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pattern_version_for_child(child_pattern_id UUID) RETURNS UUID AS $$
BEGIN
  RETURN child_pattern_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_published_pattern_child_mutation() RETURNS trigger AS $$
DECLARE
  pattern_id UUID;
  child_session UUID;
  child_section UUID;
BEGIN
  IF TG_TABLE_NAME = 'ExamSectionConfig' THEN
    child_session := COALESCE(NEW."sessionConfigId", OLD."sessionConfigId");
    SELECT "patternVersionId" INTO pattern_id FROM "ExamSessionConfig" WHERE "id" = child_session;
  ELSIF TG_TABLE_NAME = 'ScoringPolicy' THEN
    child_section := COALESCE(NEW."sectionConfigId", OLD."sectionConfigId");
    SELECT s."patternVersionId" INTO pattern_id FROM "ExamSectionConfig" e JOIN "ExamSessionConfig" s ON s."id" = e."sessionConfigId" WHERE e."id" = child_section;
  ELSE
    pattern_id := COALESCE(NEW."patternVersionId", OLD."patternVersionId");
  END IF;
  IF EXISTS (SELECT 1 FROM "ExamPatternVersion" WHERE "id" = pattern_id AND "status" IN ('PUBLISHED', 'SUPERSEDED')) THEN
    RAISE EXCEPTION 'Published pattern configuration is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pattern_evidence_immutability ON "PatternEvidence";
CREATE TRIGGER pattern_evidence_immutability BEFORE INSERT OR UPDATE OR DELETE ON "PatternEvidence" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_approval_immutability ON "PatternApproval";
CREATE TRIGGER pattern_approval_immutability BEFORE INSERT OR UPDATE OR DELETE ON "PatternApproval" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_override_immutability ON "SubjectPatternOverride";
CREATE TRIGGER pattern_override_immutability BEFORE INSERT OR UPDATE OR DELETE ON "SubjectPatternOverride" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_session_immutability ON "ExamSessionConfig";
CREATE TRIGGER pattern_session_immutability BEFORE INSERT OR UPDATE OR DELETE ON "ExamSessionConfig" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_section_immutability ON "ExamSectionConfig";
CREATE TRIGGER pattern_section_immutability BEFORE INSERT OR UPDATE OR DELETE ON "ExamSectionConfig" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_scoring_immutability ON "ScoringPolicy";
CREATE TRIGGER pattern_scoring_immutability BEFORE INSERT OR UPDATE OR DELETE ON "ScoringPolicy" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_language_immutability ON "LanguagePolicy";
CREATE TRIGGER pattern_language_immutability BEFORE INSERT OR UPDATE OR DELETE ON "LanguagePolicy" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
DROP TRIGGER IF EXISTS pattern_source_immutability ON "ExamRuleSource";
CREATE TRIGGER pattern_source_immutability BEFORE INSERT OR UPDATE OR DELETE ON "ExamRuleSource" FOR EACH ROW EXECUTE FUNCTION prevent_published_pattern_child_mutation();
