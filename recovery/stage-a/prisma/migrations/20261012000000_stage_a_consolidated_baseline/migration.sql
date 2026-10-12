--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountRole" AS ENUM (
    'STUDENT',
    'SME',
    'ADMIN'
);


--
-- Name: AnswerPolicy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnswerPolicy" AS ENUM (
    'SINGLE_SELECT',
    'MULTI_SELECT',
    'EXACT_MATCH'
);


--
-- Name: AuditEventType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuditEventType" AS ENUM (
    'ACCOUNT_REGISTERED',
    'LOGIN_SUCCEEDED',
    'LOGIN_FAILED',
    'SESSION_REVOKED',
    'ROLE_ACCESS_DENIED',
    'CATALOGUE_EXAM_CREATED',
    'CATALOGUE_EXAM_UPDATED',
    'PATTERN_DRAFT_CREATED',
    'PATTERN_APPROVED',
    'PATTERN_REJECTED',
    'PATTERN_PUBLISHED',
    'PATTERN_SUPERSEDED',
    'PATTERN_SUBMITTED_FOR_REVIEW',
    'ACCOUNT_EMAIL_VERIFIED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'SYLLABUS_VERSION_CREATED',
    'SYLLABUS_TAXONOMY_UPDATED',
    'QUESTION_DRAFT_CREATED',
    'QUESTION_REVISION_CREATED',
    'QUESTION_DRAFT_UPDATED',
    'QUESTION_OPTION_UPDATED',
    'QUESTION_ANSWER_KEY_UPDATED',
    'QUESTION_EXPLANATION_UPDATED',
    'QUESTION_SYLLABUS_MAPPED',
    'QUESTION_PROVENANCE_UPDATED',
    'QUESTION_SUBMITTED_FOR_REVIEW',
    'QUESTION_REVIEW_ASSIGNED',
    'QUESTION_REVIEWED',
    'QUESTION_APPROVED',
    'QUESTION_REJECTED',
    'QUESTION_PUBLISHED',
    'QUESTION_SUPERSEDED',
    'QUESTION_CHALLENGED',
    'QUESTION_CHALLENGE_RESOLVED',
    'QUESTION_TRANSLATION_REVIEWED'
);


--
-- Name: ChallengeCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ChallengeCategory" AS ENUM (
    'INCORRECT_ANSWER_KEY',
    'AMBIGUOUS_QUESTION',
    'INCORRECT_EXPLANATION',
    'TRANSLATION_ERROR',
    'OUTDATED_FACTS',
    'INCORRECT_SYLLABUS_MAPPING',
    'COPYRIGHT_PROVENANCE',
    'TECHNICAL_FORMATTING'
);


--
-- Name: ChallengeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ChallengeStatus" AS ENUM (
    'OPEN',
    'IN_REVIEW',
    'RESOLVED',
    'REJECTED',
    'DUPLICATE',
    'QUARANTINED'
);


--
-- Name: DeliveryMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeliveryMode" AS ENUM (
    'CBT',
    'OMR_SIMULATION'
);


--
-- Name: ExamFamilyCode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExamFamilyCode" AS ENUM (
    'UGC_NET',
    'CSIR_NET',
    'STATE_SET_SLET'
);


--
-- Name: JurisdictionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JurisdictionType" AS ENUM (
    'NATIONAL',
    'STATE',
    'UNION_TERRITORY',
    'REGIONAL'
);


--
-- Name: PatternApprovalDecision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PatternApprovalDecision" AS ENUM (
    'APPROVED',
    'REJECTED'
);


--
-- Name: PatternStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PatternStatus" AS ENUM (
    'RESEARCH_ONLY',
    'DISCOVERED',
    'RESEARCHED',
    'DRAFT',
    'SME_REVIEWED',
    'APPROVED',
    'PUBLISHED',
    'SUPERSEDED',
    'REJECTED'
);


--
-- Name: PublicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PublicationStatus" AS ENUM (
    'ACTIVE',
    'SUPERSEDED',
    'WITHDRAWN'
);


--
-- Name: QuestionGroupType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuestionGroupType" AS ENUM (
    'READING_COMPREHENSION',
    'DATA_INTERPRETATION'
);


--
-- Name: QuestionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuestionType" AS ENUM (
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'ASSERTION_REASON',
    'MATCHING',
    'ORDERING',
    'READING_COMPREHENSION',
    'DATA_INTERPRETATION',
    'MATHEMATICAL'
);


--
-- Name: QuestionVersionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuestionVersionStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED_FOR_REVIEW',
    'SME_REVIEWED',
    'APPROVED',
    'PUBLISHED',
    'SUPERSEDED',
    'REJECTED'
);


--
-- Name: ReviewDecision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewDecision" AS ENUM (
    'ASSIGNED',
    'APPROVED',
    'REJECTED',
    'RETURNED'
);


--
-- Name: RightsStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RightsStatus" AS ENUM (
    'OWNED',
    'LICENSED',
    'PERMISSION_GRANTED',
    'PUBLIC_DOMAIN',
    'FAIR_USE_JUSTIFIED',
    'RESTRICTED',
    'UNKNOWN'
);


--
-- Name: SessionTimingPolicy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SessionTimingPolicy" AS ENUM (
    'CONTINUOUS',
    'INDEPENDENT',
    'SEQUENTIAL_LOCKED'
);


