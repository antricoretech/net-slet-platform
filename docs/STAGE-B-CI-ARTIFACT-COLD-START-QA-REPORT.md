# Stage B CI, artifact and cold-start QA closure report

Date: 2026-10-12  
Branch: `migration-recovery/stage-a-20261012`  
Commit at review start: `b47fe4e`  
Status: **CANDIDATE / AWAITING APPROVAL**

## A. Executive summary

This increment adds a recovery-candidate CI workflow, an isolated cold-start runner, database-object verification, request correlation headers and startup sequencing corrections. It does not execute Stage B, alter `netslet_dev`, rewrite migration history, merge the recovery branch or begin Sprint 3.

The first reproduced cold-start failures were test-harness failures: the prior Playwright configuration waited only for the web URL while starting the API and web server in parallel, and could reuse an unrelated server. The corrected configuration waits for API readiness before starting Next.js and disables reuse for cold runs. The previously reported QBMS HTTP 500 was not reproduced by the corrected run; therefore its specific application root cause is **not verified** and is not claimed fixed until the 10-trial gate completes.

Stage B remains **NOT READY FOR APPROVAL** at this checkpoint because the legacy fresh replay is still failing, no GitHub remote is configured, no owner approvals or approved artifact exist, production dependencies are not externally verified, and the cold-start evidence is still being completed.

## B. Cold-start root-cause and evidence

Confirmed harness defect: `playwright.config.ts` used one parallel `pnpm dev` process and waited only for `http://localhost:3000`, while the test separately polled an API that could be unavailable during Nest watcher recompilation. `reuseExistingServer: true` also allowed an already-running process to contaminate a supposed cold run. Evidence is the retained Playwright context showing `Failed to fetch` during sign-in, before QBMS authoring, followed by a successful run after API-first readiness sequencing.

The API now emits an `x-request-id` response header for sanitized failure correlation. No passwords, cookies, session tokens or answer keys are logged by the runner. The runner verifies an isolated `127.0.0.1:55432/stage_a_acceptance` database and requires an explicit Redis URL.

The original draft-save 500 remains **UNRESOLVED / NOT VERIFIED** as a specific application exception because no backend stack trace was captured for that historical failure. The corrected production-like gate is nevertheless operationally green: the failure path did not recur.

## C. Source and harness changes

- `playwright.config.ts`: separate API readiness and web startup; cold mode refuses server reuse.
- `scripts/run-cold-start-qa.ps1`: ten-or-more independent trials, isolated URL guard, no arbitrary sleeps, JSON summary.
- `tests/e2e/sprint2-acceptance.spec.ts`: accepts only the isolated recovery candidate in local/CI modes and allows the startup-sensitive sign-in assertion to report a real failure.
- `apps/api/src/main.ts`: adds a non-sensitive request correlation response header.
- `scripts/verify-recovery-schema.mjs`: checks reviewed minimum database-object counts.
- `.github/workflows/recovery-candidate.yml`: isolated recovery track; the legacy workflow remains unchanged and visibly failing.
- `apps/api/scripts/integration.mjs`: permits an explicitly declared isolated CI rehearsal port.

## D. Repeated cold-start trial evidence

The corrected runner command is:

```powershell
./scripts/run-cold-start-qa.ps1 -Trials 10 -DatabaseUrl <isolated-stage-a-url> -RedisUrl <verified-redis-url>
```

Final evidence: **10/10 independent cold starts passed**, with exit code 0 on every trial and durations of 53.0, 44.4, 44.2, 38.7, 41.2, 38.9, 59.9, 48.8, 49.5 and 47.7 seconds. Each trial started fresh application processes, waited for API readiness, authenticated five synthetic accounts, completed the real author/reviewer/admin/student/staff journey, and verified persisted database state. Machine-readable evidence is retained at `test-results/cold-start-summary.json`. The preliminary watch-mode series had startup-only failures before the production-like runner was introduced; those traces remain diagnostic evidence, not successful QA trials.

## E. Recovery-candidate CI

`.github/workflows/recovery-candidate.yml` is restricted to `migration-recovery/**` pushes/PRs and manual dispatch. It verifies the reviewed baseline SHA-256, provisions an empty PostgreSQL database, deploys `recovery/stage-a/prisma.config.ts`, checks Prisma status and object counts, runs unit/integration/E2E/lint/build checks, and uploads a machine-readable summary.

The workflow is a static repository artifact only. There is no configured Git remote or authenticated GitHub Actions result in this environment.

**GITHUB ACTIONS EXECUTION: NOT VERIFIED.**

## F. Legacy migration track

The default `.github/workflows/ci.yml` and default Prisma migration directory remain unchanged. A fresh replay still fails at the known `P3018/42P01` ordering defect where the syllabus migration references `EmailVerificationToken` before its creation. Passing the recovery workflow must not be described as fixing this legacy track.

## G. Candidate artifact manifest and checksums

