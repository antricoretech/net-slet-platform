CREATE OR REPLACE FUNCTION prevent_published_question_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE revision_status "QuestionVersionStatus";
BEGIN
  SELECT status INTO revision_status FROM "QuestionVersion" WHERE id = OLD."questionVersionId";
  IF revision_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published question revision children are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER question_option_immutability BEFORE UPDATE OR DELETE ON "QuestionOption" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_answer_key_immutability BEFORE UPDATE OR DELETE ON "QuestionAnswerKeyVersion" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_explanation_immutability BEFORE UPDATE OR DELETE ON "QuestionExplanationVersion" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_mapping_immutability BEFORE UPDATE OR DELETE ON "QuestionSyllabusMapping" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_translation_immutability BEFORE UPDATE OR DELETE ON "QuestionTranslation" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_provenance_immutability BEFORE UPDATE OR DELETE ON "ContentProvenance" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
CREATE TRIGGER question_licence_immutability BEFORE UPDATE OR DELETE ON "ContentLicence" FOR EACH ROW EXECUTE FUNCTION prevent_published_question_child_mutation();
