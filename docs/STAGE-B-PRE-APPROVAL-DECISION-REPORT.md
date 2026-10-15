# Project NET/SLET v2.2 — Stage B Pre-Approval Decision Report

**Assessment date:** 2026-10-12  
**Branch:** `feature/content-c0-examdna`  
**Current HEAD:** `8d3e16d` — Content Track C0.A–C0.C  
**Assessment type:** Read-only technical and authorization review  
**Decision:** **NO-GO — NOT READY FOR STAGE B EXECUTION OR APPROVAL**

## 1. Executive decision

Stage A provides credible isolated backup, restore, schema-object comparison and recovery-candidate evidence. It does not authorize changing the active database. Stage B remains blocked because the active migration path is still not a reproducible clean-install path, the recovery candidate has no verified GitHub Actions execution, the approval fields are unsigned, a fresh pre-change backup/restore test and rollback owner are still required, and the candidate history treatment has not been approved.

This review performed no Prisma commands, database restore, migration reconciliation, `_prisma_migrations` update, CI rerun or migration edit.

## 2. Repository baseline and authoritative documents

The actual repository state was verified as:

- Branch: `feature/content-c0-examdna`.
- HEAD: `8d3e16d`.
- Prior committed baseline: `c2374a2`.
- Only tracked working-tree modification: `test-results/cold-start-summary.json`; it was preserved exactly and remains unstaged.
- No commit, push, merge or reset was performed.

C0.A–C0.C are part of the current committed baseline at `8d3e16d`. The migration-recovery evidence remains a historical candidate package; it is not silently promoted to an approved release artifact.

### Latest authoritative source by subject

| Subject | Authoritative document | Basis and status |
|---|---|---|
| Migration defect/root cause | `docs/decisions/ADR-0009-migration-repair-proposal.md` | Proposal-level root cause; no migration change authorized |
| Stage A isolated rehearsal | `docs/STAGE-A-MIGRATION-RECOVERY-REPORT.md` at `4dedf10` | Latest Stage A execution report; scope-limited isolated evidence |
| Stage B readiness and final Sprint 2 acceptance | `docs/STAGE-B-CI-ARTIFACT-COLD-START-QA-REPORT.md` at `c83c497` | Latest Stage B/CI package; remote CI explicitly not verified |
| Formal owner approval | `docs/STAGE-B-FORMAL-APPROVAL-REQUEST.md` at `c83c497` | Approval request only; status NOT READY |
| Candidate artifact identity | `docs/STAGE-B-CI-ARTIFACT-MANIFEST.json` | Candidate/awaiting approval; not a signed release manifest |
| Earlier readiness and database pre-approval | `docs/MIGRATION-RECOVERY-SPRINT-3-READINESS-GATE.md`, `docs/DATABASE-RECOVERY-PRE-APPROVAL-REPORT.md` | Historical readiness snapshots retained for traceability |

The older reports are not deleted or rewritten. Where their results differ, this report records the narrower, later status and preserves the distinction between direct PostgreSQL replay, Prisma-native replay, isolated candidate replay and remote CI.

## 3. Historical migration defect

The filesystem migration order is lexicographic by timestamp. `20261011222455_syllabus_taxonomy_foundation` sorts before `20261012000800_auth_lifecycle_tokens`.

The syllabus migration executes:

```sql
ALTER TABLE "EmailVerificationToken" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "PasswordResetToken" ALTER COLUMN "id" DROP DEFAULT;
```

Those tables are created only by the later auth migration. On a clean database, the referenced relations do not exist, so fresh replay fails at the syllabus migration with `P3018` and PostgreSQL `42P01`. This is a dependency-order defect, not evidence that the application schema itself is necessarily incomplete.

The previously migrated development database can still function because its recorded/applied execution order already contains the token tables before the syllabus `ALTER TABLE` statements are relevant. Its read-only evidence shows `netslet_dev` with 15 successful migration rows, 38 tables, 99 indexes, 96 constraints, 6 functions and 18 non-internal triggers, with no reported Prisma schema diff. Existing database state therefore masks the clean-replay defect.

The incorrectly ordered dependency is:

```text
syllabus_taxonomy_foundation
  requires EmailVerificationToken and PasswordResetToken
auth_lifecycle_tokens
  creates EmailVerificationToken and PasswordResetToken
```

