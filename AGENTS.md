# Codex project contract — Project NET/SLET v2.2

## Mission and requirement precedence
Read `docs/requirements/Project_NET_SLET_Master_Knowledge_Base_v2_2.md` **before making changes**. It contains complete available v2.0, v2.1 and v2.2 text. Read `docs/decisions/ADR-0001-architecture.md` and `docs/exam-patterns/README.md` next.
- Original BRD v2.0 is an approved initial scope reference.
- v2.1 corrects/supersedes v2.0's universal examination pattern assumptions; per examination, cycle and subject use independently verified official evidence.
- v2.2 USP ideas are product proposals, not automatically approved functionality.
- Do not silently promote `RESEARCH_ONLY` details into official, approved, or published patterns.
- Record conflicts/decisions in `docs/decisions/` before acting on consequential ambiguity.

## Technology decisions
- Single pnpm monorepo: `apps/web` (Next.js/React/TypeScript) and `apps/api` (NestJS modular monolith).
- PostgreSQL + Prisma for durable authoritative exam attempts, question revisions, score runs and audit history. Redis + BullMQ for cache/async work, **not** source of truth.
- `packages/exam-rules` remains an independently tested, deterministic, side-effect-free rules library.
- Docker Compose for local Postgres/Redis; later object storage and PWA features after approved stories.
- Node.js 24 LTS, TypeScript strict, typed interfaces, accessible student UI and clean API ownership checks.

## Non-negotiable product correctness
1. Strict timed attempts must use server-persisted deadlines; reconnect never grants new time without an approved rule.
2. Every **acknowledged** answer mutation must commit durably to PostgreSQL before success is returned. Idempotency, stale revision detection and authorized ownership are mandatory.
3. Versioned immutable exam patterns, question versions and scoring runs; key corrections and authorized rescoring are audit-visible.
4. UGC NET, CSIR NET and each SET/SLET are separate examination identities. Do **not** hardcode 150/180/+2/0 globally. The exact rules must come from an approved exam-cycle/subject blueprint.
5. No confidential keys, answer options, private student records or unpublished question text in public APIs, logs or client bundles.
6. Any item labeled `OFFICIAL_PATTERN`/`VERIFIED` requires official evidence, authenticated reviewer, approval metadata and regression evidence. Currently **no** exam patterns are certified by this repository.
7. Do not invent student results, exam official affiliation, qualification predictions or content licenses.

## Agent operating procedure
1. Inspect the present code and docs. State proposed small increment, files affected, acceptance criteria, risks and test plan.
2. Make only scoped changes. Preserve user modifications; never delete source documents, overwrite migrations or discard unknown files.
3. Add/revise automated tests with every executable behavior change. Test edge cases including retries, expiry, scoring penalties, concurrency and authorization when applicable.
4. Execute appropriate `pnpm` checks when dependencies are installed. Report exact commands and pass/fail. **Never claim checks passed if not run.**
5. Prefer simple architecture to invented distributed microservices. Separate infrastructure readiness from functional exam completeness.
6. Do not commit secrets or production configuration. Do not enable autonomous deployment, chargeable services or publication without explicit approval.
7. Finish each change with: summary, files modified, tests executed, known limitations, and next recommended incremental task.

## First Codex task
Read the full baseline and current repository, review the Sprint 0 checklist, verify dependency compatibility, install packages on the user's machine, generate the Prisma client/migration, run local Docker services and checks. **Do not implement Sprint 1 authentication or test-taking functionality before the foundation passes and approval is received.**
