# Database recovery pre-approval report

Date: 2026-10-12

## Recommendation

**NOT READY FOR STAGE B APPROVAL.** Stage A was executed on branch `migration-recovery/stage-a-20261012`. Backup/restore and direct PostgreSQL baseline evidence now exist, but Prisma 7.10.0 native baseline deployment still returns `P1014` for the dump-derived candidate and no preserved production-like copy exists. The active database and migration history were not changed.

## A. Repository preservation assessment

The repository is on `main` with the Sprint 2 implementation uncommitted. The worktree contains 22 changed/untracked paths. Existing source, migrations and database records were preserved. No reset, rebase, staging, commit, migration edit or branch switch was performed.

Prisma is 7.10.0, Node.js is 24.20.0, pnpm is 10.19.0, and the migration provider lock is PostgreSQL. Environment files are ignored by `.gitignore`; the inspected `apps/api/.env` and `apps/web/.env.local` are not tracked. No credentials were added to the repository.

## B. Git snapshot and proposed commit plan

After owner review, use a dedicated approved branch and split commits by concern:

1. `feat(qbms): add taxonomy authoring and trust workflow` — `apps/api/prisma/schema.prisma`, the four Sprint 2 migration directories, `apps/api/src/syllabus`, `apps/api/src/questions`, `apps/api/src/app.module.ts`, API documentation and ADR-0006 through ADR-0008, plus the integration test changes.
2. `feat(web): add faculty administrator qbms workspace` — `apps/web/src/app/workspace`, `apps/web/src/lib/qbms-api.ts`, workspace styles, and the protected workspace Playwright test.
3. `docs(recovery): add migration gate and acceptance evidence` — ADR-0009, the Sprint 2 acceptance report, this report, the readiness gate, and frontend workspace documentation.

Before committing, review each diff, verify no `.env`, dump, generated Prisma client, build output or test artifact is included, then run the full quality gate. No commit is created by this assessment.

## C. Verified backup and restoration evidence

Active identity was read-only verified as database `netslet_dev`, user `netslet`, PostgreSQL `17.11`, data directory `/var/lib/postgresql/data`.

Backup:

- File: `C:\Users\Antricore\AppData\Local\NET-SLET-recovery\netslet_dev_preapproval_20261012.dump`
- Format: PostgreSQL custom format, gzip-compressed
- Size: 131,017 bytes
- SHA-256: `E5CDA2FDF2A3F6C0BA651DF4FCEBE773B26875D475BC82BA550E8FBF05633729`
- `pg_restore --list`: 291 TOC entries
- Permissions: inheritance removed; current user has full control

The archive was restored into isolated database `netslet_preapproval_restore_20261012`. Source and restore both reported 38 tables, 99 indexes, 96 constraints, 6 functions, 18 non-internal triggers and 15 Prisma migration rows. `pg_stat_user_tables` representative estimates matched: Account 19, AuditEvent 46, Jurisdiction 8, Session 31, and zero rows in the currently empty question/publication/challenge tables. Index definitions and constraint definitions had zero comparison differences. Trigger and function definitions had zero comparison differences. The isolated database and temporary container archive were removed afterward; the active database still reports 15 migration rows.

The external Stage A candidate is retained at `C:\Users\Antricore\AppData\Local\NET-SLET-recovery\stage-a-20261012`. It excludes `_prisma_migrations` and removes PostgreSQL 17 `\\restrict` directives. Direct `psql` application succeeded on a fresh disposable database and an additive table/index probe succeeded. Prisma 7.10.0 `migrate deploy --config` recognized the candidate but returned `P1014` referring to the Prisma metadata table; this candidate is not accepted as a Prisma baseline until corrected.

## D. Database object inventory

The active public schema contains 38 tables, including Account, Session, AuditEvent, catalogue/pattern tables, syllabus tables, question/revision/answer/explanation/provenance/licence tables, review/publication/challenge tables, token tables, and `_prisma_migrations`.

It contains 18 enums, including AccountRole, AuditEventType, ChallengeCategory, ChallengeStatus, QuestionType, QuestionVersionStatus, RightsStatus, SyllabusStatus and TranslationStatus. It contains 6 public functions: `pattern_version_for_child`, `prevent_published_pattern_child_mutation`, `prevent_published_pattern_mutation`, `prevent_published_question_child_mutation`, `prevent_published_question_revision_delete`, and `prevent_published_question_revision_mutation`.

