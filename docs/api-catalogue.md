# Examination Catalogue API — Sprint 1B

Base URL: `/api/v1/catalogue/examinations`

## Public reads

- `GET /` — paginated catalogue. Query parameters: `search`, `family`, `page`, `pageSize`.
- `GET /:code` — one examination identity, organizer, jurisdictions, cycle subjects and safe pattern-status summaries.
- `GET /:code/cycles` — cycle/subject catalogue metadata without unpublished rule JSON.

Public responses exclude pattern rule JSON, answer keys, private reviewers, audit records and unpublished approval evidence.

## Admin writes

- `POST /` — creates an examination identity with an organizer and one or more reusable jurisdiction mappings.
- `PATCH /:code` — updates the name, family, organizer and jurisdiction mappings. The examination code is immutable.
- `POST /:code/cycles/:cycleCode/subjects` — creates or updates a cycle-scoped `RESEARCH_ONLY` subject; `ADMIN` only.

Both write routes require an authenticated `ADMIN` session. Public registration always creates `STUDENT`, so an administrator must be assigned through a controlled process outside these routes. Create/update actions write audit events and never publish an official pattern automatically.
