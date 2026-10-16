# G09/G10/G11/G15/G31 Staging Readiness Package

## Configuration contract

Staging requires explicit values for `DATABASE_URL`, `REDIS_URL`, `WEB_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`, session/auth secrets, email-provider credentials, object-storage credentials and observability credentials. Values must come from the approved secret manager; `.env` files and logs must not contain them.

The staging origin must use HTTPS with certificate verification enabled. The API must reject ambiguous origins and the application must not inherit `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Acceptance checks

- Auth registration, verification, sign-in, refresh, revocation, password reset and role ownership.
- Candidate isolation for attempts, answers, results, learning evidence and support views.
- Accessible keyboard, focus, labels, timer, palette, error and expiry workflows.
- `/health/live` and `/health/ready`, with readiness failing closed when PostgreSQL or Redis is unavailable.
- Structured audit events without answer keys, private records, credentials or unpublished question text.
- Backup checksum, isolated restore, application smoke test and documented RTO/RPO.
- Non-root API/web images, pinned commit, reproducible lockfile and rollback owner.

## Monitoring and incident hooks

Track authentication failures, answer-write conflicts, late-answer rejections, expiry/finalization failures, publication/correction/rescore approvals, readiness failures, queue failures and database latency. Define alert thresholds, retention, escalation owner and a privacy review before enabling external telemetry.

No paid infrastructure, live provider, production endpoint or active database is provisioned by this package.
