# Stage B readiness and final Sprint 2 acceptance

Date: 2026-10-12. Status: **escalated to owner approval / remaining acceptance gaps**. Stage B is **not authorized**. No active migration history was changed; no Sprint 3 feature was implemented. This report updates the older pre-approval/readiness reports, which describe the state before the successful Stage A rehearsal.

## Independent decisions

| Gate | Decision | Evidence |
| --- | --- | --- |
| Sprint 2 functional acceptance | **PARTIALLY COMPLETE** | Authenticated synthetic author→reviewer→admin→student→staff journey passes, with challenge/audit and negative security checks; student-facing published-question/challenge UI and full eight-format browser matrix remain absent. |
| Stage B database recovery readiness | **NOT READY FOR APPROVAL** | Recovery-only baseline works, but the default CI migration path still fails fresh replay (`P3018/42P01`), no approved release artifact or owner sign-offs exist, and cold-start E2E is not stable. |
| Sprint 3 internal implementation | **NO-GO** | Architecture/test planning may continue, but no schema or application implementation should begin before the migration gate and owner decision. |
| Production deployment | **NO-GO** | Default CI replay, external email delivery, inherited TLS setting, incomplete production security/runtime evidence, and Sprint 2 UI gaps remain. |

## Preservation, backup and database evidence

- Branch: `migration-recovery/stage-a-20261012`; preserved Sprint 2 source `3c0235a`, initial recovery evidence `d562b95`, tested Stage A baseline/report commit `4dedf10a1f6c59a776e03762c0bc745e71b4d777`. This package does not merge the branch or edit the 15 original migrations.
- Baseline SQL: `recovery/stage-a/prisma/migrations/20261012000000_stage_a_consolidated_baseline/migration.sql`; SHA-256 **`1C00968DC3690D35DD0507E8C24625AA093A3483B0B3ECC79EFD9553DFCF0E34`**. The terminal blank line is intentionally retained because changing bytes would invalidate the rehearsed checksum. The release default migration path still points to the old 15 files.
- Verified backup: `C:\Users\Antricore\AppData\Local\NET-SLET-recovery\netslet_dev_preapproval_20261012.dump`, 131,017 bytes, SHA-256 **`E5CDA2FDF2A3F6C0BA651DF4FCEBE773B26875D475BC82BA550E8FBF05633729`**. A fresh pre-Stage-B backup and restore test will still be required.
- Active database identity `netslet_dev` in `net-slet-dev-postgres-1` was queried read-only: **15** original migration records, **0** baseline records. Aggregate ordered name/checksum MD5: `448b99c0ad77ca68079dbebba5094fbf`. Active and preserved restored-copy counts still match: Account 19, AuditEvent 46, Jurisdiction 8, Session 31. The isolated `netslet-stage-a-rehearsal` container is loopback-bound at port 55432 with tmpfs data; `stage_a_restored_final` retains 17 records (15 originals, resolved baseline, additive probe). Synthetic browser fixtures used separate `stage_a_acceptance` only.
- Stage A catalog proof remains unchanged: 38 total tables, 99 indexes, 96 constraints, 6 custom functions, 18 custom triggers; excluding Prisma metadata, 37/98/95. Catalog-definition fingerprints and all original application-table row fingerprints matched on fresh/restored paths. See `docs/STAGE-A-MIGRATION-RECOVERY-REPORT.md` for the per-object hashes and `stage_a_fresh`/`stage_a_restored_final` additive probe results.

Current active migration-history checksum inventory (read-only query, order by `started_at`):

| Migration | SHA-256 checksum |
| --- | --- |
| `20261011192043_init_exam_catalog` | `a3b4e736979617d02a71e1035e0f2046d7b6678df306ddb6e5ec7b31779e2f59` |
| `20261011194905_init_exam_catalog` | `856e1ce7ce210e41d008b139b9541dea1cc7675e9e33dd200b1b71fa92d06541` |
| `20261011195807_init_exam_catalog` | `c4fea7808634d2ad2d6a4415cc31fff7c549537e7a4ae96e5e40e593ef4396c0` |
| `20261012000100_pattern_lifecycle` | `d67574741768b6f66015ccae42386f84beb67f2102151dc7e7ca140963171290` |
| `20261012000200_pattern_rejected` | `849dd4e0b9d5fa3b969c3a6bbb87b617a5711ceee24e3527e963391b5912879c` |
| `20261012000300_structured_pattern_architecture` | `e23ae6b5faa6d3ba2090c7f70c1c713731dee73907d10aee52ddcd542874a868` |
| `20261012000400_pattern_review_state` | `63c22f3c6234463affe06931f151ed0f19d5cd1f4f2fa26f27ae4440444e3d80` |
| `20261012000500_pattern_child_immutability` | `a6cbde7b82ecdc32e4de3a04a048b74eb063ec1aa6452cdacb721e58291faf9a` |
| `20261012000600_fix_pattern_trigger` | `445709d510c8e24c45bd9b07a8d8fe7bcb101d6d36b007e41aecdde821f8c644` |
| `20261012000700_quote_pattern_trigger_columns` | `b8606ccf23ca67ea37db6cbbc184ffb2fb6b915b9be46ccfdcfe00fe0449e35b` |
| `20261012000800_auth_lifecycle_tokens` | `d73d5328f05b315fb7f99b90f627a91c8c416c4fb38de789502f6463ee414595` |
| `20261011222455_syllabus_taxonomy_foundation` | `ae024f1377b56727d7b79d47e174b2954a4aba5b9272aa2623c97b1c31d26ca7` |
| `20261012100000_question_authoring_engine` | `985b602dc6c4d0fd5e419d72c65db2685dc869ece7d8f0f708a2cb088876409b` |
| `20261012100100_question_child_immutability` | `589daf4152e6342d0aacda23d056c4b96fbe394aac0810735d5bc37238cce47f` |
| `20261012100200_question_review_publication_trust` | `dcc3e9201d98c176ac759c88396995680aefbaacfc80b826566d61b7cbb6ab4f` |

