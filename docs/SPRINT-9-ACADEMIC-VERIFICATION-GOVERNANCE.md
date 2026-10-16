# Sprint 9 — Academic verification and publication governance

Historical PYQ metadata now follows a persisted, auditable workflow:

`IMPORTED → VALIDATED → ACADEMICALLY_REVIEWED → RIGHTS_VERIFIED → APPROVED → PUBLICATION_ELIGIBLE`

The implementation reuses `HistoricalQuestionMetadata`, `GovernanceApproval` and `AuditEvent`. Each decision stores a scoped approval reference, reviewer identity, evidence reference and timestamp. The importer, question author, academic reviewer, rights reviewer and publication approver cannot bypass the required separation-of-duties checks.

Administrative endpoints are under `/admin/preparation/historical-pyq-governance`. Student APIs expose no governance evidence or restricted licence terms. Publication eligibility requires current rights evidence covering `QUESTION_DISPLAY`, `PRACTICE_USE` and `MOCK_USE`, an authorized language, an active published question version, an answer key, explanation and syllabus mapping. Discovery permission alone is insufficient for content use.

Rejection, revocation and supersession make the record non-publication-eligible and are recorded in the append-only audit stream. No official source material, approval, licence or academic decision is fabricated by this implementation.

PYQ discovery uses deterministic keyset pagination over `(sourceYear DESC, questionSequence ASC, id ASC)`. Each database read is capped at a small batch; rights and academic eligibility are checked before a result or continuation cursor is returned. A cursor is required after the first page, preventing offset drift when records are revoked or newly published between requests.
