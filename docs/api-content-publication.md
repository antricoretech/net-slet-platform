# Release 1 content qualification API

All routes are authenticated and restricted to `ADMIN` or `SME` accounts. They are administrative orchestration routes; they do not certify an examination or expose answer keys to students.

| Route | Purpose |
| --- | --- |
| `GET /admin/content-publication/patterns/:patternId/readiness` | Evaluate exact-cycle pattern evidence, checksum and approval state. |
| `POST /admin/content-publication/patterns/:patternId/inventory/qualify` | Inspect published question revisions, answer keys, explanations, mappings, translations, provenance, rights and two-person review evidence. |
| `POST /admin/content-publication/patterns/:patternId/forms/compile` | Compile a deterministic draft snapshot from explicitly selected qualified revisions. Stores answer-key version IDs on each form question. Use `qaOnly: true` for synthetic QA forms. |
| `POST /admin/content-publication/forms/:formId/publish` | Guarded, idempotent draft-to-published transition. Strict forms require explicit evidence/reviewer flags; QA-only forms remain non-official. |
| `GET /admin/content-publication/forms` | Development-only administrative listing of form state and snapshot hashes. |

Student discovery remains `GET /attempts/forms`, which filters to published forms with published patterns and rejects incomplete or non-candidate-safe snapshots. It never returns answer keys, explanations, provenance or reviewer data.

No route changes `_prisma_migrations`, active databases or historical migration files.
