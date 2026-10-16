# Sprint 7 — Historical PYQ Metadata and Student Acceptance

## Scope

This increment adds an additive, authoritative metadata boundary for historical question-paper records and a rights-safe student discovery flow. It does not infer a year, session, paper, language, authority or publication right from a legacy cycle code. A legacy question without an explicit metadata row remains unverified and is not returned by the student endpoint.

## Architecture

- `HistoricalQuestionMetadata` is linked one-to-one to an immutable `QuestionVersion` and to the authoritative `ExamCycle`.
- Verification, publication eligibility, revocation and rights are explicit fields. Answer-key values remain outside the student contract.
- The student endpoint returns only verified, non-revoked, rights-cleared and publication-eligible records whose published question version has the existing review, explanation, mapping and answer-key gates.
- Query order is `sourceYear DESC`, `questionSequence ASC`, `id ASC`; pagination is bounded and deterministic.
- The administrative readiness endpoint is restricted to `ADMIN` and `SME` and exposes aggregate readiness, never question text or answer values.
- Existing practice and CBT routes remain the execution paths; PYQ discovery links into those existing subject flows rather than inventing a parallel attempt system.

## Implementation sequence

1. Add the additive Prisma model and replayable migration to both repository migration paths.
2. Generate the Prisma client and run focused service tests.
3. Expose student-safe metadata discovery and administrative readiness reporting.
4. Add the student filter, empty-state and pagination interface.
5. Validate with isolated database replay, API/unit checks, browser checks, typecheck, lint and build.

## Acceptance criteria

- Six requested metadata dimensions are representable without fabricated legacy values: exam identity/family through the cycle, authority, year/cycle/session, paper/subject, language and source/checksum.
- Answer-key provenance is metadata only; answer-key contents are never in the student response.
- Restricted, unknown, revoked or unverified records are excluded.
- Filters and pagination are deterministic and preserve safe empty states.
- Admin/SME readiness identifies inventory blockers by examination/cycle/subject/paper/language.
- Existing active database and migration history are not accessed or changed by local validation.

## Known boundary

No official historical PYQ metadata is fabricated or seeded in this increment. The inventory will remain empty or partially ready until authorized academic operators populate and verify source records. Persistent PYQ attempt generation and durable historical-result analytics remain downstream of the existing CBT and preparation contracts.