The 18 custom triggers protect published exam-pattern records and children, question revisions, question options, answer keys, explanations, syllabus mappings, translations, provenance and licences. These functions/triggers are handwritten SQL dependencies and are not safely represented by Prisma’s generated datamodel alone. The active database has 99 indexes and 96 constraints, including foreign keys, primary keys, unique constraints and the immutability-related protections.

## E. Root-cause confirmation

The exact failure remains the two token-table `ALTER TABLE` statements in `20261011222455_syllabus_taxonomy_foundation/migration.sql`; the tables are created by later `20261012000800_auth_lifecycle_tokens`. A complete migration dependency scan found no other external forward table references after accounting for tables created within the same migration.

## F. Proposed consolidated baseline

Option A remains preferred, but only on an approved recovery branch: derive a schema-only baseline from the known-good database, explicitly preserve enums, functions, triggers, indexes, constraints and data transformations, archive the 15 existing migrations, and document the old-to-new history mapping. The direct SQL candidate produced 37 application tables, 98 application indexes, 95 application constraints, 6 functions and 18 triggers, matching the known-good application schema; the three-object difference is Prisma metadata. Prisma-native baseline deployment remains unverified because of the P1014 result.

Option B, history reconciliation, is not currently approved because it has not been proven safe for fresh installs and already-populated databases. Option C, defer remediation while keeping the active database unchanged, is the current safe state.

## G. Isolated validation completed and pending

Completed:

- custom-format backup and `pg_restore --list`;
- isolated restore and object/data comparison;
- disposable clean migration replay, which reproduced `P3018 / 42P01`;
- Prisma schema diff against the active datasource, which reported no difference;
- database integration tests and published-question immutability checks.

Not verified:

- compatibility against a separately preserved production-like database copy;
- Prisma-native clean installation using a replacement baseline;
- future additive migration after a replacement baseline;
- authenticated full Sprint 2E browser journeys and automated accessibility audit.

## H. Compatibility risks

The main risks are loss of custom trigger/function definitions in a generated-only baseline, incorrect `_prisma_migrations` reconciliation, data transformation omissions, enum or constraint drift, and divergence between existing installations and fresh installs. No proposed baseline should be applied until these are tested against the backup restore.

## I. Reconciliation plan

Required sequence: obtain owner approval; create an approved migration-recovery branch; preserve the existing migration archive and backup; generate and manually augment the candidate baseline; replay it into an empty database; restore the backup into a separate database and compare all objects/data; test the next additive migration; execute application/integration/immutability/authorization checks; then prepare a maintenance deployment. Any command that marks migration history resolved, replaces the migration path, or changes `_prisma_migrations` requires explicit approval and is not included in this assessment.

## J. Rollback procedure

Before deployment, verify the custom-format backup checksum and restore test. If any post-deployment checkpoint fails, stop application writes, preserve logs/audit evidence, restore the verified backup to the approved target using `pg_restore`, verify object counts, migration status and application startup, then reopen the gate. Do not use `prisma migrate reset`, `prisma db push`, direct `_prisma_migrations` edits, or persistent-volume deletion.

## K. Outstanding blockers

- **P0:** Clean migration replay remains broken.
- **P0:** Candidate baseline requires correction before Prisma-native deployment can be accepted.
- **P0:** No approved recovery branch or product-owner/database-owner authorization.
- **P1:** No preserved production-like database copy has been authorized for compatibility testing.
- **P1:** Full authenticated Sprint 2E browser/security matrix remains incomplete.
- **P2:** Accessibility and performance evidence is not yet formalized.

## L. Approval checklist

Product owner and database owner must explicitly approve: the baseline-vs-reconciliation decision; the recovery branch and commit set; backup retention and restore owner; maintenance window; credentials/access; treatment of the 15 historical migrations; custom SQL inventory; empty and restored-copy evidence; next-migration test; rollback owner; and production deployment gates.

Until every item is approved and the replacement history passes Prisma-native isolated validation, the recommendation remains **NOT READY FOR STAGE B APPROVAL**.