--
-- Name: SyllabusStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SyllabusStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED_FOR_REVIEW',
    'SME_REVIEWED',
    'APPROVED',
    'PUBLISHED',
    'SUPERSEDED',
    'REJECTED'
);


--
-- Name: TranslationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TranslationStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED'
);


--
-- Name: pattern_version_for_child(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pattern_version_for_child(child_pattern_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN child_pattern_id;
END;
$$;


--
-- Name: prevent_published_pattern_child_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_pattern_child_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: prevent_published_pattern_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_pattern_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'Superseded pattern versions are immutable';
  END IF;
  IF OLD.status = 'PUBLISHED' AND NOT (
    NEW.status = 'SUPERSEDED'
    AND NEW.id = OLD.id
    AND NEW."examCycleId" = OLD."examCycleId"
    AND NEW."subjectCode" = OLD."subjectCode"
    AND NEW.version = OLD.version
    AND NEW."sourceUrl" IS NOT DISTINCT FROM OLD."sourceUrl"
    AND NEW."reviewedBy" IS NOT DISTINCT FROM OLD."reviewedBy"
    AND NEW."reviewedAt" IS NOT DISTINCT FROM OLD."reviewedAt"
    AND NEW."approvedAt" IS NOT DISTINCT FROM OLD."approvedAt"
    AND NEW."publishedAt" IS NOT DISTINCT FROM OLD."publishedAt"
    AND NEW."ruleHash" IS NOT DISTINCT FROM OLD."ruleHash"
    AND NEW.rules IS NOT DISTINCT FROM OLD.rules
    AND NEW."publishedSnapshot" IS NOT DISTINCT FROM OLD."publishedSnapshot"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Published pattern versions are immutable';
  END IF;
  IF NEW.status = 'PUBLISHED' AND NEW."publishedSnapshot" IS NULL THEN
    RAISE EXCEPTION 'Published pattern versions require a snapshot';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_published_question_child_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_question_child_mutation() RETURNS trigger
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


--
-- Name: prevent_published_question_revision_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_question_revision_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published question revisions are immutable';
  END IF;
  RETURN OLD;
END;
$$;


--
-- Name: prevent_published_question_revision_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_published_question_revision_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published question revisions are immutable';
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id uuid NOT NULL,
    email character varying(320) NOT NULL,
    "passwordHash" character varying(255) NOT NULL,
    role public."AccountRole" DEFAULT 'STUDENT'::public."AccountRole" NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditEvent" (
    id uuid NOT NULL,
    type public."AuditEventType" NOT NULL,
    "accountId" uuid,
    "ipAddress" character varying(64),
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "patternVersionId" uuid,
    "questionId" uuid,
    "questionVersionId" uuid
);


--
-- Name: ContentLicence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentLicence" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "licenceName" character varying(200) NOT NULL,
    "licenceReference" text,
    restrictions text,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ContentProvenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentProvenance" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "sourceTitle" character varying(300) NOT NULL,
    "sourceUrl" text,
    "sourceReference" text,
    "sourceHash" character varying(128),
    "rightsNote" text,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rightsStatus" public."RightsStatus" DEFAULT 'UNKNOWN'::public."RightsStatus" NOT NULL,
    "sourceType" character varying(80) DEFAULT 'RESEARCH_REFERENCE'::character varying NOT NULL
);


--
-- Name: EmailVerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailVerificationToken" (
    id uuid NOT NULL,
    "accountId" uuid NOT NULL,
    "tokenHash" character(64) NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExamCycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamCycle" (
    id uuid NOT NULL,
    "examinationId" uuid NOT NULL,
    code character varying(60) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExamOrganizer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamOrganizer" (
    id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    "officialWebsite" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ExamPatternVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamPatternVersion" (
    id uuid NOT NULL,
    "examCycleId" uuid NOT NULL,
    version integer NOT NULL,
    status public."PatternStatus" DEFAULT 'RESEARCH_ONLY'::public."PatternStatus" NOT NULL,
    "sourceUrl" text,
    "reviewedBy" character varying(120),
    "reviewedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    "ruleHash" character varying(128),
    rules jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "publishedSnapshot" jsonb,
    "subjectCode" character varying(80) DEFAULT 'GENERAL'::character varying NOT NULL
);


