-- Pin the approved answer-key version used by each published test-form question.
ALTER TABLE "TestFormQuestion" ADD COLUMN "answerKeyVersionId" UUID;

UPDATE "TestFormQuestion" AS form_question
SET "answerKeyVersionId" = answer_key.id
FROM "QuestionAnswerKeyVersion" AS answer_key
WHERE answer_key."questionVersionId" = form_question."questionVersionId"
  AND answer_key.version = (
    SELECT MAX(candidate.version)
    FROM "QuestionAnswerKeyVersion" AS candidate
    WHERE candidate."questionVersionId" = form_question."questionVersionId"
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TestFormQuestion" WHERE "answerKeyVersionId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot pin every test-form question to an approved answer key';
  END IF;
END $$;

ALTER TABLE "TestFormQuestion" ALTER COLUMN "answerKeyVersionId" SET NOT NULL;

CREATE INDEX "TestFormQuestion_answerKeyVersionId_idx" ON "TestFormQuestion"("answerKeyVersionId");

ALTER TABLE "TestFormQuestion"
  ADD CONSTRAINT "TestFormQuestion_answerKeyVersionId_fkey"
  FOREIGN KEY ("answerKeyVersionId") REFERENCES "QuestionAnswerKeyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_published_test_form_question_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE form_status "TestFormStatus";
BEGIN
  SELECT status INTO form_status
  FROM "TestForm"
  WHERE id = OLD."testFormId";

  IF form_status IN ('PUBLISHED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'Published test-form questions are immutable';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER test_form_question_immutability
BEFORE UPDATE OR DELETE ON "TestFormQuestion"
FOR EACH ROW EXECUTE FUNCTION prevent_published_test_form_question_mutation();
