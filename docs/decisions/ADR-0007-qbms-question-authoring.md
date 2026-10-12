# ADR-0007 — QBMS question authoring and revision boundary

**Date:** 2026-10-12
**Status:** Accepted for Sprint 2B

## Decision

Question identity is separated from `QuestionVersion`. A question belongs to one existing exam cycle and subject context; each revision contains its own type, prompt, language, options, syllabus mappings, answer-key versions, explanations, translations, provenance, and licensing records. A revision may map to multiple topics in one concrete syllabus version without duplicating the question identity.

The authoring API accepts structured JSON rather than arbitrary HTML. The validator supports single-choice, multiple-choice, assertion/reason, matching, ordering, reading comprehension, data interpretation, and mathematical/LaTeX questions. Shared comprehension/DI material is represented by a cycle- and subject-scoped `QuestionGroup`.

Only authenticated SME and administrator accounts can author. SMEs can edit their own draft questions; administrators can manage all drafts. No publication transition is implemented in Sprint 2B. Database triggers prevent updates and deletes of revisions once their status is `PUBLISHED`, so Sprint 2C must create corrections as new revisions.

## Consequences

- Answer keys and explanations are revision-linked and cannot silently follow a later revision.
- Marks, penalties, and attempt policies remain in approved exam-pattern versions, not question records.
- Translation records have independent status and cannot imply approval of the source or translation.
- Provenance and licence metadata are durable authoring records; rights assessment remains a review responsibility.
- Public/student routes are intentionally absent until the review/publication increment defines safe exposure.