--
-- Name: ExamRuleSource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamRuleSource" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    title character varying(300) NOT NULL,
    "issuingAuthority" character varying(240) NOT NULL,
    "cycleCode" character varying(60) NOT NULL,
    "publicationDate" timestamp(3) without time zone,
    "effectiveDate" timestamp(3) without time zone,
    "sourceUrl" text NOT NULL,
    "evidenceExcerpt" text NOT NULL,
    "documentHash" character varying(128) NOT NULL,
    "artifactReference" text,
    "rightsNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExamSectionConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamSectionConfig" (
    id uuid NOT NULL,
    "sessionConfigId" uuid NOT NULL,
    key character varying(80) NOT NULL,
    "offeredQuestions" integer NOT NULL,
    "maximumAttempts" integer NOT NULL,
    "answerPolicy" public."AnswerPolicy" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExamSessionConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamSessionConfig" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    key character varying(80) NOT NULL,
    "deliveryMode" public."DeliveryMode" NOT NULL,
    "timingPolicy" public."SessionTimingPolicy" NOT NULL,
    "durationSeconds" integer NOT NULL,
    sequence integer NOT NULL,
    "submitSeparately" boolean DEFAULT false NOT NULL,
    "allowReturn" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExamSubject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamSubject" (
    id uuid NOT NULL,
    "examCycleId" uuid NOT NULL,
    code character varying(80) NOT NULL,
    name character varying(200) NOT NULL,
    status public."PatternStatus" DEFAULT 'RESEARCH_ONLY'::public."PatternStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Examination; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Examination" (
    id uuid NOT NULL,
    code character varying(48) NOT NULL,
    name character varying(200) NOT NULL,
    family public."ExamFamilyCode" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "organizerId" uuid NOT NULL
);


--
-- Name: ExaminationJurisdiction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExaminationJurisdiction" (
    "examinationId" uuid NOT NULL,
    "jurisdictionId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Jurisdiction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Jurisdiction" (
    id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(160) NOT NULL,
    type public."JurisdictionType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LanguagePolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LanguagePolicy" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    "languageCode" character varying(20) NOT NULL,
    "isFallback" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OptionRationale; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OptionRationale" (
    id uuid NOT NULL,
    "explanationId" uuid NOT NULL,
    "optionKey" character varying(32) NOT NULL,
    rationale jsonb NOT NULL
);


--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordResetToken" (
    id uuid NOT NULL,
    "accountId" uuid NOT NULL,
    "tokenHash" character(64) NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PatternApproval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PatternApproval" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    decision public."PatternApprovalDecision" NOT NULL,
    notes text,
    "ruleHash" character varying(128) NOT NULL,
    "regressionReportId" character varying(160) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PatternEvidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PatternEvidence" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    "officialSourceUrl" text NOT NULL,
    "sourceDocumentHash" character varying(128) NOT NULL,
    "sourcePublishedAt" timestamp(3) without time zone,
    "regressionReportId" character varying(160) NOT NULL,
    "submittedById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "artifactReference" text,
    "effectiveAt" timestamp(3) without time zone,
    "evidenceExcerpt" text DEFAULT ''::text NOT NULL,
    "issuingAuthority" character varying(240) DEFAULT ''::character varying NOT NULL,
    "officialDocumentTitle" character varying(300) DEFAULT ''::character varying NOT NULL,
    "questionBankCoverage" jsonb
);


--
-- Name: Question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Question" (
    id uuid NOT NULL,
    "examCycleId" uuid NOT NULL,
    "subjectCode" character varying(80) NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuestionAnswerKeyVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionAnswerKeyVersion" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    version integer NOT NULL,
    "correctAnswers" jsonb NOT NULL,
    "exactMatch" boolean DEFAULT false NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionChallenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionChallenge" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "reporterId" uuid NOT NULL,
    category public."ChallengeCategory" NOT NULL,
    description text NOT NULL,
    status public."ChallengeStatus" DEFAULT 'OPEN'::public."ChallengeStatus" NOT NULL,
    "dedupeHash" character(64) NOT NULL,
    "resolutionNotes" text,
    "resolvedById" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone
);


--
-- Name: QuestionExplanationVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionExplanationVersion" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    version integer NOT NULL,
    "languageCode" character varying(20) DEFAULT 'en'::character varying NOT NULL,
    explanation jsonb NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionGroup" (
    id uuid NOT NULL,
    "examCycleId" uuid NOT NULL,
    "subjectCode" character varying(80) NOT NULL,
    type public."QuestionGroupType" NOT NULL,
    title character varying(240) NOT NULL,
    stimulus jsonb NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionOption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionOption" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "optionKey" character varying(32) NOT NULL,
    "optionText" jsonb NOT NULL,
    sequence integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuestionPublication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionPublication" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "publishedById" uuid NOT NULL,
    status public."PublicationStatus" DEFAULT 'ACTIVE'::public."PublicationStatus" NOT NULL,
    "contentHash" character varying(128) NOT NULL,
    snapshot jsonb NOT NULL,
    "publishedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "supersededAt" timestamp(3) without time zone,
    "withdrawnAt" timestamp(3) without time zone
);


--
-- Name: QuestionReview; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionReview" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "reviewerId" uuid NOT NULL,
    decision public."ReviewDecision" NOT NULL,
    notes text NOT NULL,
    evidence jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionSyllabusMapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionSyllabusMapping" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "syllabusTopicId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionTranslation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionTranslation" (
    id uuid NOT NULL,
    "questionVersionId" uuid NOT NULL,
    "languageCode" character varying(20) NOT NULL,
    prompt jsonb NOT NULL,
    status public."TranslationStatus" DEFAULT 'DRAFT'::public."TranslationStatus" NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedById" uuid
);


--
-- Name: QuestionVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionVersion" (
    id uuid NOT NULL,
    "questionId" uuid NOT NULL,
    version integer NOT NULL,
    status public."QuestionVersionStatus" DEFAULT 'DRAFT'::public."QuestionVersionStatus" NOT NULL,
    type public."QuestionType" NOT NULL,
    "languageCode" character varying(20) DEFAULT 'en'::character varying NOT NULL,
    prompt jsonb NOT NULL,
    "groupId" uuid,
    "authoredById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "publishedAt" timestamp(3) without time zone,
    "submittedAt" timestamp(3) without time zone
);


