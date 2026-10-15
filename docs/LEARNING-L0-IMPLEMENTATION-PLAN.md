# Learning Track L0.A Implementation Plan

## Scope

L0.A is a database-independent personalized-practice foundation parallel to the Sprint 4–5 persistence roadmap. It reuses published-question, candidate-safe projection, grouped-item and explanation-release boundaries from Sprint 3. It does not alter strict official attempts or scoring runs.

## Sequence

1. Add pure practice configuration/session generation and evidence signal contracts.
2. Add deterministic filtering for exam, cycle, subject, unit, topic, reviewed difficulty, language and question type.
3. Add practice response/confidence contracts without answer-key exposure.
4. Add a server-gated synthetic practice configuration/player preview.
5. Test inventory failures, group completeness, version locking, confidence and evidence-based signals.
6. Document L0.B mistake-mine dependencies and future persistence entities.

## Acceptance criteria

- Published question versions only; no fictional approval bypass.
- Deterministic, configurable mode/count/timing/language selection.
- Explicit insufficient inventory errors.
- Practice confidence and error-cause fields are learning-only.
- No unsupported mastery, percentile or misconception claims.
- Preview is server-gated, temporary and separate from official attempts.
- Persistence entities and transactions remain proposals only.

# L0.B increment update

L0.B adds the isolated Mistake Evidence Engine, Mistake Mine aggregation, deterministic clusters, evidence-based remediation contracts and a server-gated synthetic review route. It deliberately stops before persistence and spaced repetition. See `LEARNING-L0B-MISTAKE-MINE-DESIGN.md`, `LEARNING-L0B-EVIDENCE-AND-REMEDIATION-CONTRACTS.md` and `LEARNING-L0B-PERSISTENCE-PROPOSAL.md`.

## L0.B.1 governance increment

L0.B.1 adds database-independent eligibility, privacy/consent, learner authorization, content-readiness, analytics minimization, mastery-evidence and L0.C readiness-gate contracts. It does not query or change Prisma, implement production endpoints, or schedule retrieval. See `LEARNING-L0B1-EVIDENCE-GOVERNANCE-DESIGN.md`, `LEARNING-L0B1-PRIVACY-AND-CONSENT-REQUIREMENTS.md`, `LEARNING-L0B1-CONTENT-READINESS-ASSESSMENT.md` and `LEARNING-L0C-ENTRY-CRITERIA.md`.

## L0.D.0 PrepPilot increment

L0.D.0 adds provisional learner-profile, target, availability, next-best-action, time-budget, target-specific coverage and dashboard projection contracts, plus the server-gated synthetic `/dashboard/preview`. It does not implement durable study plans or L0.C retrieval scheduling. See the L0.D documents and `LEARNING-L0D-IMPLEMENTATION-REPORT.md`.

## L0.E.0 integration and QA increment

L0.E.0 audits and hardens the cross-module learning chain, adds invariant/traceability tests, verifies preview security boundaries, and corrects the consent-withdrawal fallback so non-personalized coverage remains possible without evidence-derived profiling. It does not activate production workflows, persistence or spaced revision. See the L0.E documents and `LEARNING-L0E-IMPLEMENTATION-REPORT.md`.

## Content Track C0.A — ExamDNA

C0.A adds exact-cycle source evidence, official pattern integrity, six-family compatibility, question inventory readiness, strict mock publication gates and a server-gated administrative readiness preview. It remains research-only until authorized evidence and review approvals exist. No active database or production publication is enabled.
