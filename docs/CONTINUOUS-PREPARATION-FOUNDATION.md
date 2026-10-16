# Continuous Preparation Foundation

The preparation product is year-round and cycle-independent. Examination cycles remain required metadata for official pattern evidence, historical PYQs and immutable historical attempts, but they are not required for ordinary Paper I discovery or topic practice.

## Resolution rules

`packages/exam-rules/src/preparation.ts` provides a pure current-pattern resolver:

- Paper I discovery does not require a cycle or Paper II subject.
- Paper II and full mocks require an explicit subject.
- Only active `APPROVED`/`PUBLISHED` patterns with verified evidence and a valid rule hash may resolve.
- Research-only, superseded, expired and unverified candidates fail closed.
- Equal active candidates are ambiguous unless an approved precedence reference resolves them.
- Historical pattern versions and cycles are never overwritten by current resolution.

## Paper I and Paper II

Paper I is the first preparation onboarding path. The domain contracts support topic practice without a historical cycle, while preserving existing question-version, syllabus and explanation requirements. Paper II uses the same reusable architecture with a required subject code; no subject is selected by default.

Full mocks remain a governed publication action. They require an applicable verified pattern, both papers, sufficient qualified inventory and publication authorization. The implementation does not claim that official content or any subject inventory is currently available.

## Historical PYQs and analytics

Historical PYQs retain authority, year, cycle, session, paper, subject, source and rights metadata. Discovery filters expose only `CLEARED` material. Continuous analytics can span practice and historical attempts, but score-policy references are compared before scores are treated as comparable.

This increment does not alter Prisma schema, active APIs, migration history, active databases or production configuration. Authenticated API/UI wiring should consume these contracts in the next approved student-journey increment.