--
-- Name: ScoringPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScoringPolicy" (
    id uuid NOT NULL,
    "sectionConfigId" uuid NOT NULL,
    "marksCorrect" numeric(10,4) NOT NULL,
    "marksWrong" numeric(10,4) NOT NULL,
    "exactMatch" boolean DEFAULT false NOT NULL,
    "allowMultipleCorrect" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id uuid NOT NULL,
    "accountId" uuid NOT NULL,
    "tokenHash" character(64) NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" character varying(64),
    "userAgent" character varying(512)
);


--
-- Name: SubjectPatternOverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubjectPatternOverride" (
    id uuid NOT NULL,
    "patternVersionId" uuid NOT NULL,
    "subjectCode" character varying(80) NOT NULL,
    rules jsonb NOT NULL,
    "ruleHash" character varying(128) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "examSubjectId" uuid
);


--
-- Name: SubjectUnit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubjectUnit" (
    id uuid NOT NULL,
    "syllabusVersionId" uuid NOT NULL,
    code character varying(80) NOT NULL,
    title character varying(240) NOT NULL,
    sequence integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SyllabusTopic; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SyllabusTopic" (
    id uuid NOT NULL,
    "subjectUnitId" uuid NOT NULL,
    "parentId" uuid,
    code character varying(100) NOT NULL,
    title character varying(300) NOT NULL,
    sequence integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SyllabusVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SyllabusVersion" (
    id uuid NOT NULL,
    "examCycleId" uuid NOT NULL,
    "subjectCode" character varying(80) NOT NULL,
    version integer NOT NULL,
    title character varying(240) NOT NULL,
    status public."SyllabusStatus" DEFAULT 'DRAFT'::public."SyllabusStatus" NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: AuditEvent AuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: ContentLicence ContentLicence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentLicence"
    ADD CONSTRAINT "ContentLicence_pkey" PRIMARY KEY (id);


--
-- Name: ContentProvenance ContentProvenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentProvenance"
    ADD CONSTRAINT "ContentProvenance_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerificationToken EmailVerificationToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY (id);


--
-- Name: ExamCycle ExamCycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamCycle"
    ADD CONSTRAINT "ExamCycle_pkey" PRIMARY KEY (id);


--
-- Name: ExamOrganizer ExamOrganizer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamOrganizer"
    ADD CONSTRAINT "ExamOrganizer_pkey" PRIMARY KEY (id);


--
-- Name: ExamPatternVersion ExamPatternVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamPatternVersion"
    ADD CONSTRAINT "ExamPatternVersion_pkey" PRIMARY KEY (id);


--
-- Name: ExamRuleSource ExamRuleSource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamRuleSource"
    ADD CONSTRAINT "ExamRuleSource_pkey" PRIMARY KEY (id);


--
-- Name: ExamSectionConfig ExamSectionConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSectionConfig"
    ADD CONSTRAINT "ExamSectionConfig_pkey" PRIMARY KEY (id);


--
-- Name: ExamSessionConfig ExamSessionConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSessionConfig"
    ADD CONSTRAINT "ExamSessionConfig_pkey" PRIMARY KEY (id);


--
-- Name: ExamSubject ExamSubject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSubject"
    ADD CONSTRAINT "ExamSubject_pkey" PRIMARY KEY (id);


--
-- Name: ExaminationJurisdiction ExaminationJurisdiction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExaminationJurisdiction"
    ADD CONSTRAINT "ExaminationJurisdiction_pkey" PRIMARY KEY ("examinationId", "jurisdictionId");


--
-- Name: Examination Examination_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Examination"
    ADD CONSTRAINT "Examination_pkey" PRIMARY KEY (id);


--
-- Name: Jurisdiction Jurisdiction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Jurisdiction"
    ADD CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY (id);


--
-- Name: LanguagePolicy LanguagePolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LanguagePolicy"
    ADD CONSTRAINT "LanguagePolicy_pkey" PRIMARY KEY (id);


--
-- Name: OptionRationale OptionRationale_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OptionRationale"
    ADD CONSTRAINT "OptionRationale_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: PatternApproval PatternApproval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternApproval"
    ADD CONSTRAINT "PatternApproval_pkey" PRIMARY KEY (id);


--
-- Name: PatternEvidence PatternEvidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternEvidence"
    ADD CONSTRAINT "PatternEvidence_pkey" PRIMARY KEY (id);


--
-- Name: QuestionAnswerKeyVersion QuestionAnswerKeyVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionAnswerKeyVersion"
    ADD CONSTRAINT "QuestionAnswerKeyVersion_pkey" PRIMARY KEY (id);


--
-- Name: QuestionChallenge QuestionChallenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionChallenge"
    ADD CONSTRAINT "QuestionChallenge_pkey" PRIMARY KEY (id);


--
-- Name: QuestionExplanationVersion QuestionExplanationVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionExplanationVersion"
    ADD CONSTRAINT "QuestionExplanationVersion_pkey" PRIMARY KEY (id);


--
-- Name: QuestionGroup QuestionGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionGroup"
    ADD CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY (id);


--
-- Name: QuestionOption QuestionOption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionOption"
    ADD CONSTRAINT "QuestionOption_pkey" PRIMARY KEY (id);


