# Pattern lifecycle API

Pattern data is cycle- and subject-specific. This increment does not seed or certify any real examination pattern.

## Public reads

- `GET /api/v1/catalogue/examinations/:examinationCode/patterns`
- `GET /api/v1/catalogue/examinations/:examinationCode/patterns/:patternId`

Only `PUBLISHED` versions are returned. The response is allowlisted to examination code, cycle code, subject code, version, publication status/time, checksum, official source URL and the immutable publication snapshot. Reviewer identity, approval records, audit metadata and unpublished rules are not public.

## Protected lifecycle writes

- `POST .../patterns` — `ADMIN`; creates a `DRAFT` for one cycle, subject and version.
- `POST .../patterns/:patternId/submit-review` — `ADMIN`; moves an evidenced draft to `SME_REVIEWED`.
- `POST .../patterns/:patternId/approve` — `SME`; records an approval decision and evidence checksum.
- `POST .../patterns/:patternId/reject` — `SME`; records a rejection decision.
- `POST .../patterns/:patternId/publish` — `ADMIN`; publishes an approved version and supersedes only the prior published version for the same cycle and subject.

Draft evidence requires an HTTPS official source URL, document title, issuing authority, publication/effective dates where available, a SHA-256 source-document hash, evidence excerpt, rights-safe artifact reference, question-bank coverage and a regression report identifier. Publication requires a matching rule checksum and immutable snapshot. Published versions are not editable; historical versions remain queryable internally as `SUPERSEDED` records.

## Evidence boundary

The workflow records evidence and review metadata but does not verify an external bulletin or assert official affiliation. `RESEARCH_ONLY` information must remain outside publication until an authorized reviewer supplies sufficient evidence.
