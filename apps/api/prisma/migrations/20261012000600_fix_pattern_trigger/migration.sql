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
