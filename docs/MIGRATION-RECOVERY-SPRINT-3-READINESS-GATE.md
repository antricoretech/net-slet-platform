# Migration recovery and Sprint 3 readiness gate

Date: 2026-10-12

## Decision

**Migration recovery: NOT APPROVED FOR ACTIVE-DATABASE CHANGE.** Stage A has produced verified backup/restore and direct PostgreSQL baseline evidence. The dump-derived candidate still fails Prisma 7.10.0 native deployment with `P1014`, and no preserved-database compatibility rehearsal has been authorized.

**Sprint 3: CONDITIONAL GO for architecture and test planning only; NO-GO for database/application implementation.** No Sprint 3 entities, migrations or modules were added.

**Production: NO-GO.** CI currently invokes `prisma migrate deploy`, and a clean replay fails before the token migration.

## Root cause

Lexicographic migration order applies `20261011222455_syllabus_taxonomy_foundation` before `20261012000800_auth_lifecycle_tokens`. The former contains:

```sql
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "PasswordResetToken" ALTER COLUMN "id" DROP DEFAULT;
```

The latter creates those relations. A fresh replay therefore fails with PostgreSQL `42P01: relation "EmailVerificationToken" does not exist`. A dependency scan of all migrations found no other external forward table references after accounting for tables created within the same migration.

## Active database evidence

Read-only inspection found 15 successful `_prisma_migrations` rows, no rolled-back rows, and the following catalog inventory:

- 38 tables
- 99 indexes
- 96 constraints
- 6 public functions
- 18 non-internal triggers

The active database has no Prisma schema diff against `schema.prisma` using Prisma 7.10.0 `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`. This comparison does not replace custom-object inspection; the immutability triggers and functions were separately inventoried.

Migration checksums were recorded read-only from `_prisma_migrations`:

| Migration | Checksum prefix |
|---|---|
| 20261011192043_init_exam_catalog | a3b4e736979617d0… |
| 20261011194905_init_exam_catalog | 856e1ce7ce210e41… |
| 20261011195807_init_exam_catalog | c4fea7808634d2ad… |
| 20261012000100_pattern_lifecycle | d67574741768b6f6… |
| 20261012000200_pattern_rejected | 849dd4e0b9d5fa3b… |
| 20261012000300_structured_pattern_architecture | e23ae6b5faa6d3ba… |
| 20261012000400_pattern_review_state | 63c22f3c6234463a… |
| 20261012000500_pattern_child_immutability | a6cbde7b82ecdc32… |
| 20261012000600_fix_pattern_trigger | 445709d510c8e24c… |
| 20261012000700_quote_pattern_trigger_columns | b8606ccf23ca67ea… |
| 20261012000800_auth_lifecycle_tokens | d73d5328f05b315f… |
| 20261011222455_syllabus_taxonomy_foundation | ae024f1377b56727… |
| 20261012100000_question_authoring_engine | 985b602dc6c4d0fd… |
| 20261012100100_question_child_immutability | 589daf4152e6342d… |
| 20261012100200_question_review_publication_trust | dcc3e9201d98c176… |

The exact values recorded from the active database are:

```text
20261011192043_init_exam_catalog                 a3b4e736979617d02a71e1035e0f2046d7b6678df306ddb6e5ec7b31779e2f59
20261011194905_init_exam_catalog                 856e1ce7ce210e41d008b139b9541dea1cc7675e9e33dd200b1b71fa92d06541
20261011195807_init_exam_catalog                 c4fea7808634d2ad2d6a4415cc31fff7c549537e7a4ae96e5e40e593ef4396c0
20261012000100_pattern_lifecycle                 d67574741768b6f66015ccae42386f84beb67f2102151dc7e7ca140963171290
20261012000200_pattern_rejected                  849dd4e0b9d5fa3b969c3a6bbb87b617a5711ceee24e3527e963391b5912879c
20261012000300_structured_pattern_architecture   e23ae6b5faa6d3ba2090c7f70c1c713731dee73907d10aee52ddcd542874a868
20261012000400_pattern_review_state              63c22f3c6234463affe06931f151ed0f19d5cd1f4f2fa26f27ae4440444e3d80
20261012000500_pattern_child_immutability        a6cbde7b82ecdc32e4de3a04a048b74eb063ec1aa6452cdacb721e58291faf9a
20261012000600_fix_pattern_trigger               445709d510c8e24c45bd9b07a8d8fe7bcb101d6d36b007e41aecdde821f8c644
20261012000700_quote_pattern_trigger_columns     b8606ccf23ca67ea37db6cbbc184ffb2fb6b915b9be46ccfdcfe00fe0449e35b
20261012000800_auth_lifecycle_tokens             d73d5328f05b315fb7f99b90f627a91c8c416c4fb38de789502f6463ee414595
20261011222455_syllabus_taxonomy_foundation      ae024f1377b56727d7b79d47e174b2954a4aba5b9272aa2623c97b1c31d26ca7
20261012100000_question_authoring_engine         985b602dc6c4d0fd5e419d72c65db2685dc869ece7d8f0f708a2cb088876409b
20261012100100_question_child_immutability       589daf4152e6342d0aacda23d056c4b96fbe394aac0810735d5bc37238cce47f
20261012100200_question_review_publication_trust dcc3e9201d98c176ac759c88396995680aefbaacfc80b826566d61b7cbb6ab4f
```

