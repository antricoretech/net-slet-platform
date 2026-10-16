# Sprint 3 G07 — Student CBT Navigation and Review State

## Scope

G07 completes the student-facing navigation layer on top of the existing server-persisted attempt, immutable test-form snapshot, deadline and scoring contracts. It does not add persistence tables, change scoring rules, or run migrations.

## Design

- Paper/session and section controls are derived from the published form snapshot and its ordered session definitions.
- Answers, clear responses and review flags use the existing `PUT /attempts/:id/answers/:questionId` transaction.
- `markedForReview` is included in the idempotency fingerprint and persisted with the answer revision. A review-only operation therefore has the same ownership, stale-revision, expiry and retry guarantees as an answer save.
- Refresh and reconnect hydrate answer and review state from the server; browser-local state is presentation-only.
- The palette exposes `NOT_VISITED`, `VISITED_UNANSWERED`, `ANSWERED`, `MARKED_REVIEW_UNANSWERED` and `MARKED_REVIEW_ANSWERED` with accessible labels and visible symbols.
- Submission remains confirmation-gated and uses the existing server deadline/finalization path. G07 does not alter scoring or result-release policy.

## Acceptance criteria

1. Paper, section, previous, question selection and save/next controls retain the same attempt and server deadline.
2. Review flags survive refresh/reconnect and are safe under retries and stale revisions.
3. Clear response writes an empty selection durably while retaining the selected review state.
4. Late writes remain rejected by the existing server expiry guard.
5. Five palette states and a synthetic 150-question navigation order are covered by automated tests.
6. No active database, Prisma schema, historical migration, deployment or production API is changed.

## Validation plan

Run `pnpm db:generate`, `pnpm verify:structure`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm test:integration`, and the authenticated Playwright split suites against isolated services only. CI remains the final clean-worktree validation for Postgres/Redis and authenticated browser behavior.

## Follow-on dependencies

Persistent CBT attempts, transactional answer saving, authoritative timers and final submission are already represented by the integrated Stage B foundation. G07 must merge before expanding learner practice history, Mistake Mine evidence, PrepPilot persistence or L0.C spaced retrieval workflows.
