# G13 — Result release and immutable rescore plan

## Scope

G13 adds an administrator-only, auditable result-publication path and a correction/rescore path without changing historical migrations or active databases. A result remains aggregate-only while `PENDING`; publication is an explicit authorized operation. A correction creates a new answer-key version and immutable correction record. A rescore creates a new `ScoreRun`, preserves the original run, records both answer-key references and updates only the active result pointer.

## Invariants

- Candidate access is ownership-scoped and never exposes answer keys, options, private review evidence or unreleased explanations.
- `TestFormQuestion.answerKeyVersionId` remains the original immutable scoring reference. A correction may be used only when it explicitly names that pinned key.
- Publication and rescore require an administrator, reason, approval reference and durable audit event.
- Publication is idempotent; rescore is idempotent by caller-supplied key and serialized by the attempt advisory lock.
- Historical score runs and correction records are append-only. The current `AttemptResult.scoreRunId` is the only active pointer.

## Delivery sequence

1. Add the forward-only governance migration and regenerate Prisma client.
2. Add API service/controller operations and unit tests for publication, correction, rescore, ownership and idempotency.
3. Add the development-only administrator result queue UI.
4. Run isolated Prisma replay, unit/integration/browser checks, typecheck, lint and build.

## Acceptance criteria

- Pending aggregate disclosure is explicitly documented and tested.
- Published results expose the existing approved learning path only after publication.
- A later key version cannot change an existing score without an authorized correction and rescore.
- Concurrent publication/rescore requests produce one durable outcome and a traceable audit lineage.
- No active database, historical migration or production endpoint is changed by this increment.

## Deferred boundary

G13 does not merge, deploy, or activate production persistence. Product-owner/database-owner approval and isolated migration validation remain prerequisites for release.
