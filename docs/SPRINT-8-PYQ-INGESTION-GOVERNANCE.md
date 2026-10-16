# Sprint 8 — PYQ Acceptance Hardening and Governed Ingestion

## Student discovery contract

Historical PYQ discovery is fail-closed. The server applies all persisted qualification checks before slicing a bounded, deterministic result set. A record must have a verified exact question version, matching examination family and subject, active publication, academic answer-key/explanation/mapping readiness, two approved reviewers, cleared rights, an unrevoked and unexpired rights grant, and a structured rights scope containing `PYQ_DISCOVERY` plus the requested language (or an explicit `*`). Missing or ambiguous scope is not authorization.

The scan is bounded at 10,001 records and page numbers are capped at 100 with page sizes capped at 100. The endpoint never reports restricted rows as page totals. If the bounded scan is exhausted, `hasNextPage` remains conservative rather than claiming a complete count.

## Ingestion lifecycle

`POST /admin/preparation/historical-pyq-imports/dry-run` accepts structured JSON records or CSV. It validates question-version identity, exam-cycle/family/subject compatibility, source authority/reference/checksum, historical dimensions, language authorization, rights scope/evidence, licence association and duplicates. It persists an immutable import manifest and row-level rejection evidence; it never creates student-visible metadata.

`POST /admin/preparation/historical-pyq-imports/:manifestId/commit` is ADMIN-only. It is idempotent for the same manifest and creates records as `IMPORTED`, `UNVERIFIED`, and `publicationEligible=false`. It does not approve, verify, publish, or silently overwrite an existing question version's metadata. A differing second record for the same question version is rejected as a governed correction requirement.

SMEs may dry-run imports; only administrators may commit them. Academic verification, rights verification, approval and publication eligibility remain separate transitions and must be audit-visible. Import manifests, row payloads, fingerprints, rejection reasons and audit events provide the evidence trail.

## Administrative readiness

`GET /preparation/readiness/historical-questions` remains authenticated and restricted to ADMIN/SME. It reports imported, validated, verified, review-pending, rights-pending, rejected, duplicated and publication-ready totals, with examination family, subject, paper, unit/topic, language, cycle/year, review status, rights status and source verification dimensions. It does not expose question text, answer keys or private licence terms.

## Safety boundary

The migration is additive and forward-only. Validation and CI replay must use disposable services. No active `netslet_dev` database, protected cold-start artifact, production database, historical migration or deployment is modified by this increment.
