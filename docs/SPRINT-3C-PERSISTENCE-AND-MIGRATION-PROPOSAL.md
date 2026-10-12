# Sprint 3C Persistence and Migration Proposal

This is a design proposal only. No Prisma schema, migration, active database, migration record or persistent volume was changed.

## Conceptual relational model

| Entity | Key and important constraints |
| --- | --- |
| `Test` | `id`; immutable reference to examination/cycle/subject/pattern version; unique business identity per released test version. |
| `TestForm` | `id`; unique `(test_id, seed/version)`; immutable `snapshot_hash`, blueprint/rule hash and generated timestamp. |
| `TestFormQuestion` | `id`; unique `(form_id, position)` and `(form_id, question_version_id)`; stores immutable question-version reference and section/group position. |
| `Attempt` | `id`, `owner_account_id`, `form_id`; revision integer; status; unique external idempotency start key per owner/form policy; owner index. |
| `AttemptSession` | `id`, `attempt_id`, configured session ID/sequence; unique `(attempt_id, session_key)`; persisted `started_at`, effective `deadline_at`, status and submitted/expired timestamps. |
| `AttemptAnswer` | unique `(attempt_session_id, question_version_id)`; selected option IDs JSON/normalized selection, review flag, revision and updated timestamp. |
| `AnswerSelectionEvent` | append-only `id`, attempt/session/question IDs, sequence, selected options, occurred time and idempotency key; unique `(attempt_id, command_type, idempotency_key)`. |
| `AttemptAuditLog` | append-only actor/action/status/revision/request correlation metadata; no answer keys or secrets. |
| `ScoreRun` | unique run ID and `(attempt_id, scoring_rule_hash, answer_snapshot_revision)`; status, integer-scaled totals and audit timestamps. |
| `Result` | one published/current result policy per attempt, unique attempt/run association; publication and rescoring lineage. |

Foreign keys should use restrictive deletes for authoritative history. Forms reference immutable question versions; attempts never re-read mutable drafts. Index owner/status, session deadline/status, answer event chronology and score-run attempt/status.

## Transaction boundaries

1. Start: verify released form, attempt eligibility and owner; create attempt/sessions/audit record atomically with start idempotency.
2. Answer: lock attempt row, check owner/status/deadline/revision/idempotency, write answer and append selection event/audit in one transaction, increment revision.
3. Session submit: lock attempt/session, re-check deadline and completeness, transition and audit atomically.
4. Final submit/expiry: lock all relevant sessions or use deterministic ordered locks, transition once, create an immutable finalization marker and audit event.
5. Score: read a consistent answer/event snapshot and immutable rule hash; create one score run idempotently. Result publication is a separate authorized action.

Use PostgreSQL `READ COMMITTED` with explicit row locks and bounded retry for serialization/deadlock errors, or document `SERIALIZABLE` for the finalization transaction. Never acknowledge a write before commit.

## Recovery and retention

Workers may retry expiry and finalization safely through idempotent commands; request-path deadline checks remain authoritative if workers are delayed. Backup/restore must preserve immutable forms, events, audit history and scoring lineage. Retention and deletion must distinguish student privacy obligations from examination-integrity retention and require product/legal approval.

## Migration gate

The proposal requires comparison against current Prisma models, a reviewed schema diff, isolated fresh/restore rehearsal and separate Stage B authorization before any active migration reconciliation. This increment intentionally stops before that gate.
