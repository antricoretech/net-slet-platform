# Sprint 3C.0 Attempt Engine Design

## Scope

This increment implements the persistence-independent attempt aggregate, answer-command rules, session timing rules, candidate-safe API contracts and integer-scaled scoring interfaces. It deliberately does not register NestJS attempt routes, add Prisma models, apply migrations or acknowledge durable writes.

## Aggregate and command model

`packages/exam-rules/src/attempt-engine.ts` is a pure command layer. An attempt has an immutable form ID, owner ID, lifecycle revision, session states, answer states, answer-selection chronology and an idempotency fingerprint ledger. Commands return a new frozen aggregate rather than mutating state.

The lifecycle is `CREATED -> READY -> IN_PROGRESS -> SUBMITTED`, with expiry represented by a terminal `EXPIRED` state/session. Session activation calculates its deadline from an injected trusted clock and the configured session duration. Existing deadlines are preserved on resume. `SEQUENTIAL_LOCKED` sessions require prior sessions to be submitted; continuous and independent timing are configuration-driven.

Every answer command requires the owner, active session, expected aggregate revision, question/session binding, valid option IDs and an idempotency key. A repeated key with the same fingerprint is a no-op replay; a different payload produces a deterministic conflict. A stale expected revision is rejected. Expired, closed or unauthorized commands are rejected. Review state is separate from answer selection and clear-response preserves review state.

## Timer and authority model

The browser may display a countdown, but only the server-side command boundary may evaluate `deadlineAt`. At or after the effective deadline, answer and submit-session commands fail. Resumption reads the existing deadline; it never adds time. Accommodation-adjusted deadlines belong in the future persisted session record after authorization and audit validation.

## Scoring boundary

`scoring.ts` accepts version-locked question rules and answer-selection events. It uses integer-scaled marks, supports single-select, exact-match/multi-select, accepted alternatives, penalties, dropped questions and per-section attempt ceilings. Chronology is retained and ceilings count first eligible attempted questions in event order. Answer keys are scoring inputs only and are not part of candidate contracts.

## Security

The proposed API response types expose form IDs, state, revisions and selected candidate answers only. They do not contain correct answers, explanations, reviewer metadata or scoring keys. Ownership is required at every command. The API error taxonomy separates authentication, authorization, not-found, conflict, expiry and invalid-request outcomes without leaking private content.

## Persistence boundary

The future repository implementation must execute answer acceptance, answer state, selection event, attempt revision and audit record in one PostgreSQL transaction. Redis may coordinate/cache but cannot be the source of truth. A unique `(attempt_id, idempotency_key, command_type)` constraint and an attempt revision check must be enforced by the database, with row locking or serializable retry policy documented before implementation.
