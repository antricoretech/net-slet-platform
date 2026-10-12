# Project NET/SLET v2.2 — Stage B Formal Migration-Reconciliation Approval Request

**Status:** NOT READY FOR STAGE B APPROVAL  
**Prepared:** 2026-10-12  
**Recovery branch:** `migration-recovery/stage-a-20261012`  
**Current HEAD:** `b47fe4e` (`test(qbms): validate Sprint 2 and document Stage B gate`)

## 1. Requested decision

Product-owner and database-owner approval is requested for a later, separately scheduled Stage B migration-history reconciliation. This document is an approval package, not an authorization to execute. No Stage B command has been run.

The current decision is **NOT READY FOR STAGE B APPROVAL** because the recovery candidate is not committed, no GitHub remote or authenticated GitHub CLI is available, remote CI has not executed, the legacy migration track remains freshly broken, and owner sign-offs are absent.

## 2. Project and change summary

The project’s active PostgreSQL database, `netslet_dev`, contains the original 15 applied Prisma migrations. The repository also contains a Stage A consolidated baseline intended for future reconciliation. The baseline has been deployed and tested only against isolated databases.

This proposal would reconcile Prisma’s migration history to the reviewed baseline metadata after a controlled backup, schema/data comparison and write freeze. It must not replay baseline DDL over the populated active database.

No production database, active `_prisma_migrations` rows, persistent volume, or source migration file has been modified.

## 3. Business and technical justification

The default 15-migration fresh replay is not reproducible on a clean database because migration `20261011222455_syllabus_taxonomy_foundation` references `EmailVerificationToken` before that table exists (`P3018` / PostgreSQL `42P01`). The tested consolidated baseline provides a reproducible fresh-install path while preserving the existing active data and original migration history for rollback and audit.

## 4. Root cause

### Legacy migration failure

The original migration sequence has an ordering dependency defect: the syllabus migration executes before the authentication-token table is created. This remains visible in `.github/workflows/ci.yml` and is intentionally not concealed or rewritten.

### Cold-start finding

The earlier intermittent browser failures were strongly associated with test-process startup ordering: Playwright waited on the web server while API and web started in parallel, and existing processes could be reused. API-first readiness and compiled-API cold trials subsequently passed 10/10. The historical QBMS HTTP 500 has no captured backend exception stack and is therefore not claimed to have a fully proven application-level root cause.

## 5. Tested recovery approach

- Consolidated baseline: `recovery/stage-a/prisma/migrations/20261012000000_stage_a_consolidated_baseline/migration.sql`
- Baseline SHA-256: `1C00968DC3690D35DD0507E8C24625AA093A3483B0B3ECC79EFD9553DFCF0E34`
- Prisma 7.10-compatible recovery configuration: `recovery/stage-a/prisma.config.ts`
- Fresh and restored-copy isolated rehearsals: passed
- Future additive migration rehearsal: passed
- Object verification: 39 tables, 101 indexes, 347 constraints, 6 functions, 41 triggers
- Cold-start browser gate: 10/10 passed; evidence in `test-results/cold-start-summary.json`
- Unit tests: 64 total passed
- Typecheck, lint, production build and structure checks: passed

## 6. Source, artifact and CI status

Current source state is intentionally reviewable but dirty: the recovery workflow, report, manifest, harness and related fixes are uncommitted working-tree changes. The last committed source is `b47fe4e`; therefore no commit SHA currently represents the complete candidate package.

The candidate manifest is `docs/STAGE-B-CI-ARTIFACT-MANIFEST.json`. It records the baseline, schema, lockfile, workflow and report hashes. Status is `CANDIDATE / AWAITING APPROVAL`; it is not an approved release artifact.

GitHub verification is blocked:

- `git remote -v`: no configured remote
- `gh auth status`: unavailable because GitHub CLI is not installed
- Workflow run URL, run ID, remote commit SHA and uploaded artifact ID: unavailable

**REMOTE CI: BLOCKED / NOT VERIFIED.** Local validation must not be represented as GitHub Actions success.

## 7. Backup and restoration verification

Previously verified Stage A backup:

- File: `C:\Users\Antricore\AppData\Local\NET-SLET-recovery\netslet_dev_preapproval_20261012.dump`
- SHA-256: `E5CDA2FDF2A3F6C0BA651DF4FCEBE773B26875D475BC82BA550E8FBF05633729`
- Isolated restored copy: retained during rehearsal

Before Stage B execution, a new active-database custom-format backup must be created, independently checksum-verified, listed with `pg_restore --list`, restored into a new isolated instance, and compared against the active identity. The older rehearsal backup is not a substitute for that pre-change backup.

