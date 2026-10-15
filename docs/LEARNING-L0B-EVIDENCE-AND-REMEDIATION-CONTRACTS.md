# L0.B evidence and remediation contracts

The executable contracts live in `packages/exam-rules/src/mistake-mine.ts`.

## Evidence contract

`AuthorizedPracticeOutcome` is an internal/server-authorized input. It includes opaque learner identity, source session/event, question and version identity, scoring policy lineage, exam-cycle-subject mappings, submitted options, authorized outcome, confidence, optional self-report, trusted occurrence time, provenance and explanation-release state. It intentionally has no client-supplied answer key.

`MistakeEvidenceRecord` adds a stable evidence ID and lineage. `deduplicateMistakeEvidence` provides stable source-event idempotency and rejects conflicting duplicates.

## Analysis contract

Aggregates expose incorrect event count, unique question count, distinct sessions, high-confidence wrong, low-confidence correct, unattempted coverage, causes, evidence IDs and limitations. Clusters are deterministic by topic, concept, self-report cause or high-confidence incorrect outcome. Every cluster carries an explanation, limitations and remediation actions.

Suggestions are rationale-bearing. Concept review and strategy review can be represented without content; fresh-question practice is unavailable until approved parallel content is supplied. No mastery, misconception or score prediction is returned.

## Student projection

`toStudentMistakeProjection` exposes only the selected response, authorized outcome and permitted metadata. Correct options and explanations require both authorized release and explicit reviewed content. This release gate is separate from the synthetic preview route gate.