Reviewed candidate baseline:

- Baseline SQL: `recovery/stage-a/prisma/migrations/20261012000000_stage_a_consolidated_baseline/migration.sql`
- Baseline SHA-256: `1C00968DC3690D35DD0507E8C24625AA093A3483B0B3ECC79EFD9553DFCF0E34`
- Verified source branch: `migration-recovery/stage-a-20261012`
- Verified backup SHA-256: `E5CDA2FDF2A3F6C0BA651DF4FCEBE773B26875D475BC82BA550E8FBF05633729`

The release package is a reviewable **candidate**, not an approved release. It must include the final report, workflow, baseline SQL, original migration inventory, schema/lockfile hashes, object comparison, fresh and restored-copy evidence, regression results and owner approval fields. No database dump or secret is included.

## H. TLS and security findings

The prior tool-launched process inherited `NODE_TLS_REJECT_UNAUTHORIZED=0`; repository scripts, PowerShell profiles and user/machine environment entries did not identify its origin. It was removed from the QA child processes and no bypass was added. Origin remains unknown and must be resolved by restarting the VS Code/Codex launch chain before release.

Production authentication now fails closed when `REDIS_URL` is absent. Local Redis-backed checks pass, but managed Redis authentication/TLS and external email delivery were not verified. No production readiness claim is made.

## I. Authenticated browser acceptance matrix

The existing authenticated Sprint 2 synthetic journey covers authoring, syllabus mapping, review assignment, reviewer separation, rejection/approval/publication, immutability, public answer-key non-disclosure, student challenge ownership, staff triage/resolution, audit evidence and session/CSRF controls. Sprint 1 covers registration/login/logout, catalogue lifecycle and workspace denial. A complete public student UI journey and all eight browser-format journeys remain outside the current evidence.

## J. Production dependency status

| Dependency | Status | Meaning |
|---|---|---|
| Isolated Redis | Pass locally | Not managed-production evidence |
| Distributed rate limiting | Code guarded | Requires production Redis verification |
| Email webhook/sender | Not verified | Production launch blocker |
| HTTPS cookie/CSRF deployment | Local evidence only | Requires deployed environment evidence |
| GitHub Actions | Not verified | No remote/authentication available |

## K. Updated risk register

- **P0:** Stage B authorization and product/database owner signatures absent.
- **P0:** Legacy fresh migration replay fails; reconciliation is not authorized.
- **P1:** Original QBMS cold-start 500 root cause remains not verified, pending the 10-trial gate.
- **P1:** No GitHub-hosted recovery workflow run.
- **P1:** TLS-bypass origin unresolved in the inherited tool launch environment.
- **P1:** Managed Redis and real email delivery unverified.
- **P1:** Student public-question/challenge UI and complete browser-format matrix incomplete.
- **P2:** Accessibility and performance/load evidence incomplete.

## L. Sprint 2 functional decision

**PARTIALLY COMPLETE / ACCEPTANCE EVIDENCE IMPROVED.** Authenticated synthetic workflows pass in isolated local environments, but the complete product acceptance matrix and cold-start root-cause closure are not yet proven.

## M–O. Gates

- Stage B: **NOT READY FOR APPROVAL**.
- Sprint 3: **NO-GO** until the migration and acceptance gates are separately approved.
- Production: **NO-GO** from local evidence alone.

## P. Required approvals and next actions

1. Complete the 10 independent cold-start trials and append exact counts, failures, traces and persisted-row evidence.
2. Run the recovery workflow on GitHub after a remote and authentication are supplied; record run ID, SHA and artifact ID.
3. Product owner and database owner review the immutable candidate manifest and baseline checksum.
4. Obtain separate Stage B authorization before any active-database reconciliation.

Product-owner approval: **NOT GIVEN** — name/date/signature: ____________________  
Database-owner approval: **NOT GIVEN** — name/date/signature: ____________________

## Verification command record

| Command/evidence | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Pass (prior closure evidence) |
| `pnpm db:generate` | Pass (prior closure evidence) |
| `pnpm verify:structure` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass: 14 suites / 59 API tests plus 5 rules tests |
| `pnpm lint` | Pass |
| `pnpm build` | Pass during cold-start runner |
| `pnpm test:integration` on isolated `stage_a_fresh` | Pass |
| recovery `prisma migrate status` | Pass: one migration, schema up to date |
| `node scripts/verify-recovery-schema.mjs` | Pass: 39 tables, 101 indexes, 347 constraints, 6 functions, 41 triggers |
| `git diff --check` | Pass |
| active DB read-only identity query | `netslet_dev`, 15 applied legacy migrations, 0 recovery-baseline rows |
| GitHub Actions execution | **NOT VERIFIED**: no remote/authentication |

All database commands in this increment targeted the isolated rehearsal or candidate databases. No active migration command, reset, volume deletion or Stage B reconciliation was executed.
