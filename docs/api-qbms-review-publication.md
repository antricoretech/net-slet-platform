# QBMS review and publication API — Sprint 2C

Internal review routes require authenticated SME/Admin sessions. Students cannot access them.

- `POST /qbms/questions/:questionId/revisions/:versionId/submit-review` — submit a complete draft.
- `GET /qbms/questions/review/queue` — retrieve the review queue; SMEs see only assigned revisions, while administrators see the full queue.
- `POST /qbms/questions/:questionId/revisions/:versionId/assign-reviewer` — Admin assigns an SME.
- `POST /qbms/questions/:questionId/revisions/:versionId/review` — assigned SME approves review.
- `POST /qbms/questions/:questionId/revisions/:versionId/reject-review` — assigned SME rejects review.
- `POST /qbms/questions/:questionId/revisions/:versionId/approve` — distinct Admin approves for publication.
- `POST /qbms/questions/:questionId/revisions/:versionId/publish` — distinct Admin publishes an approved revision.
- `GET /qbms/questions/:questionId/publication-history` — authorized publication history.
- `GET /qbms/public/questions/:questionId?language=en` — student-safe published prompt/options projection.
- `POST /qbms/questions/:questionId/revisions/:versionId/challenges` — authenticated challenge against a published revision.
- `GET /qbms/questions/challenges/:challengeId` — reporter-safe challenge status; staff may inspect resolution notes.
- `POST /qbms/questions/challenges/:challengeId/resolve` — SME/Admin resolution.

Publication gates require answer key, explanation, syllabus mapping, provenance, and acceptable rights evidence. Published revisions and their child records are database-protected from mutation.
