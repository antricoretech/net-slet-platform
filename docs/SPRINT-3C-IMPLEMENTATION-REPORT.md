# Sprint 3C.0 Implementation Report

## Delivered

- Pure attempt creation, initialization, ownership checks and state transitions.
- Configured session activation, trusted-clock deadlines, sequential locking and expiry checks.
- Idempotent answer save/clear commands with deterministic conflicting-retry and stale-revision errors.
- Mark-for-review state and answer-selection chronology.
- Session and final submission commands with replay-safe finalization.
- Typed proposed attempt API request/response/error contracts; routes remain unregistered.
- Integer-scaled scoring interface with negative marking, exact-match alternatives, dropped questions and section ceilings.
- Web adapter extended with server-created attempt and future response capabilities while keeping the preview adapter null/non-persistent.

## Tests

`packages/exam-rules/src/attempt-engine.test.ts` covers creation, trusted deadlines, ownership, stale writes, idempotency, clear/review, expiry, session/final submission and reproducible scoring. The existing Sprint 3A tests remain unchanged.

## Explicitly not delivered

No Prisma schema or migration, repository implementation, NestJS controller/module registration, active endpoint, PostgreSQL transaction, Redis queue, durable answer persistence, result publication or production readiness claim.

## Remaining gate

The next increment requires database-owner/product-owner review of the persistence proposal, comparison with the current Prisma schema, isolated migration rehearsal under the existing Stage B process, and explicit authorization before implementation of production attempt persistence.