## 8. Proposed Stage B migration-reconciliation procedure

This procedure is intentionally not executable until both owners approve the exact artifact, target, window and rollback plan.

1. Record the approved candidate commit, baseline checksum, active database identity, server identity, all 15 applied migration names/checksums, schema/object counts, row counts and representative data fingerprints.
2. Freeze application writes and confirm the application is not connected to any rehearsal URL.
3. Capture and verify the new `pg_dump --format=custom` backup. Restore-test it into a separate approved instance and retain the pre-change target.
4. Compare active tables, indexes, constraints, enums, extensions, functions, triggers, audit controls, publication controls and representative records to the reviewed baseline. Resolve any mismatch before proceeding.
5. Using an approved release-only Prisma configuration that points to the active target and contains only the consolidated baseline, execute from the API package directory:

   ```powershell
   pnpm --filter @net-slet/api exec prisma migrate resolve --applied 20261012000000_stage_a_consolidated_baseline --config ../../recovery/stage-a/prisma.config.ts
   ```

   This records the baseline as applied; it must not run baseline DDL against populated data. Never manually edit `_prisma_migrations`.

6. Run Prisma status, object comparison, row/data fingerprints, authentication, QBMS, publication/immutability, integration, browser, smoke and audit checks while writes remain frozen.
7. Obtain DBA review of the evidence, then reopen writes only after the validation checklist passes.
8. Preserve command logs, backup checksums, migration output, comparison results, approval records and the final active identity.

## 9. Data preservation and downtime assessment

The intended reconciliation is metadata-only and must not alter application rows. Data safety depends on the pre-change backup, write freeze, object comparison and the prohibition on replaying baseline DDL. No production downtime has been measured. The database owner must select the maintenance window, estimate the write-freeze duration during a rehearsal, assign an incident commander and define the maximum tolerable outage.

## 10. Rollback ownership and procedure

**Rollback owner:** NOT ASSIGNED.  
**Database owner:** NOT ASSIGNED.  
**Application/release owner:** NOT ASSIGNED.

If reconciliation validation fails, keep writes frozen, preserve logs, do not retry blindly, and restore the verified pre-change backup into a new approved instance. Route application connectivity to that restored instance under the DBA change plan. Do not use `migrate reset`, `db push`, direct migration-row edits, active-volume deletion or baseline DDL replay. If writes resumed after a failed change, stop and perform explicit data/PITR reconciliation before switching back.

## 11. Residual security and operational risks

- No remote CI provenance or artifact upload has been verified.
- The default legacy CI migration path remains failing.
- The inherited `NODE_TLS_REJECT_UNAUTHORIZED=0` process setting origin remains unknown and must be eliminated before release.
- Managed Redis authentication/TLS, external email delivery and verified sender configuration remain unverified.
- Production HTTPS cookie behavior and complete student/browser acceptance remain incomplete.
- The candidate remains uncommitted and requires source review before publication.

## 12. Post-change validation checklist

- Confirm active identity and migration record count.
- Confirm exactly one approved baseline record and Prisma status up to date.
- Compare all reviewed database objects and representative row/data fingerprints.
- Run integration, authentication, QBMS, review/publication, challenge and immutability checks.
- Run authenticated Playwright, smoke, lint, build and security configuration checks.
- Inspect audit events and verify no confidential data was exposed.
- Reopen writes only after product/database owner acceptance of the evidence.
- Record final backup, rollback and change-ticket identifiers.

## 13. Approval fields

### Product owner

Name: ____________________________________  
Decision: APPROVE / REJECT / DEFER  
Approved artifact commit: __________________  
Approved baseline SHA-256: __________________  
Approved maintenance window: _______________  
Signature/date: _____________________________

### Database owner

Name: ____________________________________  
Decision: APPROVE / REJECT / DEFER  
Approved target identity: ____________________  
Rollback owner: _____________________________  
Backup/restore owner: _______________________  
Signature/date: _____________________________

### Execution authorization

Stage B execution authorization: **NOT GIVEN**  
Authorized operator: ________________________  
Change/incident ticket: ______________________  
Authorization date/time: _____________________

## 14. Final decision

**NOT READY FOR STAGE B APPROVAL.**

The isolated technical rehearsal is credible and the cold-start gate is complete, but the two prerequisites requested by this action are not both satisfied: remote GitHub execution is blocked, and the complete candidate is not committed. Stage B must remain paused until a remote is explicitly authorized and supplied, the candidate is reviewed and committed, the recovery workflow passes at that exact commit, and both named owners sign this package.

**Sprint 3 implementation readiness:** **NO-GO** until Stage B approval is separately granted and the legacy/recovery migration decision is recorded.
