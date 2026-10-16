# Release 1 engineering consolidation evidence

Status: implementation evidence prepared on `feature/academic-verification-pyq-acceptance`.

## Scope

This increment closes the previously identified acceptance gap for historical PYQ governance and ingestion. It adds a fail-closed, authenticated HTTP harness against the disposable `netslet_stageb_ci` database, a development-only governance workspace, and the evidence matrix below. It does not modify Prisma schema or migrations.

## Acceptance gates

| Gate | Evidence | Status |
| --- | --- | --- |
| Authenticated governance API | `apps/api/scripts/historical-pyq-http-integration.mjs` exercises unauthenticated, ADMIN, SME and STUDENT access | Pending CI execution at this head |
| Import hardening | 21-row concurrent dry-run, duplicate manifest convergence, commit ownership, malformed CSV rejection | Pending CI execution at this head |
| Separation of duties | Role guards and manifest-owner commit check are exercised over HTTP; full metadata approval needs populated academic fixture | Partial |
| Reviewer workspace | `/workspace/historical-governance` calls the real governance queue and decision endpoints | Pending Playwright execution |
| Student historical inventory | Existing `/preparation/[examinationCode]/pyqs` route remains the student surface; no new public disclosure path added | Existing coverage |
| Migration integrity | No migration files changed; CI recovery replay previously passed at `e961a80` | Verified at prior head; rerun required for this increment |

## Safety properties

The HTTP harness refuses non-local hosts, any database other than `netslet_stageb_ci`, or any PostgreSQL port other than 5432. Fixture accounts and audit/session rows are deleted in `finally`; no active development database is a valid target.

The import checksum is the canonical record-payload checksum documented in `docs/SPRINT-9.2-IMPORT-AND-ACCEPTANCE-CONTRACT.md`. It is intentionally distinct from the manifest hash. The test does not treat a rejected source as publishable content.

## Known limitations

The HTTP fixture uses rejected synthetic records to test import transport, validation, idempotency and ownership without manufacturing official academic evidence. A separate approved fixture is required before claiming full end-to-end approval, rights verification and publication eligibility over HTTP. Those states remain enforced by the service and existing unit tests.

No GitHub review, merge, deployment or production acceptance is implied by this document.