No migration file may be reordered or edited as part of this review.

### Does the Stage A candidate address fresh deployment?

Partially, with scope qualification:

- The Stage A report records successful isolated baseline deployment and future-additive probes.
- The later readiness/pre-approval records identify an earlier Prisma 7.10 `P1014` native-baseline issue and withhold acceptance until the replacement path is proven.
- The latest C83 package records a local recovery-candidate isolated database pass, but explicitly distinguishes it from GitHub Actions and from the unchanged legacy workflow.

Therefore the candidate demonstrates a technically plausible fresh path in isolated local evidence, but it does not make the default repository migration path safe, and it does not constitute Stage B approval.

### What existing-database reconciliation would require

Only after separate approval, the selected release artifact must:

1. Prove active identity, 15 migration names/checksums, object fingerprints and representative data fingerprints against a newly verified backup and restored copy.
2. Use a baseline-only Prisma configuration explicitly targeting the approved active database.
3. Record the consolidated baseline through supported Prisma history handling, such as `migrate resolve --applied`, only after schema equivalence is independently proven.
4. Never replay baseline DDL on the populated target, manually edit `_prisma_migrations`, use `db push`, use `migrate reset` or delete volumes.
5. Validate status, all custom functions/triggers/constraints, data preservation, auth/QBMS behavior, audit controls and rollback before reopening writes.

## 4. Stage A evidence assessment

| Evidence area | Assessment | Classification |
|---|---|---|
| Baseline object integrity | 37 application tables plus Prisma metadata inventory; 98/99 indexes, 95/96 constraints, 6 functions, 18 triggers and enum fingerprints reported | Verified in isolated reports, subject to artifact/version scope |
| Prisma schema compatibility | Active `migrate diff` reported no schema diff; custom objects separately inspected | Verified read-only comparison; not a full migration-history proof |
| Fresh isolated replay | Stage A and later candidate reports record successful recovery-config paths; legacy path still fails | Recovery candidate locally evidenced; default path blocked |
| Restored-copy compatibility | Backup restoration, row counts/fingerprints and object comparisons reported; later documents still require preserved-copy/Prisma-native acceptance interpretation | Isolated evidence exists; active reconciliation unapproved |
| Migration-history consistency | Restored copy retained original rows plus resolved baseline in rehearsal | Isolated rehearsal only; active `_prisma_migrations` unchanged |
| Backup validity | Custom-format backup, checksum and `pg_restore --list` recorded | Verified for the rehearsal backup; new pre-change backup still required |
| Rollback feasibility | Restore-and-switch procedure documented | Procedure proposed; no production rehearsal/owner/window approval |
| CI reproducibility | Local analogue and static workflow exist | GitHub Actions execution NOT VERIFIED |
| Application regression | Local unit/integration/build/smoke and selected browser evidence | Partial; full acceptance matrix and production dependencies remain open |

The recovery reports are credible evidence of isolated work, but “local recovery path passed” must not be relabeled as “default CI passed” or “active database reconciled.”

## 5. Stage B approval register

| Requirement | Status | Evidence/condition |
|---|---|---|
| Product-owner authorization | **PENDING** | Formal approval field is unsigned |
| Database-owner authorization | **PENDING** | Formal approval field is unsigned |
| Engineering-owner authorization | **PENDING** | No explicit signed authorization recorded for the current artifact/HEAD |
| Deployment/release authorization | **PENDING** | No release ticket, authorized operator or maintenance window |
| Rehearsal backup evidence | **APPROVED FOR REHEARSAL EVIDENCE** | Checksum and restore evidence documented; not approval for active use |
| New pre-change backup and restore test | **PENDING** | Must be taken and verified immediately before any authorized execution |
| Recovery evidence | **APPROVED AS ISOLATED EVIDENCE** | Stage A reports and candidate rehearsals exist; no active reconciliation |
| Fresh-deployment acceptance | **BLOCKED** | Legacy default replay fails; recovery path is not remote-CI verified |
| Existing-database reconciliation acceptance | **BLOCKED** | No active target approval or execution; only isolated rehearsal |
| CI/CD acceptance | **BLOCKED** | No GitHub remote/run ID/SHA/artifact evidence |
| Operational rollback approval | **PENDING** | Rollback owner, incident process, window and outage limit unassigned |
| Historical migration treatment | **PENDING** | Archive/baseline mapping requires explicit owner approval |

