# QBMS question authoring API — Sprint 2B

Base path: `/api/v1/qbms/questions`.

All routes require a valid authenticated `SME` or `ADMIN` session. SMEs are restricted to questions they authored; administrators may manage all draft questions. No route returns a public question or unpublished answer key.

- `POST /` — create a draft question, including exam-cycle-subject context, syllabus version/topics, type, prompt, language, and initial options.
- `GET /` — paginated authoring list with optional `page`, `pageSize`, `type`, `status`, and `subjectCode` filters.
- `GET /:questionId` — retrieve the protected revision history and authoring records.
- `POST /:questionId/revisions` — create a new draft revision.
- `PATCH /:questionId/revisions/:versionId` — update draft prompt content.
- `POST /:questionId/revisions/:versionId/options` — add an option.
- `POST /:questionId/revisions/:versionId/answer-keys` — add a validated revision-linked answer key.
- `POST /:questionId/revisions/:versionId/explanations` — add an explanation and optional option rationales.
- `POST /:questionId/revisions/:versionId/mappings` — add a syllabus-topic mapping after context validation.
- `POST /:questionId/revisions/:versionId/provenance` — add source/provenance metadata.
- `POST /:questionId/revisions/:versionId/translations` — add an independently draft translation.
- `POST /:questionId/revisions/:versionId/licences` — add licence and rights metadata.

Question types and answer keys are validated deterministically. `PUBLISHED` revisions are protected by PostgreSQL immutability triggers; publication and correction transitions belong to Sprint 2C.
