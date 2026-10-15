# Sprint 3A/3B CBT examination engine implementation plan

**Branch:** `feature/sprint-3-cbt-engine`  
**Scope:** schema-independent CBT foundation and development-only student preview  
**Explicitly excluded:** Prisma migrations, active-database changes, durable attempt persistence, production deployment, GitHub Actions repair and Sprint 3C implementation.

## Current-state analysis

- `packages/exam-rules` already validates research-only, multi-section and multi-session blueprints and checks publication evidence metadata. It does not yet select approved questions, snapshot forms, model attempt state or calculate palette states.
- `apps/api` owns authentication, catalogue, approved/published pattern reads, syllabus taxonomy and QBMS review/publication. Published question revisions and published exam-pattern snapshots are immutable at the database layer.
- `apps/web` has public catalogue/auth pages and an authenticated QBMS workspace, but no candidate-facing CBT preview.
- Prisma contains pattern/session/section/scoring configuration and immutable question-version models, but Sprint 3A must not add or apply attempt tables.
- Existing tests use Vitest for `exam-rules`, Jest for the API and Playwright for browser journeys. The new pure domain tests belong in `packages/exam-rules`.

## Reusable components and boundaries

1. Extend `packages/exam-rules` with pure, side-effect-free contracts and functions.
2. Keep blueprint validity separate from official verification; only `APPROVED` patterns with evidence may produce an official-ready form.
3. Accept a normalized published-question inventory at the domain boundary rather than coupling form generation to Prisma.
4. Return candidate-safe projections from the domain package; answer keys and private explanations are not representable in candidate question data.
5. Use injected clocks for state/deadline calculations. Browser timers are display-only.
6. Build a development-only preview page from static synthetic data and the same domain functions. Do not call the API or imply an official mock.

## Proposed module boundaries

`packages/exam-rules/src/blueprint.ts` remains the blueprint validation boundary. New modules:

- `form.ts`: deterministic approved-question selection and immutable form snapshots.
- `attempt.ts`: `CREATED → READY → IN_PROGRESS → SUBMITTED/EXPIRED` state machine and server-time calculations.
- `palette.ts`: five candidate navigation states.
- `contracts.ts`: candidate-safe catalogue, instructions, sections, question, attempt and answer-save contracts.

The preview UI is under `apps/web/src/app/practice/preview` and is marked development-only in both page copy and route metadata. It uses no persistence and is not linked as an official exam.

## Dependencies and constraints

- A form requires a structurally valid, `APPROVED` blueprint and a non-empty published question inventory.
- Every selected question must match exam cycle, subject, section type and requested language, and all grouped items must be selected as complete groups.
- Attempt persistence, answer durability, idempotency, concurrency, scoring runs and expiry workers are Sprint 3C dependencies and remain unimplemented here.
- No blueprint is certified by this repository unless approved evidence metadata is present.

## Implementation sequence

1. Add domain types and validation refinements.
2. Implement deterministic selection and snapshot hashing.
3. Implement attempt state transitions, deadline calculations and palette logic.
4. Implement candidate-safe projections and answer-save request validation.
5. Add exhaustive Vitest coverage for invalid blueprints, grouped/duplicate inventory, language/type filtering, state transitions, deadlines, palette states and leakage.
6. Add a database-independent development preview route using a clearly synthetic research-only fixture.
7. Run lint, typecheck, unit tests and production build; preserve unrelated Sprint 1–2 changes.

## Acceptance criteria

- No global 150-question, 180-minute or universal scoring assumptions.
- Invalid/incomplete blueprints fail with actionable errors.
- Form generation is deterministic for the same blueprint, inventory, seed and language.
- Only approved/published question versions can enter a form; insufficient inventory fails explicitly.
- Grouped comprehension/DI questions remain complete and are never duplicated.
- Snapshot includes exact question-version IDs, blueprint identity, seed, selection order, rule hash and creation timestamp.
- Candidate projections contain no answer key, explanation, scoring secret or reviewer metadata.
- State transitions reject invalid transitions and use injected server time.
- All five palette states are deterministic and accessible.
- Preview is development-only, synthetic, non-persistent and clearly not official.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

