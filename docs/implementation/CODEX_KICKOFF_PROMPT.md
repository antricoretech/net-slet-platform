# Codex kickoff prompt — paste into the VS Code Codex chat

You are the lead engineering agent for Project NET/SLET v2.2, currently at Sprint 0. Work **only in this repository**.

**Read first, before editing anything:**
1. `AGENTS.md`
2. `docs/requirements/Project_NET_SLET_Master_Knowledge_Base_v2_2.md` including all appendices, with particular attention to rules precedence, operational constraints and requirement provenance
3. `docs/decisions/ADR-0001-architecture.md`
4. `docs/exam-patterns/README.md`
5. `docs/implementation/SPRINT_0_CHECKLIST.md`
6. Existing application, API, Prisma and GitHub Actions configuration

**Your mission now:** Validate, troubleshoot and complete Sprint 0 locally. Do not implement Sprint 1 functionality yet. Begin by outlining the requirements and risks you found, and a sequenced action plan. Inspect the actual installed versions and compare against official Next.js/NestJS/Prisma/pnpm docs before recommending upgrades. Check if Node, pnpm, Docker, Postgres and Redis are available; do not install global system tools or run destructive commands without asking me.

**Once I approve the plan:**
- Install project dependencies and commit `pnpm-lock.yaml` in the local repository.
- Create the local `.env` files from examples without exposing credentials or committing secrets.
- Start Docker services, generate Prisma client, inspect the initial schema and create the migration.
- Run `pnpm verify:structure`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`, then launch both apps and run `pnpm smoke`.
- Fix any actual failures, with minimal scoped edits and corresponding tests, and report the exact results rather than assuming success.
- Verify no unapproved national or state examination pattern is labeled official, and do not add unverified production seed data.
- Create a local branch for each feature after Sprint 0; keep commits reviewed and small.

**At the end:** Summarize which checklist items passed, errors remaining, any dependencies on user action, all files changed, and a prioritized Sprint 1 proposal. No production deployment, billable services, student data ingestion or secret-sharing without explicit consent.