The migration directory also contains `migrations/migration_lock.toml` with the PostgreSQL provider.

## Isolated replay evidence

A disposable database `netslet_sprint2e_replay_20261012` was created, replayed, and dropped. The replay applied the first three migrations, then failed at the known syllabus migration with `P3018` / `42P01`. The active development database and persistent Docker volumes were not reset, dropped or edited.

Because clean replay failed, the following validations are **not passed**: preserved-database copy compatibility, future additive migration execution from a clean install, and full equivalence of a proposed baseline. No claim of migration recovery validation is made.

## Recovery options

### A — Controlled consolidated baseline: preferred, pending approval

On a separate release branch, generate a baseline from a verified schema-only export of the known-good database, then explicitly re-add all custom SQL: enums, functions, triggers, indexes, constraints, and data transformations. Preserve the 15 historical migrations in an archive and document the mapping from old history to the baseline. Prove the baseline against an empty database and a restored copy of the active database before deployment.

### B — History reconciliation: not currently safe

Reconciliation could be considered only if Prisma’s supported procedure for the installed 7.10.0 CLI is tested on a release branch and preserves both existing installations and fresh replay. It must not edit applied files, manually modify `_prisma_migrations`, or mark migrations applied without schema proof. Current evidence is insufficient to approve it.

### C — Deferred remediation: current recommendation for active data

Keep the active database unchanged, block production release, and require product-owner/database-owner approval for either a baseline or supported reconciliation. This is the only safe option while a preserved copy and approved release branch are unavailable.

## Proposed release and rollback procedure

1. Obtain owner approval for the selected strategy and freeze migration changes.
2. Take and verify a logical backup: `pg_dump --format=custom --file=netslet_pre_recovery.dump "$DATABASE_URL"`.
3. Restore to a disposable copy; compare tables, columns, foreign keys, indexes, constraints, enum values, functions, trigger definitions, row counts and checksums.
4. Build the candidate baseline on an isolated branch; do not alter the existing migration files.
5. Run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm --filter @net-slet/api exec prisma migrate deploy` against an empty database and the restored copy.
6. Run `pnpm test:integration`, publication immutability tests, authorization tests, application startup, and smoke checks.
7. Review `prisma migrate status`, schema/object comparison output, backup restore result and audit-event preservation.
8. Obtain release approval, schedule maintenance, take a fresh backup, and execute the approved deployment runbook.
9. Roll back by restoring the verified backup if any checkpoint fails; do not use `migrate reset`, `db push`, or direct `_prisma_migrations` edits.

## Sprint 3 architecture-only plan

The next increment should introduce no implementation until migration recovery is approved. Proposed bounded sequence:

1. `TestForm`/`TestFormVersion` reference an approved immutable exam-pattern version and approved question-version IDs; assembly records the exact question and rule snapshots.
2. `Attempt` owns a student, test-form version, status, server deadline and idempotency scope; `AttemptSession` records reconnect/session state.
3. `AttemptAnswer` stores durable answer mutations with question-version reference, client idempotency key, server sequence and optimistic revision. PostgreSQL is authoritative; Redis is only cache/queue support.
4. Server-authoritative deadline checks govern save, auto-expiry and finalization. Reconnect never grants time.
5. Deterministic scoring consumes immutable snapshots; results and any authorized rescoring are versioned and audit-visible.
6. Security boundaries prevent answer-key leakage, cross-student access, cross-exam mixing and unauthorized result reveal.
7. Load testing must cover concurrent answer saves, retries, stale revisions, expiry races, finalization and reconnect recovery against PostgreSQL.

Prioritized backlog: migration baseline approval (P0), preserved-copy rehearsal (P0), immutable test-form snapshot design (P1), durable answer idempotency/concurrency design (P1), deadline/finalization state machine (P1), deterministic scoring contract (P1), load/security test plan (P2).

## Formal change-approval request

Approval is requested from the product owner and database owner for a separate release branch and disposable/preserved-copy rehearsal of **Option A controlled baseline**, with Option B reconciliation evaluated in parallel. Approval must explicitly authorize migration-history treatment, backup/restore testing, maintenance window and rollback owner. Until granted, this repository remains migration-recovery **NO-GO** and Sprint 3 remains architecture-only.
