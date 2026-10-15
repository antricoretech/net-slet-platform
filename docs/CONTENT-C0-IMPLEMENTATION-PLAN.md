# Content Track C0 Implementation Plan

## C0.B increment

Implement the pure content-quality boundary first, then connect it to administrative review and later service adapters. The boundary reuses C0.A identity, publication and strict-mock contracts and does not alter Prisma, migrations or production APIs.

## Sequence and acceptance criteria

1. Add deterministic quality, answer-trust, rights, translation, challenge and duplicate contracts.
2. Add exact-scope inventory counts and coverage gaps.
3. Add a versioned synthetic JSON audit with size/schema checks and no side effects.
4. Add unit tests for every gate and edge case.
5. Keep the readiness dashboard development-only and publication-disabled.

Acceptance requires fail-closed eligibility, no answer-key leakage, deterministic reports, preserved historical lineage, and passing package and repository validation.

## Deferred integration

Database-backed inventory ingestion, administrative write controls, publication commands, external licensing services and active migration work remain deferred to a separately approved increment.

## C0.C closeout increment

The C0.C release-governance boundary composes ExamDNA, content quality, deterministic form generation and scoring-policy validation. It produces a versioned qualification trace, an immutable release-manifest fingerprint and a publication decision that never enables publication automatically. Synthetic fixtures are conditional and non-authoritative.

Remaining release-enabling requirements are authoritative cycle evidence, real approved inventory, item-level rights and translation approvals, distinct SME/rule-owner/content-owner approvals, persistence and audit integration, operational recovery evidence, CI/CD acceptance and a separately authorized publication workflow.
