# Sprint 2 acceptance report

Date: 2026-10-12

## Executive decision

**Sprint 2: PARTIALLY COMPLETE / CONDITIONAL GO.** Functional taxonomy, authoring, trust workflow, workspace and challenge queue work is present and tested. Production deployment is blocked by fresh-database migration replay.

**Sprint 3 internal development: CONDITIONAL GO.** CBT implementation may be planned, but must not be released until migration recovery and the listed P1 security/QA work are closed.

**Production readiness: NO-GO.** The migration replay failure is a critical release-engineering blocker.

## Traceability

| Area | Status | Evidence | Tests / limitation | Priority |
|---|---|---|---|---|
| 2A syllabus taxonomy | PASS | `apps/api/src/syllabus` and versioned models | Integration and API tests | — |
| 2B eight question types | PASS | `question.validation.ts` and workspace editor | API tests and production build; broader UI type matrix recommended | P2 |
| 2B answer/explanation versioning | PASS | Versioned answer-key and explanation models | Review tests and integration checks | — |
| 2C review/separation of duties | PASS | `question-review.service.ts` and trust controller | 51 API tests and lifecycle E2E | — |
| 2C publication immutability | PASS | PostgreSQL triggers and publication snapshot | Integration immutability checks | — |
| 2C provenance/licensing | PASS | Review-service publication gates | Review service tests | — |
| 2C student-safe publication | PASS | Public projection in review service | Expand answer-leak assertions | P1 |
| 2D faculty/admin workspace | PASS | `apps/web/src/app/workspace` and `qbms-api.ts` | Build, lint and unauthorized Playwright route test | — |
| 2E challenge queue | PASS | Challenge service/controller and workspace queue | Queue authorization unit coverage; full journey remains | P1 |
| Migration reproducibility | FAIL | ADR-0009 and disposable replay | Fresh replay fails with `42P01` | P0 |
| CI release reproducibility | PARTIAL | `.github/workflows` reviewed | Not release-ready while replay fails | P0 |
| Official exam certification | NOT APPLICABLE | Research-only controls enforced | No official patterns certified | — |

## Security and integrity

The challenge queue scopes student results by reporter, exposes no reporter identity in queue/detail projections, restricts triage/resolution to SME/Admin guards, keeps published revisions as challenge targets, and does not modify answer keys. Existing question publication triggers cover revision and child-record immutability. A complete authenticated student-to-staff challenge journey and adversarial answer-leak matrix remain P1 validation work.

## Migration evidence

The active development database was not reset, its persistent volume was not removed, and `_prisma_migrations` was not edited. The exact failing statements are the `EmailVerificationToken` and `PasswordResetToken` alterations in `20261011222455_syllabus_taxonomy_foundation/migration.sql`; the tables are created only by `20261012000800_auth_lifecycle_tokens`. Current status reports 15 migrations applied. See [ADR-0009](decisions/ADR-0009-migration-repair-proposal.md) for the controlled baseline/reconciliation decision path.

## Verification record

Passed during this acceptance pass: structure verification, TypeScript, lint, production build, 51 unit/service tests, database integration checks, Prisma generation, active-database migration status, Docker PostgreSQL/Redis health, smoke checks after the cold Next.js compile, and 4 Playwright tests.

The fresh migration replay was intentionally executed and failed as documented. A full authenticated Sprint 2E browser matrix, accessibility audit, and preserved-database baseline rehearsal remain outstanding.

## Prioritized backlog

- **P0:** Approve and execute a separately reviewed migration baseline/reconciliation procedure; prove empty and preserved-database compatibility.
- **P1:** Add authenticated student/SME/reviewer/admin/challenge Playwright journeys and answer-leak/adversarial API tests.
- **P1:** Make CI fail explicitly on clean migration replay and publish migration evidence.
- **P2:** Add challenge assignment semantics if operational ownership requires more than `IN_REVIEW`.
- **P2:** Add automated accessibility and measured performance budgets for the workspace.

Sprint 3 CBT remains planning-only for Sprint 2E; no attempt, deadline or answer-persistence engine is implemented here.
