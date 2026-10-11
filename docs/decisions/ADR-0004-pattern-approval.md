# ADR-0004 — Evidence-backed pattern approval and publication

**Date:** 2026-10-12  
**Status:** Accepted for Sprint 1C

## Decision

Store exam pattern versions by examination cycle, subject and version. A version moves through explicit states:

`DRAFT` → `SME_REVIEWED` → `APPROVED` → `PUBLISHED` → `SUPERSEDED`

An explicit `REJECTED` terminal review outcome is also recorded. Administrators prepare and submit drafts; only an `SME` can approve or reject them; an `ADMIN` publishes an approved version. Approval requires an HTTPS official source URL, document title, issuing authority, evidence excerpt, rights-safe artifact reference, question-bank coverage, source-document SHA-256, reviewer identity, review timestamp, regression report identifier and a checksum matching the deterministic `packages/exam-rules` validation input. Publication copies the validated rules into `publishedSnapshot` and records audit events for publication and supersession.

Only published versions cross the public API boundary. Public responses expose no reviewer identity, approval notes or private audit data. No real examination pattern is seeded or certified by this increment.

## Consequences

- Subject-specific overrides are first-class and cannot collide across subjects.
- Published history is reproducible from the immutable snapshot and remains separate from later versions.
- PostgreSQL triggers reject mutation of published/superseded patterns and their normalized child configuration.
- Evidence metadata is captured for review but is not itself external verification.
- The schema and audit records support later authenticated reviewer workflows without treating Redis or client state as authoritative.
