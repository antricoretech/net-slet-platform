# QBMS workspace

Sprint 2D adds the protected Faculty/Administrator workspace under `/workspace`.

| Route | API integration | Purpose |
|---|---|---|
| `/workspace` | `GET /auth/me`, questions, review queue | Live operational counts and warnings |
| `/workspace/questions` | `GET /qbms/questions`, `GET /qbms/questions/:id` | Filtered explorer and protected detail view |
| `/workspace/questions/new` | question, answer-key, explanation and provenance POST endpoints | Structured authoring for all eight question types |
| `/workspace/review` | review queue plus review/approval/publication POST endpoints | Role-aware review decisions enforced by the API |
| `/workspace/challenges` | `GET /qbms/questions/challenges`, triage and resolve endpoints | Staff queue with search, status filtering, pagination and resolution controls |

The browser client sends session credentials and never embeds database credentials, answer keys in public routes, or unpublished question content in logs. Student accounts are rejected by the workspace shell and remain protected by the API guards. Challenge queue responses omit reporter identity; student challenge reads remain ownership-scoped.

## Migration safety gate

Sprint 2D intentionally creates no schema migration. Disposable replay currently fails at `20261011222455_syllabus_taxonomy_foundation` because it alters `EmailVerificationToken` and `PasswordResetToken` before `20261012000800_auth_lifecycle_tokens` creates those tables. The healthy development database was not reset or altered.

The controlled repair proposal is recorded in [ADR-0009](decisions/ADR-0009-migration-repair-proposal.md). It evaluates a verified baseline/squash against history rewriting, `db push`, `migrate resolve`, and reset approaches. A repair must first be rehearsed on a disposable database and account for data transformations, enums, constraints, indexes, functions, triggers, and migration history.
