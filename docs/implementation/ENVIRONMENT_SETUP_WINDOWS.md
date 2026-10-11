# Windows + WSL2 + VS Code installation and start guide

## One-time tools
In Administrator PowerShell: `wsl --install -d Ubuntu` (reboot if requested). Install Docker Desktop, VS Code (with WSL extension), and Git. In Docker Desktop enable **Settings > Resources > WSL Integration > Ubuntu**. On Ubuntu install Node.js **24.11+** (e.g. via `nvm`; see https://github.com/nvm-sh/nvm), then `npm install -g pnpm@10.19.0`.

Keep the repository in the WSL Linux filesystem, e.g. `~/projects/net-slet-platform`, **not** under `/mnt/c/`, for reliable watch performance. In the Ubuntu terminal open the project using `code .` (VS Code Remote - WSL).

## First run
From the repository root in Ubuntu:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
pnpm install
pnpm infra:up
# Confirm services healthy: docker compose ps
pnpm db:generate
pnpm db:migrate
pnpm dev
```

If migration asks for a name, use `init_exam_catalog` only after reviewing `apps/api/prisma/schema.prisma`. This migration creates **skeleton entities** and must be committed to Git with `pnpm-lock.yaml`.

Open `http://localhost:3000` and `http://localhost:4000/api/v1/health/live`, and check `http://localhost:4000/api/v1/health/ready`. The API readiness result depends on Docker PostgreSQL/Redis being available.

Open a second terminal and run:

```bash
pnpm verify:structure
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm smoke
```

When these succeed, initialize the Git repo (if not already), commit the source and generated migration/lockfile, and create/push a **private** GitHub repository. **Never commit `.env` files or secret values.**

## Troubleshooting
- Cannot resolve packages during installation: verify Ubuntu networking, proxy and npm registry; the supplied ZIP intentionally omits `node_modules` and `pnpm-lock.yaml` because dependency installation could not be performed in its authoring environment.
- Port busy: inspect `docker compose ps` and local listeners; if changing exposed PostgreSQL/Redis ports also update API env URLs.
- Missing generated Prisma import: run `pnpm db:generate`; `apps/api/src/generated/` is intentionally gitignored.
- API startup fails: check `apps/api/.env`, Docker health and `pnpm db:migrate`.
- Redis readiness fails: check Docker Redis; readiness is intentionally strict, while the lightweight liveness route should still work when app starts.
- Web may load when backend is down but API readiness will be reported unavailable.
- GitHub Actions frozen-lockfile failure: run and commit `pnpm install` locally first.

## Codex onboarding
Install the official Codex VS Code extension and start from project root. Ask the agent to read `AGENTS.md` and all appendices in the master knowledge base first. Use `docs/implementation/SPRINT_0_CHECKLIST.md` as the current task tracker. Review any proposed diff before accepting, especially database migrations and exam rules.