## Sprint 3C readiness assessment

Not ready to implement. Before persistence, compare the proposed entities (`Test`, `TestForm`, `TestFormQuestion`, `Attempt`, `AttemptSession`, `AttemptAnswer`, `AnswerSelectionEvent`, `ScoreRun`, `Result`, `AttemptAuditLog`) against the current Prisma schema, obtain an approved transaction/idempotency design, and authorize a separate database migration increment. The active database and historical migrations remain untouched.

## Sprint 3B delivery update

The development-only student journey now includes an entry/instructions screen, exam-cycle and subject summary, language availability messaging, readiness/start confirmation, a responsive player shell, paper/section tab boundary, server-deadline-compatible timer presentation, accessible palette legends, navigation, clear/review/save controls, submission confirmation and expiry views. Question rendering uses React text nodes and table semantics; it does not render raw HTML or candidate-inaccessible metadata. The synthetic fixture includes a grouped comprehension/data item to exercise grouped rendering.

The future persistence boundary is `apps/web/src/lib/cbt-attempt-adapter.ts`. It exposes typed form/state/save/submit operations but has no implementation and cannot claim durable answer persistence. The preview is gated on the server by `NODE_ENV !== 'production'` plus an explicit local flag; the public flag is an enablement switch, not a security boundary.

Sprint 3B remains preview-only. Production readiness still requires authenticated catalogue/attempt APIs, server-persisted deadlines, durable idempotent answer mutations, authorization and concurrency checks, approved migration reconciliation, scoring, expiry workers and full authenticated E2E coverage against those services. No active database or Prisma migration was changed in this increment.

## Sprint 3C.0 delivery update

Sprint 3C.0 adds the database-independent attempt aggregate and scoring boundary in `packages/exam-rules`, proposed typed API contracts, and a future adapter seam. The implementation enforces owner checks, expected revisions, idempotency fingerprints, trusted-clock deadlines, session locking, chronology-preserving answer events, finalization rules and integer-scaled scoring. It does not register controllers or claim durable persistence. The detailed design, persistence proposal and test report are in `docs/SPRINT-3C-ATTEMPT-ENGINE-DESIGN.md`, `docs/SPRINT-3C-PERSISTENCE-AND-MIGRATION-PROPOSAL.md` and `docs/SPRINT-3C-IMPLEMENTATION-REPORT.md`.

## Sprint 3D.0 delivery update

Sprint 3D.0 extends the low-level scorer with explicit versioned policy validation, provenance/research-only boundaries, paper/section score breakdowns, candidate-safe result projections, authorized explanation release, evidence-based analytics, hypothetical strategy analysis and auditable rescore comparisons. The illustrative results page is server-gated and synthetic. Production scoring, result publication and database integration remain blocked pending verified rule evidence and the Stage B persistence gate. See the Sprint 3D design and implementation reports for details.

## Sprint 3E.0 delivery update

Sprint 3E integrates the synthetic CBT path through an in-memory adapter backed by the existing form and attempt engines, adds cross-module QA/security traceability and a deterministic pure-engine benchmark. The adapter is intentionally non-durable and preview-only. The six pattern-family matrix, reliability limitations and performance scope are documented in the Sprint 3E evidence files. Sprint closeout remains conditional on Stage B/database authorization, official rule verification and production infrastructure validation.

## Learning Track L0.A update

L0.A adds a separate practice-session engine and temporary learning preview. It reuses published-question and candidate-safe contracts but does not modify strict examination attempts, official scoring or persistence. See `docs/LEARNING-L0-IMPLEMENTATION-PLAN.md`, `docs/LEARNING-L0A-PRACTICE-ENGINE-DESIGN.md` and `docs/LEARNING-L0A-IMPLEMENTATION-REPORT.md`.
