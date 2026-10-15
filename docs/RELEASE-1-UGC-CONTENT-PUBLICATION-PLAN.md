# Release 1 — UGC NET content qualification and mock publication plan

## Scope

This increment adds the administrative workflow needed to assess an exact UGC NET examination-cycle pattern, qualify already-published question revisions, compile an immutable QA-only test-form snapshot, and expose only eligible published forms to students. It does not certify any official examination pattern: the repository currently has no owner-approved authoritative cycle/subject evidence.

The implementation reuses the existing pattern lifecycle, `PatternEvidence`, `PatternApproval`, QBMS publication records, deterministic `@net-slet/exam-rules` validators, `TestForm`/`TestFormQuestion` snapshots, and the student-safe attempts projection.

## Architecture and sequence

1. G04 remains the source-of-truth workflow for pattern evidence and approval. A readiness evaluator reports missing or invalid evidence without promoting `RESEARCH_ONLY` data.
2. G05 evaluates an exact examination/cycle/subject/language inventory. It requires published question revisions, active publication snapshots, an answer key, an explanation, syllabus mappings, provenance/rights evidence, and distinct review evidence.
3. G06 compiles selected inventory records through the deterministic rules package. The database stores the generated snapshot and SHA-256 hash, plus immutable question snapshots and pinned answer-key version IDs.
4. Publication is a guarded, transactional state transition. Synthetic QA forms are explicitly marked `qaOnly`; the existing student delivery guard permits them only outside production. Official publication remains blocked unless the exact pattern has authoritative evidence and separate administrative authorization.
5. The admin controller exposes readiness, inventory qualification, draft compilation, and publication endpoints behind existing authentication and role guards. Student discovery continues through the existing `/attempts/forms` safe projection.

## Acceptance criteria

- Research-only or incomplete pattern evidence is never reported as officially publishable.
- Inventory qualification is exact-scope, deterministic, duplicate-free, and rejects unpublished or rights-incomplete questions.
- A compiled form has a stable snapshot hash, immutable question snapshots, and one answer-key reference per selected question.
- Draft and publish transitions are idempotency-safe and cannot publish a stale or ineligible form.
- Candidate-facing projections contain no answer keys, explanations, provenance, reviewer identity, or unpublished text.
- Unit tests cover G04 evidence guards, G05 qualification failures, G06 deterministic snapshots, QA-only publication, and student discovery compatibility.

## Risks and follow-up

The primary release risk is external academic evidence: no official UGC NET cycle/subject record is seeded or certified by this repository. A later release must add authenticated owner review and regression evidence before any official badge or strict official publication claim. Persistent candidate delivery remains dependent on the existing Stage B database authorization and migration recovery decision.

## Test plan

Run the exam-rules tests, API unit tests, typecheck, lint, and build. Integration and Playwright checks require isolated PostgreSQL/Redis services and are reported separately when those services are unavailable.
