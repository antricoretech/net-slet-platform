# Release 1 integration matrix

This is a traceability index, not a claim that every row passed in the current increment.

| Area | Command or evidence | Current status |
| --- | --- | --- |
| Prisma client and replay | `pnpm db:generate`; recovery-config `prisma migrate deploy` | Prior recovery CI passed; current increment must rerun CI |
| TypeScript | `pnpm typecheck` | Prior PR CI passed at `e961a80`; current changes pending CI |
| Unit suites | `pnpm test` | 16 exam-rules suites/95 tests and 25 API suites/117 tests passed at `e961a80`; current changes pending CI |
| Lint/build | `pnpm lint`, `pnpm build` | Prior PR CI passed; current changes pending CI |
| PostgreSQL integration | `pnpm test:integration` | Prior PR CI passed; current changes pending CI |
| Authenticated PYQ HTTP | `pnpm test:historical-pyq:http` with `HISTORICAL_PYQ_HTTP_ACCEPTANCE=1` | Added; not yet run in this worktree |
| Reviewer UI | `/workspace/historical-governance` | Added; dedicated Playwright execution still required |
| Student UI | `/preparation/[examinationCode]/pyqs` | Existing route; no new student acceptance claim |
| Protected artifact | `test-results/cold-start-summary.json` SHA-256 `14899D4A4FD428CE4DDFC9923B0AC702A4394E43F0FDD4A1620BB0C60E2CA9D2` | Must remain unchanged and untracked |

## Acceptance interpretation

“Pending” means the implementation exists but no result is recorded for the current head. No pending row may be promoted to passed from local unit results or an earlier commit.