## Local validation and CI reproducibility

All database URLs below were explicit isolated URLs at `127.0.0.1:55432`; credentials are intentionally omitted. TLS flag was removed from each verification shell before Node launch.

| Exact command / operation | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass, lockfile unchanged. |
| `pnpm db:generate` | Pass, Prisma Client 7.10.0. |
| `pnpm verify:structure` | Pass. |
| `pnpm typecheck` | Pass. |
| `pnpm test` | Pass: 5 rules tests and 59 API tests in 14 suites. |
| `pnpm lint` | Pass. |
| `pnpm build` | Pass with certificate verification enabled. |
| `pnpm test:integration` with `STAGE_A_REHEARSAL=1`, separately on `stage_a_fresh` and `stage_a_restored_final` | Pass on both; normalized tables, migration records, audit triggers, published immutability. |
| `prisma migrate deploy --config recovery/stage-a/prisma.config.ts` on new `stage_a_ci_candidate`, then `pnpm test:integration` and `prisma migrate status --config ...` | Pass: one baseline migration applied, schema up to date, integration passed. |
| Existing CI command `pnpm --filter @net-slet/api exec prisma migrate deploy` on new `stage_a_ci_legacy` | **Fail as expected:** `P3018/42P01`, syllabus migration references `EmailVerificationToken` before creation. This is the unmodified `.github/workflows/ci.yml` path. |
| `pnpm test:e2e` on isolated acceptance DB | Warm-server rerun: **5 passed, 0 failed, 0 skipped**. Earlier cold-server runs: 4 passed/1 failed, first from API startup race and later an intermittent HTTP 500 during QBMS draft save; root cause of the latter remains open. |
| `pnpm smoke` after both dev services were ready | Pass: web/API liveness/API readiness HTTP 200; an early pre-readiness attempt failed. |
| `git diff --check` for this increment | Pass; line-ending notices only. The historical baseline's terminal blank line is unchanged. |

This is a **local CI analogue**, not a GitHub Actions run. No actual remote CI execution evidence is available. The existing workflow has no recovery-config override and would still fail on a clean database. Do not call CI green or deploy the baseline until an approved release artifact and real CI run exist.

## Authenticated browser and security matrix

The new Playwright journey uses five isolated synthetic accounts (ADMIN, author SME, independent reviewer SME, two students), research-only exam/syllabus/question text, real browser sessions and backend APIs. Role promotion is fixture-only SQL against `stage_a_acceptance`. It verifies authoring UI/preview, key/explanation/provenance/mapping, draft revision, rights/licence gates, cross-exam topic rejection, assigned-only reviewer queue, reviewer inspection and rejection notes, author self-review denial, distinct admin approval/publication, publication history, immutable published revision, public key/explanation non-disclosure, student challenge ownership, staff queue search/pagination/triage/resolution, audit rows, intact answer key, cookie `HttpOnly`/`SameSite=Lax`, session expiry, and hostile `Origin` rejection. The four earlier Sprint 1 browser tests cover registration/login/logout, catalogue/pattern lifecycle and workspace denial.

Security results and limits:

| Control | Result / remaining gap |
| --- | --- |
| Auth, expiry, RBAC, cross-question ownership, author/reviewer/publisher separation | Pass in browser/API journey; assigned reviewer sees only the submitted assigned revision. |
| Cross-examination context isolation; provenance/licence gates; published immutability; answer-key confidentiality; challenge reporter privacy; audit persistence | Pass in isolated browser/API and database integration checks. |
| Cookies, CORS, CSRF | `HttpOnly`/`SameSite=Lax` and hostile-Origin POST rejection tested. This is not a full browser-origin/CSRF bypass audit; production `Secure` cookie behavior requires an HTTPS deployment test. |
| Redis-backed production rate limit | Unit tests pass for unavailable Redis, missing `REDIS_URL` fail-closed, and eleventh-attempt rejection. A separate production-mode runtime launch was rejected by the command policy; **live Redis enforcement is not verified**. The disposable Redis container and its anonymous volume were removed. |
| Sensitive data exposure | Public question projection excludes answer key and explanation; challenge queue/detail excludes reporter ID. No comprehensive logs/client-bundle scan or penetration test is claimed. |
| Complete Sprint 2 UI | Staff/SME workspace journey is exercised; a student UI for published-question browsing and challenge submission is not present, so the student portion is API-backed browser interaction, not a complete student UI journey. Eight question formats are validated by unit tests, not eight separate browser journeys. |