--
-- Name: QuestionPublication QuestionPublication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionPublication"
    ADD CONSTRAINT "QuestionPublication_pkey" PRIMARY KEY (id);


--
-- Name: QuestionReview QuestionReview_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionReview"
    ADD CONSTRAINT "QuestionReview_pkey" PRIMARY KEY (id);


--
-- Name: QuestionSyllabusMapping QuestionSyllabusMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionSyllabusMapping"
    ADD CONSTRAINT "QuestionSyllabusMapping_pkey" PRIMARY KEY (id);


--
-- Name: QuestionTranslation QuestionTranslation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTranslation"
    ADD CONSTRAINT "QuestionTranslation_pkey" PRIMARY KEY (id);


--
-- Name: QuestionVersion QuestionVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionVersion"
    ADD CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY (id);


--
-- Name: Question Question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_pkey" PRIMARY KEY (id);


--
-- Name: ScoringPolicy ScoringPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScoringPolicy"
    ADD CONSTRAINT "ScoringPolicy_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SubjectPatternOverride SubjectPatternOverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectPatternOverride"
    ADD CONSTRAINT "SubjectPatternOverride_pkey" PRIMARY KEY (id);


--
-- Name: SubjectUnit SubjectUnit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectUnit"
    ADD CONSTRAINT "SubjectUnit_pkey" PRIMARY KEY (id);


--
-- Name: SyllabusTopic SyllabusTopic_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusTopic"
    ADD CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY (id);


--
-- Name: SyllabusVersion SyllabusVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusVersion"
    ADD CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY (id);


--
-- Name: Account_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_email_key" ON public."Account" USING btree (email);


--
-- Name: AuditEvent_accountId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_accountId_createdAt_idx" ON public."AuditEvent" USING btree ("accountId", "createdAt");


--
-- Name: AuditEvent_patternVersionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_patternVersionId_createdAt_idx" ON public."AuditEvent" USING btree ("patternVersionId", "createdAt");


--
-- Name: AuditEvent_questionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_questionId_createdAt_idx" ON public."AuditEvent" USING btree ("questionId", "createdAt");


--
-- Name: AuditEvent_questionVersionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_questionVersionId_createdAt_idx" ON public."AuditEvent" USING btree ("questionVersionId", "createdAt");


--
-- Name: AuditEvent_type_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditEvent_type_createdAt_idx" ON public."AuditEvent" USING btree (type, "createdAt");


--
-- Name: EmailVerificationToken_accountId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerificationToken_accountId_expiresAt_idx" ON public."EmailVerificationToken" USING btree ("accountId", "expiresAt");


--
-- Name: EmailVerificationToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON public."EmailVerificationToken" USING btree ("tokenHash");


--
-- Name: ExamCycle_examinationId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamCycle_examinationId_code_key" ON public."ExamCycle" USING btree ("examinationId", code);


--
-- Name: ExamOrganizer_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamOrganizer_code_key" ON public."ExamOrganizer" USING btree (code);


--
-- Name: ExamPatternVersion_examCycleId_subjectCode_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamPatternVersion_examCycleId_subjectCode_status_idx" ON public."ExamPatternVersion" USING btree ("examCycleId", "subjectCode", status);


--
-- Name: ExamPatternVersion_examCycleId_subjectCode_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamPatternVersion_examCycleId_subjectCode_version_key" ON public."ExamPatternVersion" USING btree ("examCycleId", "subjectCode", version);


--
-- Name: ExamPatternVersion_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamPatternVersion_status_idx" ON public."ExamPatternVersion" USING btree (status);


--
-- Name: ExamRuleSource_patternVersionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamRuleSource_patternVersionId_idx" ON public."ExamRuleSource" USING btree ("patternVersionId");


--
-- Name: ExamSectionConfig_sessionConfigId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamSectionConfig_sessionConfigId_key_key" ON public."ExamSectionConfig" USING btree ("sessionConfigId", key);


--
-- Name: ExamSessionConfig_patternVersionId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamSessionConfig_patternVersionId_key_key" ON public."ExamSessionConfig" USING btree ("patternVersionId", key);


--
-- Name: ExamSessionConfig_patternVersionId_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamSessionConfig_patternVersionId_sequence_idx" ON public."ExamSessionConfig" USING btree ("patternVersionId", sequence);


--
-- Name: ExamSubject_examCycleId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamSubject_examCycleId_code_key" ON public."ExamSubject" USING btree ("examCycleId", code);


--
-- Name: ExamSubject_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamSubject_status_idx" ON public."ExamSubject" USING btree (status);


--
-- Name: ExaminationJurisdiction_jurisdictionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExaminationJurisdiction_jurisdictionId_idx" ON public."ExaminationJurisdiction" USING btree ("jurisdictionId");


--
-- Name: Examination_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Examination_code_key" ON public."Examination" USING btree (code);


--
-- Name: Examination_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Examination_family_idx" ON public."Examination" USING btree (family);


--
-- Name: Examination_organizerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Examination_organizerId_idx" ON public."Examination" USING btree ("organizerId");


--
-- Name: Jurisdiction_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Jurisdiction_code_key" ON public."Jurisdiction" USING btree (code);


--
-- Name: LanguagePolicy_patternVersionId_languageCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LanguagePolicy_patternVersionId_languageCode_key" ON public."LanguagePolicy" USING btree ("patternVersionId", "languageCode");


