# Stage B Integrated Development Plan

**Branch:** `feature/stage-b-integrated-development`

**Base:** feature/content-c0-examdna at `8deb3ab`, with recovery CI repair `3589239` merged
**Scope:** local implementation only; active database reconciliation remains prohibited

## Architecture

The existing `packages/exam-rules` package remains the deterministic domain boundary. PostgreSQL/Prisma becomes the authoritative store for published test-form snapshots, attempts, sessions, answer revisions/events, score runs, results and audit records. NestJS owns authorization, transaction boundaries and persistence adapters. Redis is optional coordination only and is not required for correctness.

## Implementation sequence

1. Add Prisma models and a forward-only migration for immutable test forms, durable attempt state, score runs, aggregate results and release-gated explanations.
2. Add an API attempt service that maps the existing `AttemptAggregate` contracts to transactional persistence.
3. Add authenticated attempt routes with ownership, idempotency, stale-revision and deadline guards.
4. Add unit tests for persistence command decisions using a mocked Prisma boundary and domain tests for edge cases.
5. Generate Prisma Client and validate the migration against a newly created isolated database, never `netslet_dev`.
6. Add deterministic scoring and candidate-safe result retrieval from immutable form snapshots and persisted answer events.
7. Connect the authenticated student CBT page to the API contract only after the backend checks pass; retain the in-memory preview as a separate development fixture.
8. Persist student-owned learning evidence, Mistake Mine entries, topic performance and revision recommendations after scoring; expose only candidate-safe history projections.
9. Validate the authenticated browser flow against the isolated API on port 4400, including reconnect, expiry, ownership and duplicate-submit paths.

## Acceptance criteria for this increment

- Published test-form snapshots are versioned and cannot be changed through the attempt service.
- Attempt creation is authorized, idempotent and tied to the authenticated account.
- Session deadlines are server-generated and preserved on resume.
- Acknowledged answer writes are transactional, revision-checked and idempotent.
- Ownership failures, stale writes, expired sessions, duplicate submissions and answer-key leakage are tested.
- Score runs and result rows are created at most once for a finalized attempt.
- No API response exposes answer keys or unpublished question data.
- Prisma Client generation and typecheck pass against the updated schema.
- An isolated native Prisma replay and authenticated HTTP lifecycle test pass without targeting `netslet_dev`.
- Final submission, scoring and result persistence share the primary Prisma transaction; repeated scoring remains idempotent.
- Learning projections are written in the scoring transaction and rebuilt deterministically for an attempt; account history is ownership-scoped.
- Production Next.js build and Playwright E2E pass against the isolated Stage B services without modifying protected cold-start evidence.

## Known risks and boundaries

- The repository has a legacy migration-order defect; the new migration must be tested after the approved consolidated baseline in an isolated database.
- No official examination pattern is certified by this repository; local forms must be synthetic or explicitly research-only.
- Gate C QA approval and full R3.7 restoration evidence remain outstanding.
- Result release authorization and approved production publication remain outside this local QA-only increment; synthetic forms are not official examination content.
- Active `netslet_dev` is not a development target for this increment.

## Test plan

Run focused exam-rules/API tests first, then `pnpm db:generate`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`. Run `STAGE_B_CBT_E2E=1 STAGE_B_EXTERNAL_SERVERS=1 STAGE_B_API_PORT=4400 pnpm test:e2e -- tests/e2e/stage-b-cbt.spec.ts` only with a positively identified disposable database. Record infrastructure blockers separately from code failures.