Confirmed defects fixed in this increment: production auth no longer falls back to process-local rate limiting when `REDIS_URL` is absent; an assigned SME may inspect only the assigned submitted revision even when a newer private draft exists; SME review queues are scoped to assignments; the static challenge-list route precedes the generic question-ID route; the workspace retains failed detail-load messages. Each behavior has unit or browser regression evidence. The cold-start HTTP 500 is unresolved and is not labelled fixed.

## TLS and external email

The tool-launched PowerShell inherited `NODE_TLS_REJECT_UNAUTHORIZED=0`. Windows User and Machine environment values were empty; searched PowerShell profiles, repository scripts, workspace/User VS Code settings and local Codex config showed no assignment. Process ancestry was PowerShell ← Codex ← VS Code ← Explorer, so the inherited process source remains unidentified. In a clean child shell, `Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED` yielded `CHILD_TLS=<unset>` for Node 24.20.0; install/build/browser checks ran with that flag absent. The unsafe flag remains in newly launched tool shells; restart and inspect the VS Code/Codex launch environment before release. No TLS-bypass workaround was added.

The production webhook adapter enforces HTTPS and fails closed on missing configuration, non-HTTPS URL, network rejection and non-2xx response in mocked unit tests (6/6 email-service tests). No provider URL/key/sender is configured in the process; no real message was sent. **External delivery and sender-domain verification: NOT VERIFIED.** Secrets remain outside Git.

## Stage B proposal — not executable without separate approval

Impact: Stage B reconciliation adds a baseline metadata record to the active database; it must not replay the baseline DDL over populated data. Application writes must be frozen while the new backup, identity/object checks, resolve operation, status checks and smoke tests run. No measured downtime exists; database/release owners must time an isolated maintenance rehearsal and choose a window, rollback owner and maximum outage before sign-off.

1. Product owner and database owner approve the exact release artifact, baseline checksum above, original 15-file archive, maintenance window, backup/restore owner, target identity and rollback criteria. Resolve the default CI migration path in the artifact and obtain a real clean-database CI run. This has **not** happened.
2. Freeze writes; capture active identity, all 15 migration names/checksums, catalog/data fingerprints and a new `pg_dump --format=custom` backup. Verify its SHA-256, run `pg_restore --list`, restore-test to a separate instance, and retain the pre-change target. Confirm the intended active URL is not any rehearsal URL.
3. Compare the active schema and custom objects to the approved baseline. With the approved Prisma 7.10 release config explicitly pointing to the active target and the reviewed baseline-only migration directory, run `pnpm --filter @net-slet/api exec prisma migrate resolve --applied 20261012000000_stage_a_consolidated_baseline --config <approved-release-config>`. **Do not run this now**, manually edit `_prisma_migrations`, or apply baseline DDL to the populated database.
4. Run `pnpm --filter @net-slet/api exec prisma migrate status --config <approved-release-config>`, compare all objects and original row fingerprints, run auth/QBMS/integration/browser/smoke checks, inspect audit history and only then reopen writes. A future additive migration requires its own review and deploy step.
5. On any failure, keep writes frozen and preserve logs. Restore the verified pre-Stage-B backup into a new approved instance and switch application connectivity under the DBA rollback plan. Never use `migrate reset`, `db push`, direct migration-row edits or active-volume deletion. If writes resumed, stop and arrange point-in-time/data reconciliation before switching back.

## Open risks and approval fields

Migration-reconciliation blockers: **P0** no Stage B authorization/signatures; **P0** default CI migration replay still fails and no approved release artifact redirects it; **P1** no actual remote CI run; **P1** cold-start browser test intermittently produced an unexplained HTTP 500. Broader production-launch blockers: **P1** inherited TLS-disable flag source unresolved; **P1** live Redis rate limiting/production HTTPS-cookie/CSRF exercise incomplete; **P1** external email delivery and verified sender absent; **P1** student published-question/challenge UI and full authenticated type matrix incomplete; **P2** automated accessibility and performance/load evidence absent; **P3** expected terminal blank-line warning in the immutable tested baseline SQL.

Product-owner Stage B approval: **NOT GIVEN** — name/date/signature: ____________________

Database-owner Stage B approval: **NOT GIVEN** — name/date/signature: ____________________

Release/rollback owner and maintenance window: **NOT ASSIGNED** — ____________________

Smallest next decision: approve a narrowly scoped release-artifact/CI repair and cold-start QA increment for review, **not** active reconciliation. Return for separate Stage B authorization only after its evidence and owner sign-offs are recorded.
