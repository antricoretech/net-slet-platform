# Learning L0.B — Mistake Mine design

L0.B adds a deterministic, database-independent evidence layer after an authorized practice outcome. It does not infer correctness in the browser and does not alter the strict CBT attempt engine.

## Flow

`authorized practice outcome → immutable evidence → deduplicated aggregation → deterministic clusters → transparent remediation suggestion → student-safe projection`

Evidence is keyed by opaque learner reference plus source event ID. The source session, question/version, scoring policy/version, exam-cycle-subject identity, mappings, submitted response, confidence, self-report, trusted timestamp, provenance and answer-key lineage are retained. A repeated source event is idempotent; conflicting copies are rejected.

Same-question repeats are counted as events but not as independent repeated-error proof. Repeated-error status requires distinct question versions. A single correct response never establishes mastery. Missing topic mappings, missing incorrect evidence and insufficient independent questions remain explicit limitations.

The supported self-report categories are concept gap, misread, calculation, recall failure, option confusion, time pressure, careless response, guessed answer, other and prefer not to specify. Self-reports are learner-owned metadata, not staff conclusions.

## Safety boundary

`correctnessAuthorized` must be true and server-produced. Student projections never contain answer keys or unreleased explanations. Fresh parallel practice is marked unavailable when no reviewed inventory is supplied. L0.B does not implement spaced repetition, persistence, retention/deletion jobs or production APIs.
