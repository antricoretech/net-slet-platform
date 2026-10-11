# NET/SLET Preparation Intelligence Platform

A developer foundation for Project NET/SLET v2.0 -> v2.1 -> v2.2. It is not an exam-ready product and does not certify official examination rules.

## Architecture

```text
apps/web/                     Next.js + TypeScript responsive foundation
apps/api/                     NestJS + Prisma + PostgreSQL + Redis
packages/exam-rules/          Independent rules validation package
compose.yaml                  Local-only PostgreSQL and Redis
docs/                         Requirements, decisions and implementation records
.github/workflows/ci.yml      Unit, integration, build and browser pipeline
```

## Start on Windows + VS Code

Read [Windows/WSL setup](docs/implementation/ENVIRONMENT_SETUP_WINDOWS.md) and [Sprint 0 checklist](docs/implementation/SPRINT_0_CHECKLIST.md).

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
pnpm install
pnpm infra:up
pnpm db:generate
pnpm --filter @net-slet/api exec prisma migrate deploy
pnpm dev
```

Web: `http://localhost:3000`. API liveness: `http://localhost:4000/api/v1/health/live`. API readiness: `http://localhost:4000/api/v1/health/ready`.

## Quality checks

```bash
pnpm verify:structure
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm build
pnpm smoke
```

## Current Sprint 1 status

- Identity: database-backed sessions, role controls, credentialed CORS, Origin protection, Redis production rate limiting, durable verification/reset tokens, and configurable HTTPS webhook delivery are implemented. External provider verification, MFA and final threat-model signoff remain deployment/follow-up requirements.
- Catalogue: normalized examinations, organizers, jurisdictions, cycles and subjects with public reads and admin-gated writes are implemented. No real examination identities are seeded or certified.
- Patterns: structured sessions/sections/scoring/languages, evidence-backed review, deterministic hashes, immutable publication and supersession audit are implemented. No official pattern is certified.

Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Never claim external email delivery or official examination affiliation without deployment/provider or primary-source evidence.
