# Stage A isolated migration recovery rehearsal

Date: 2026-10-12. Branch: `migration-recovery/stage-a-20261012`. **Stage B is not authorized or performed.** The earlier pre-approval and readiness reports are historical snapshots; this report supersedes their Stage A test status, not their restrictions.

## Source and isolation evidence

- Sprint 2 source snapshot: `3c0235a` on `main`; initial recovery evidence: `d562b95`. The 15 original migration files remain in Git history and in the active migration directory. No original migration was rewritten.
- Reviewed staging scope: the only proposed branch additions are `recovery/stage-a/prisma.config.ts`, its baseline SQL and lock, this report, and two test-harness edits. Ignored `.env` files, backup, generated Prisma client, `node_modules`, build output and disposable probe are excluded. No secrets or student records are intentionally included in these files.
- Verified custom-format backup: `C:\Users\Antricore\AppData\Local\NET-SLET-recovery\netslet_dev_preapproval_20261012.dump`, 131,017 bytes, SHA-256 `E5CDA2FDF2A3F6C0BA651DF4FCEBE773B26875D475BC82BA550E8FBF05633729`.
- Active identity: Docker container `net-slet-dev-postgres-1`, database `netslet_dev`. Isolated PostgreSQL 17 container: `netslet-stage-a-rehearsal`, loopback port 55432, tmpfs storage, no active volume. Databases: `stage_a_fresh` and `stage_a_restored_final`. All experimental Prisma commands used `STAGE_A_DATABASE_URL`, never the active `DATABASE_URL`.

## Proposed baseline and migration results

The proposed PostgreSQL baseline is `recovery/stage-a/prisma/migrations/20261012000000_stage_a_consolidated_baseline/migration.sql` (SHA-256 `1C00968DC3690D35DD0507E8C24625AA093A3483B0B3ECC79EFD9553DFCF0E34`). It is a reviewed schema-only dump from the validated database, without `_prisma_migrations`, dump access directives or a session-level empty `search_path`. LF line endings preserve the six PL/pgSQL function definitions. Prisma 7.10.0 generated SQL alone would not capture all custom functions/triggers. This candidate is only in the recovery-specific migration path; the active application path is unchanged.

Fresh path: `prisma migrate deploy --config <recovery-config>` succeeded against `stage_a_fresh`; `prisma migrate status` reported up to date. Restored path: `pg_restore --no-owner --no-privileges --exit-on-error` restored the verified backup into `stage_a_restored_final`; supported `prisma migrate resolve --applied 20261012000000_stage_a_consolidated_baseline --config <recovery-config>` succeeded against that copy; `migrate status` reported up to date. No SQL was run against active `_prisma_migrations`. The restored copy retains 15 historical rows plus the resolved baseline row. Both paths then accepted an external, disposable additive migration `20261013000000_stage_a_future_additive_probe` through `migrate deploy`; the fresh and restored copies now have respectively 2 and 17 successful migration rows. The probe creates a UUID-keyed `StageAAdditiveProbe` table with a QuestionVersion foreign key and index. It is outside the repository and is not a release migration.

Catalog comparison, excluding `_prisma_migrations` and the additive probe, produced identical active/fresh/restored fingerprints:

| Object | Count | Definition fingerprint (MD5) |
| --- | ---: | --- |
| Application tables | 37 | — |
| Columns | 290 | `54c82c92f20762eb8594d9cbb37d0507` |
| Indexes | 98 | `a482d06ab4658cb7a37a07d8e674a215` |
| Constraints | 95 | `21973c11fa2ff8144759edc5cb08cbcd` |
| Functions | 6 | `618f4fc72fc964fd6a9ef6e996e84d59` |
| Triggers | 18 | `200e176f19922deaab1468cb7af5b6d9` |
| Enum labels | 121 | `71c19d3aa700b3f8439555c3c60a9aa9` |

With Prisma metadata, the original inventory is 38 tables, 99 indexes and 96 constraints. The PostgreSQL extension inventory also matched. The additive probe's extra objects are intentionally excluded from the baseline comparison.