--
-- Name: OptionRationale_explanationId_optionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OptionRationale_explanationId_optionKey_key" ON public."OptionRationale" USING btree ("explanationId", "optionKey");


--
-- Name: PasswordResetToken_accountId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordResetToken_accountId_expiresAt_idx" ON public."PasswordResetToken" USING btree ("accountId", "expiresAt");


--
-- Name: PasswordResetToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON public."PasswordResetToken" USING btree ("tokenHash");


--
-- Name: PatternApproval_patternVersionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PatternApproval_patternVersionId_createdAt_idx" ON public."PatternApproval" USING btree ("patternVersionId", "createdAt");


--
-- Name: PatternApproval_reviewerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PatternApproval_reviewerId_createdAt_idx" ON public."PatternApproval" USING btree ("reviewerId", "createdAt");


--
-- Name: PatternEvidence_patternVersionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PatternEvidence_patternVersionId_key" ON public."PatternEvidence" USING btree ("patternVersionId");


--
-- Name: QuestionAnswerKeyVersion_questionVersionId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionAnswerKeyVersion_questionVersionId_version_key" ON public."QuestionAnswerKeyVersion" USING btree ("questionVersionId", version);


--
-- Name: QuestionChallenge_dedupeHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionChallenge_dedupeHash_key" ON public."QuestionChallenge" USING btree ("dedupeHash");


--
-- Name: QuestionChallenge_questionVersionId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionChallenge_questionVersionId_status_idx" ON public."QuestionChallenge" USING btree ("questionVersionId", status);


--
-- Name: QuestionChallenge_reporterId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionChallenge_reporterId_createdAt_idx" ON public."QuestionChallenge" USING btree ("reporterId", "createdAt");


--
-- Name: QuestionExplanationVersion_questionVersionId_version_langua_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionExplanationVersion_questionVersionId_version_langua_key" ON public."QuestionExplanationVersion" USING btree ("questionVersionId", version, "languageCode");


--
-- Name: QuestionOption_questionVersionId_optionKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionOption_questionVersionId_optionKey_key" ON public."QuestionOption" USING btree ("questionVersionId", "optionKey");


--
-- Name: QuestionOption_questionVersionId_sequence_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionOption_questionVersionId_sequence_key" ON public."QuestionOption" USING btree ("questionVersionId", sequence);


--
-- Name: QuestionPublication_questionVersionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionPublication_questionVersionId_key" ON public."QuestionPublication" USING btree ("questionVersionId");


--
-- Name: QuestionPublication_status_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionPublication_status_publishedAt_idx" ON public."QuestionPublication" USING btree (status, "publishedAt");


--
-- Name: QuestionReview_questionVersionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionReview_questionVersionId_createdAt_idx" ON public."QuestionReview" USING btree ("questionVersionId", "createdAt");


--
-- Name: QuestionReview_reviewerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionReview_reviewerId_createdAt_idx" ON public."QuestionReview" USING btree ("reviewerId", "createdAt");


--
-- Name: QuestionSyllabusMapping_questionVersionId_syllabusTopicId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionSyllabusMapping_questionVersionId_syllabusTopicId_key" ON public."QuestionSyllabusMapping" USING btree ("questionVersionId", "syllabusTopicId");


--
-- Name: QuestionTranslation_questionVersionId_languageCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionTranslation_questionVersionId_languageCode_key" ON public."QuestionTranslation" USING btree ("questionVersionId", "languageCode");


--
-- Name: QuestionVersion_groupId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionVersion_groupId_idx" ON public."QuestionVersion" USING btree ("groupId");


--
-- Name: QuestionVersion_questionId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON public."QuestionVersion" USING btree ("questionId", version);


--
-- Name: QuestionVersion_status_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionVersion_status_type_idx" ON public."QuestionVersion" USING btree (status, type);


--
-- Name: Question_examCycleId_subjectCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Question_examCycleId_subjectCode_idx" ON public."Question" USING btree ("examCycleId", "subjectCode");


--
-- Name: ScoringPolicy_sectionConfigId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ScoringPolicy_sectionConfigId_key" ON public."ScoringPolicy" USING btree ("sectionConfigId");


--
-- Name: Session_accountId_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_accountId_expiresAt_idx" ON public."Session" USING btree ("accountId", "expiresAt");


--
-- Name: Session_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_expiresAt_idx" ON public."Session" USING btree ("expiresAt");


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: SubjectPatternOverride_patternVersionId_subjectCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubjectPatternOverride_patternVersionId_subjectCode_key" ON public."SubjectPatternOverride" USING btree ("patternVersionId", "subjectCode");


--
-- Name: SubjectPatternOverride_subjectCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubjectPatternOverride_subjectCode_idx" ON public."SubjectPatternOverride" USING btree ("subjectCode");


--
-- Name: SubjectUnit_syllabusVersionId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubjectUnit_syllabusVersionId_code_key" ON public."SubjectUnit" USING btree ("syllabusVersionId", code);


--
-- Name: SubjectUnit_syllabusVersionId_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubjectUnit_syllabusVersionId_sequence_idx" ON public."SubjectUnit" USING btree ("syllabusVersionId", sequence);


--
-- Name: SyllabusTopic_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SyllabusTopic_parentId_idx" ON public."SyllabusTopic" USING btree ("parentId");


