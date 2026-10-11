# Sprint 0 — Definition of done and execution evidence

## Setup
- [ ] Node 24.11+ and pnpm 10 installed in WSL2 Ubuntu
- [ ] Root `.env`, API `.env`, web `.env.local` created from examples (local only)
- [ ] `pnpm install` succeeds and generates a committed `pnpm-lock.yaml`
- [ ] `docker compose up -d` starts healthy PostgreSQL and Redis
- [ ] `pnpm db:generate` succeeds
- [ ] `pnpm db:migrate` writes a **reviewed** initial Prisma migration
- [ ] `pnpm dev` starts both apps, web on 3000, API on 4000
- [ ] GET `/api/v1/health/live` succeeds
- [ ] GET `/api/v1/health/ready` reports PostgreSQL and Redis ready

## Engineering quality
- [ ] `pnpm verify:structure`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm smoke`
- [ ] GitHub Actions `CI` passes using the lockfile
- [ ] GitHub repository is private; `.env` ignored; no secrets committed

## Product gates before Sprint 1
- [ ] Resolve pattern approval/status schema design questions in ADR
- [ ] Agree initial target examination/subject and reviewer
- [ ] Define learner/admin roles and auth security acceptance criteria
- [ ] Prioritize Sprint 1 stories and stop Codex from inventing official data

## What this starter cannot demonstrate
No online exam, attempt persistence, learner auth, scoring, verified examination rules, production deployment, load testing or full PWA. Completion of Sprint 0 does **not** imply these have passed.
