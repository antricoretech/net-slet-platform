# Production-readiness implementation

This increment is based on main merge `d17172055b461638f9f4df70e4c7be8ae546b234` and is intentionally limited to reproducible application packaging, fail-closed runtime configuration, protected migration-target diagnostics, and release workflow preparation. It does not reconcile `netslet_dev`, restore a backup, provision a cloud account, or deploy an application.

## Runtime contract

`apps/api/src/config/runtime-config.ts` is the API startup contract. Development and test may use local PostgreSQL/Redis and HTTP origins. Staging and production require:

- non-local PostgreSQL and Redis URLs;
- TLS Redis in production (`rediss:`);
- HTTPS browser and API origins;
- a non-placeholder `SESSION_SECRET` with at least 32 characters;
- secure cookies and explicit trusted-proxy hops;
- non-console email delivery with provider URL, key and sender;
- optional object-storage settings only when `OBJECT_STORAGE_ENABLED=true`.

The process fails before Nest starts if `NODE_TLS_REJECT_UNAUTHORIZED=0`, a wildcard origin, a local release endpoint, insecure cookies, missing release secrets, or invalid URLs are present. Secrets are validated but never included in returned configuration or logs.

The root `pnpm` overrides pin Prisma CLI transitive dependencies `deepmerge-ts@8.0.2` and `mysql2@3.24.6`, resolving the high-severity audit findings present in the inherited lockfile. `pnpm audit --prod --audit-level=high` reports no known vulnerabilities after the lockfile update.

The web build validates `NEXT_PUBLIC_API_BASE_URL` for staging and production and emits a standalone Next.js image. API and web images run as the non-root `node` user with read-only staging-compose files and health checks.

## Migration safety

`apps/api/scripts/verify-migration-target.mjs` is read-only. It accepts only `MIGRATION_TARGET_URL`, requires an explicit database and non-5432 port identity, rejects `netslet_dev`, local hosts and ambiguous URLs, and can verify the connected PostgreSQL identity with `--verify`. It never edits `_prisma_migrations` and never invokes Prisma migration commands.

The supported release sequence remains:

1. fresh isolated provisioning from `recovery/stage-a/prisma/migrations`;
2. custom-format backup and checksum verification;
3. restore into a new disposable target;
4. read-only object, data and migration-ledger comparison;
5. separately approved metadata reconciliation using Prisma-native commands;
6. post-change integration and browser checks;
7. rollback to the verified restore target or backup if any stop condition is met.

No step above was executed against the active database by this change.

## Evidence boundaries

The staging and production workflows are release-readiness gates, not deployment jobs. They build and validate artifacts, require protected environment approval for production readiness, and leave deployment and migration reconciliation to a separately authorized release operation. Capacity remains unclaimed until a representative isolated load test measures the required workloads.

## Performance evidence

`pnpm perf:baseline` runs the same isolated-service harness against liveness, form catalogue and learner-history retrieval. Set `PERF_BASE_URL`, `PERF_ISOLATED=1`, and optional `PERF_CONCURRENCY`, `PERF_ITERATIONS` and synthetic `PERF_SESSION_COOKIE`. It records p50/p95/p99 latency and errors; it does not claim 25,000-session capacity and does not run against production URLs.