“Approved as isolated evidence” does not mean “approved to change the active database.”

## 6. Documentation-only recovery plan review

The existing proposal is directionally safe and includes backup checksum verification, isolated restoration, schema/data comparison, write freeze, supported Prisma resolution, post-change validation and stop conditions. It correctly prohibits direct `_prisma_migrations` edits, `db push`, `migrate reset` and volume deletion.

Before it could become an execution runbook, it still needs:

- a newly generated pre-change backup and independent restore-test record;
- a named database owner, rollback owner, incident commander and authorized operator;
- a measured maintenance window and maximum write-freeze/outage limit;
- an approved release artifact that selects one migration strategy and removes ambiguity between baseline deployment and history reconciliation;
- proof that the exact artifact works with Prisma 7.10 in both fresh and restored copies;
- real CI evidence at the exact approved commit;
- explicit stop criteria for object mismatch, data fingerprint mismatch, status mismatch, validation failure and post-change writes.

No step in that plan was executed during this assessment.

## 7. Post-recovery development dependency map

The recommended sequence after Stage B authorization is:

```text
approved immutable pattern + question snapshots
        ↓
persistent TestForm/Attempt snapshot
        ↓
server-authoritative timer and attempt state
        ↓
transactional answer save + idempotency + stale-revision control
        ↓
final submission and immutable scoring run
        ↓
persistent results and authorized rescoring
        ↓
practice history / Mistake Mine evidence
        ↓
PrepPilot plan persistence
        ↓
L0.C spaced retrieval persistence
```

Specific dependencies:

- **Persistent CBT attempts:** require approved form/pattern/question snapshots and durable attempt ownership.
- **Transactional answer saving:** requires PostgreSQL transaction boundaries, idempotency keys, optimistic revision checks and authorization; Redis remains cache/queue only.
- **Authoritative timers:** require persisted server deadlines and a verified attempt state machine; reconnect cannot grant time.
- **Final submission/recovery:** requires atomic finalization, expiry race handling and recoverable attempt state.
- **Persistent results:** require immutable scoring-policy/question/answer snapshots and versioned score runs.
- **Practice history/Mistake Mine:** depend on durable answer/result evidence and explicit separation from strict examination attempts.
- **PrepPilot persistence:** depends on trustworthy learner history and governance-approved study-plan versioning.
- **L0.C spaced retrieval:** depends on persisted learning events, scheduling policy versioning and privacy/retention controls.

Recommended first implementation after approval: immutable form/attempt persistence and server-authoritative deadlines; then transactional answer saving and finalization; then scoring/results; then derived learning features.

## 8. Go/no-go and exact next actions

### Decision

**NO-GO. Do not execute Stage B.** The review confirms enough isolated evidence to prepare an approval package, not enough authorization and reproducibility evidence to change the active database.

### Required next actions before execution

1. Obtain product-owner, database-owner and engineering-owner review of the exact candidate artifact and migration-history strategy.
2. Resolve the candidate’s Prisma-native baseline acceptance and preserve the exact tested commit/artifact mapping.
3. Obtain an authorized private GitHub remote and run the existing recovery workflow at the approved commit; record URL, run ID, SHA and artifacts. Do not repair the legacy workflow under this assessment.
4. Create and checksum a new active-database pre-change backup; restore-test it in a new isolated instance and retain the rollback target.
5. Assign the DBA/rollback owner, authorized operator, incident ticket, maintenance window and maximum outage/write-freeze limit.
6. Reconfirm active identity and all migration checksums immediately before execution.
7. Re-review all object/data comparisons, custom functions/triggers, audit/publication controls and application checks at the exact approved artifact.
8. Record explicit Stage B authorization. Only then may a separate execution task run the approved reconciliation procedure.

### Outstanding approval fields

Product owner: ____________________ Decision/date: ____________________  
Database owner: ____________________ Decision/date: ____________________  
Engineering owner: _________________ Decision/date: ____________________  
Rollback owner: ____________________ Maintenance window: ______________  
Authorized operator/change ticket: _____________________________________

This report stops at the pre-approval checkpoint. It does not authorize recovery, migration reconciliation, production deployment or Sprint 3 persistence work.
