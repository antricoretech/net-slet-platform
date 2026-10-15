# Learning Track L0.A Practice Engine Design

## Practice session boundary

`packages/exam-rules/src/practice.ts` defines five configurable practice families: topic, unit, mixed revision, weak area and quick timed sessions. A `PracticeConfig` identifies examination, cycle, subject, language, count, scope, allowed types, reviewed difficulty and optional timer. `generatePracticeSession` filters only `PUBLISHED` question versions matching those constraints and selects complete grouped items deterministically. It fails rather than silently relaxing scope.

Practice snapshots contain candidate-safe question projections, syllabus IDs and reviewed difficulty labels, never answer keys, explanations or review metadata. The snapshot is immutable and has a deterministic session identity.

## Responses and learning evidence

Practice responses support clear answer selection, optional `SURE`/`UNSURE`/`GUESS` confidence and optional controlled error causes. These fields are not part of strict examination attempts. `identifyLearningSignals` emits traceable signals only from supplied evidence: repeated incorrect, low-confidence correct, high-confidence incorrect and unattempted coverage. It does not diagnose a misconception from one wrong response and uses explicit recommendations rather than mastery claims.

## Content integrity

Language selection requires the requested language code on the published inventory. Difficulty filtering requires reviewed difficulty evidence. Grouped comprehension/data items are selected as complete groups. Approved explanations remain behind the existing authorized-release boundary.

## Future persistence

Proposed entities are `PracticeSession`, `PracticeResponse`, `PracticeConfidence`, `ErrorCause`, `PracticeResult`, `MistakeEvidence` and `RevisionCandidate`. Start, response and completion transactions must be owner-scoped, idempotent, revision-aware and durable before acknowledgement. No schema or endpoint is added in L0.A.