--
-- Name: SyllabusTopic_subjectUnitId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SyllabusTopic_subjectUnitId_code_key" ON public."SyllabusTopic" USING btree ("subjectUnitId", code);


--
-- Name: SyllabusTopic_subjectUnitId_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SyllabusTopic_subjectUnitId_sequence_idx" ON public."SyllabusTopic" USING btree ("subjectUnitId", sequence);


--
-- Name: SyllabusVersion_examCycleId_subjectCode_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SyllabusVersion_examCycleId_subjectCode_status_idx" ON public."SyllabusVersion" USING btree ("examCycleId", "subjectCode", status);


--
-- Name: SyllabusVersion_examCycleId_subjectCode_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SyllabusVersion_examCycleId_subjectCode_version_key" ON public."SyllabusVersion" USING btree ("examCycleId", "subjectCode", version);


--
-- Name: ExamPatternVersion exam_pattern_version_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exam_pattern_version_immutability BEFORE UPDATE ON public."ExamPatternVersion" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_mutation();


--
-- Name: PatternApproval pattern_approval_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_approval_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."PatternApproval" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: PatternEvidence pattern_evidence_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_evidence_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."PatternEvidence" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: LanguagePolicy pattern_language_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_language_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."LanguagePolicy" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: SubjectPatternOverride pattern_override_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_override_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."SubjectPatternOverride" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: ScoringPolicy pattern_scoring_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_scoring_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."ScoringPolicy" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: ExamSectionConfig pattern_section_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_section_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."ExamSectionConfig" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: ExamSessionConfig pattern_session_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_session_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."ExamSessionConfig" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: ExamRuleSource pattern_source_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pattern_source_immutability BEFORE INSERT OR DELETE OR UPDATE ON public."ExamRuleSource" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_pattern_child_mutation();


--
-- Name: QuestionAnswerKeyVersion question_answer_key_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_answer_key_immutability BEFORE DELETE OR UPDATE ON public."QuestionAnswerKeyVersion" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: QuestionExplanationVersion question_explanation_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_explanation_immutability BEFORE DELETE OR UPDATE ON public."QuestionExplanationVersion" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: ContentLicence question_licence_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_licence_immutability BEFORE DELETE OR UPDATE ON public."ContentLicence" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: QuestionSyllabusMapping question_mapping_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_mapping_immutability BEFORE DELETE OR UPDATE ON public."QuestionSyllabusMapping" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: QuestionOption question_option_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_option_immutability BEFORE DELETE OR UPDATE ON public."QuestionOption" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: ContentProvenance question_provenance_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_provenance_immutability BEFORE DELETE OR UPDATE ON public."ContentProvenance" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: QuestionVersion question_revision_delete_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_revision_delete_immutability BEFORE DELETE ON public."QuestionVersion" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_revision_delete();


--
-- Name: QuestionVersion question_revision_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_revision_immutability BEFORE UPDATE ON public."QuestionVersion" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_revision_mutation();


--
-- Name: QuestionTranslation question_translation_immutability; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER question_translation_immutability BEFORE DELETE OR UPDATE ON public."QuestionTranslation" FOR EACH ROW EXECUTE FUNCTION public.prevent_published_question_child_mutation();