Every application table row count and sorted-row fingerprint matched between active and the restored copy before regression writes. The four populated tables were `Account` 19 (`81781b2a795c208fab95dee825297002`), `AuditEvent` 46 (`8e9048282cc7cf98d2bfcfef104c0655`), `Jurisdiction` 8 (`c4a0f5020665c388629026650df1ec4b`) and `Session` 31 (`91bba6497e9156f7cdcffce8ecbe8624`). All other application tables had zero rows. The restored copy remained reserved for compatibility tests; browser fixture writes targeted the fresh copy.

## Regression evidence

| Command | Result |
| --- | --- |
| `pnpm verify:structure` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass: 5 rules tests, 52 API tests |
| `pnpm lint` | Pass |
| `pnpm test:integration` with isolated fresh URL and `STAGE_A_REHEARSAL=1` | Pass |
| Same integration command with isolated restored URL | Pass |
| `pnpm test:e2e` with isolated fresh URL | Pass: 4 browser tests |
| `pnpm smoke` with isolated fresh services ready | Pass: web, API live, API ready HTTP 200 |
| `pnpm db:generate` | Pass, Prisma Client 7.10.0 |
| `prisma migrate status --config <recovery-config>` on both copies | Pass: baseline path up to date |
| `git diff --check` | One trailing blank-line warning in the schema dump; retained to preserve the exact tested SQL checksum |
| `pnpm build` | Pass; repeat with `NODE_TLS_REJECT_UNAUTHORIZED=1` recorded separately |

An early `pnpm smoke` attempt timed out because the dev servers had not yet started; the ready-server rerun passed. The default host environment had `NODE_TLS_REJECT_UNAUTHORIZED=0`, which disables TLS verification; the final build validation explicitly sets it to `1`. Fix the host environment before any network-connected release operation. The browser suite covers Sprint 1 auth/catalogue and workspace access/lifecycle; it does **not** prove a complete authenticated Sprint 2 QBMS authoring, review, challenge and publication browser journey. Database integration checks cover immutable published content and audit-safe triggers, but additional end-to-end security/authorization acceptance evidence is still needed.

## Risks, rollback and Stage B checkpoint

Residual risks: a dump-derived baseline is tied to the validated PostgreSQL 17 schema and must be regenerated/reviewed for future schema changes; Prisma's migration status does not detect every custom-object drift; historical rows remain in the database even when the release migration directory is consolidated; and the current application's default migration directory still contains the original non-replayable ordering. No release should infer readiness solely from `migrate status`.

Proposed Stage B procedure, **only after separate product-owner and database-owner approval**:

1. Review this branch, SQL diff, source snapshot, backup retention and full QBMS acceptance evidence; approve a release artifact that switches the default migration path to the reviewed baseline while archiving the 15 original files in Git. Do not edit historical checksums or rows.
2. Schedule a write freeze and maintenance window. Verify active DB identity and pre-change backup checksum; take a new custom-format backup and restore-test it in a new isolated instance. Record all active migration names, checksums, row counts and catalog fingerprints.
3. On the **approved active target only**, first prove catalog and data equality to the reviewed baseline. With the approved release artifact and explicit target URL, run Prisma 7.10 `migrate resolve --applied 20261012000000_stage_a_consolidated_baseline --config <approved-release-config>`. This adds the baseline record; it must not replay baseline DDL onto an existing database. Never edit `_prisma_migrations` directly.
4. Run `migrate status`, catalog/custom-object comparison, data checks, auth/QBMS regression and smoke tests before reopening writes. Deploy a separately reviewed additive migration only after this gate passes.
5. If any gate fails, keep writes frozen. Preserve logs, then restore the verified pre-Stage-B backup to a new isolated/approved target and switch the service back using the DBA's recovery procedure. Do not attempt `migrate reset`, `db push`, direct history edits or persistent-volume deletion. If writes have resumed, stop and plan point-in-time recovery and data reconciliation before any rollback.

**Stage B recommendation: hold pending explicit approval and complete Sprint 2 authenticated end-to-end acceptance plus host TLS remediation.** Stage A demonstrates technical feasibility, not authority to reconcile active history or deploy. Do not merge this branch or touch the active database until that approval is recorded.