--
-- Name: AuditEvent AuditEvent_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditEvent AuditEvent_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditEvent AuditEvent_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditEvent AuditEvent_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditEvent"
    ADD CONSTRAINT "AuditEvent_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ContentLicence ContentLicence_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentLicence"
    ADD CONSTRAINT "ContentLicence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentLicence ContentLicence_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentLicence"
    ADD CONSTRAINT "ContentLicence_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ContentProvenance ContentProvenance_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentProvenance"
    ADD CONSTRAINT "ContentProvenance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ContentProvenance ContentProvenance_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentProvenance"
    ADD CONSTRAINT "ContentProvenance_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmailVerificationToken EmailVerificationToken_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamCycle ExamCycle_examinationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamCycle"
    ADD CONSTRAINT "ExamCycle_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES public."Examination"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamPatternVersion ExamPatternVersion_examCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamPatternVersion"
    ADD CONSTRAINT "ExamPatternVersion_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES public."ExamCycle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamRuleSource ExamRuleSource_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamRuleSource"
    ADD CONSTRAINT "ExamRuleSource_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSectionConfig ExamSectionConfig_sessionConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSectionConfig"
    ADD CONSTRAINT "ExamSectionConfig_sessionConfigId_fkey" FOREIGN KEY ("sessionConfigId") REFERENCES public."ExamSessionConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSessionConfig ExamSessionConfig_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSessionConfig"
    ADD CONSTRAINT "ExamSessionConfig_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamSubject ExamSubject_examCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamSubject"
    ADD CONSTRAINT "ExamSubject_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES public."ExamCycle"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExaminationJurisdiction ExaminationJurisdiction_examinationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExaminationJurisdiction"
    ADD CONSTRAINT "ExaminationJurisdiction_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES public."Examination"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExaminationJurisdiction ExaminationJurisdiction_jurisdictionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExaminationJurisdiction"
    ADD CONSTRAINT "ExaminationJurisdiction_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES public."Jurisdiction"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Examination Examination_organizerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Examination"
    ADD CONSTRAINT "Examination_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES public."ExamOrganizer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LanguagePolicy LanguagePolicy_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LanguagePolicy"
    ADD CONSTRAINT "LanguagePolicy_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OptionRationale OptionRationale_explanationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OptionRationale"
    ADD CONSTRAINT "OptionRationale_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES public."QuestionExplanationVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PasswordResetToken PasswordResetToken_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PatternApproval PatternApproval_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternApproval"
    ADD CONSTRAINT "PatternApproval_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PatternApproval PatternApproval_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternApproval"
    ADD CONSTRAINT "PatternApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PatternEvidence PatternEvidence_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternEvidence"
    ADD CONSTRAINT "PatternEvidence_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PatternEvidence PatternEvidence_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PatternEvidence"
    ADD CONSTRAINT "PatternEvidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionAnswerKeyVersion QuestionAnswerKeyVersion_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionAnswerKeyVersion"
    ADD CONSTRAINT "QuestionAnswerKeyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionAnswerKeyVersion QuestionAnswerKeyVersion_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionAnswerKeyVersion"
    ADD CONSTRAINT "QuestionAnswerKeyVersion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionChallenge QuestionChallenge_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionChallenge"
    ADD CONSTRAINT "QuestionChallenge_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionChallenge QuestionChallenge_reporterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionChallenge"
    ADD CONSTRAINT "QuestionChallenge_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionChallenge QuestionChallenge_resolvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionChallenge"
    ADD CONSTRAINT "QuestionChallenge_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionExplanationVersion QuestionExplanationVersion_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionExplanationVersion"
    ADD CONSTRAINT "QuestionExplanationVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionExplanationVersion QuestionExplanationVersion_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionExplanationVersion"
    ADD CONSTRAINT "QuestionExplanationVersion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionGroup QuestionGroup_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionGroup"
    ADD CONSTRAINT "QuestionGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionGroup QuestionGroup_examCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionGroup"
    ADD CONSTRAINT "QuestionGroup_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES public."ExamCycle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionOption QuestionOption_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionOption"
    ADD CONSTRAINT "QuestionOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionPublication QuestionPublication_publishedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionPublication"
    ADD CONSTRAINT "QuestionPublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionPublication QuestionPublication_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionPublication"
    ADD CONSTRAINT "QuestionPublication_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionReview QuestionReview_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionReview"
    ADD CONSTRAINT "QuestionReview_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionReview QuestionReview_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionReview"
    ADD CONSTRAINT "QuestionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionSyllabusMapping QuestionSyllabusMapping_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionSyllabusMapping"
    ADD CONSTRAINT "QuestionSyllabusMapping_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionSyllabusMapping QuestionSyllabusMapping_syllabusTopicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionSyllabusMapping"
    ADD CONSTRAINT "QuestionSyllabusMapping_syllabusTopicId_fkey" FOREIGN KEY ("syllabusTopicId") REFERENCES public."SyllabusTopic"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionTranslation QuestionTranslation_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTranslation"
    ADD CONSTRAINT "QuestionTranslation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionTranslation QuestionTranslation_questionVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTranslation"
    ADD CONSTRAINT "QuestionTranslation_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES public."QuestionVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionTranslation QuestionTranslation_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTranslation"
    ADD CONSTRAINT "QuestionTranslation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionVersion QuestionVersion_authoredById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionVersion"
    ADD CONSTRAINT "QuestionVersion_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionVersion QuestionVersion_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionVersion"
    ADD CONSTRAINT "QuestionVersion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."QuestionGroup"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: QuestionVersion QuestionVersion_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionVersion"
    ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Question Question_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Question Question_examCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES public."ExamCycle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScoringPolicy ScoringPolicy_sectionConfigId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScoringPolicy"
    ADD CONSTRAINT "ScoringPolicy_sectionConfigId_fkey" FOREIGN KEY ("sectionConfigId") REFERENCES public."ExamSectionConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SubjectPatternOverride SubjectPatternOverride_examSubjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectPatternOverride"
    ADD CONSTRAINT "SubjectPatternOverride_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES public."ExamSubject"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SubjectPatternOverride SubjectPatternOverride_patternVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectPatternOverride"
    ADD CONSTRAINT "SubjectPatternOverride_patternVersionId_fkey" FOREIGN KEY ("patternVersionId") REFERENCES public."ExamPatternVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SubjectUnit SubjectUnit_syllabusVersionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubjectUnit"
    ADD CONSTRAINT "SubjectUnit_syllabusVersionId_fkey" FOREIGN KEY ("syllabusVersionId") REFERENCES public."SyllabusVersion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyllabusTopic SyllabusTopic_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusTopic"
    ADD CONSTRAINT "SyllabusTopic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."SyllabusTopic"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyllabusTopic SyllabusTopic_subjectUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusTopic"
    ADD CONSTRAINT "SyllabusTopic_subjectUnitId_fkey" FOREIGN KEY ("subjectUnitId") REFERENCES public."SubjectUnit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyllabusVersion SyllabusVersion_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusVersion"
    ADD CONSTRAINT "SyllabusVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SyllabusVersion SyllabusVersion_examCycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SyllabusVersion"
    ADD CONSTRAINT "SyllabusVersion_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES public."ExamCycle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

