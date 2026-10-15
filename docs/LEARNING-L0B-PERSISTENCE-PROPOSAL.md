# L0.B persistence proposal — not implemented

When persistence is authorized, model the following entities without rewriting migration history: `MistakeEvidence`, `MistakeEvidenceSource`, `SelfReportedErrorCause`, `MistakeCluster`, `RemediationTask`, `RemediationEvidence` and `MistakeReviewEvent`.

Recommended controls:

- unique `(learnerRef, sourceEventId)` and immutable source lineage;
- transactionally record authorized outcome and evidence before acknowledging a practice finalization;
- retain question-version, scoring-policy and answer-key revision identifiers;
- treat correction lineage as a new reviewed event that supersedes, never overwrites, the original evidence;
- enforce learner ownership on reads, self-report changes and deletion requests;
- store no answer keys in student projections or logs;
- define retention, consent, export and deletion semantics before production rollout;
- recompute aggregates from evidence rather than treating cached clusters as authoritative.

No Prisma schema or migration is part of L0.B. A future persistence increment must compare these entities with the existing schema and obtain separate approval before migration work.

## L0.B.1 refinements

Persist immutable source evidence separately from derived clusters and remediation tasks. Enforce ownership foreign keys and a unique `(learnerRef, sourceEventId)` source key. A key correction creates a new lineage event with `supersedesEvidenceId`; it never rewrites the original observation. Aggregate rebuilds are deterministic from surviving evidence. Learner deletion removes or cryptographically invalidates learner-linked source evidence and all derived records in one approved workflow, while retained audit records contain only the minimum non-content metadata required by policy. Concurrent self-report edits use revision checks; duplicate ingestion is idempotent; correction and deletion operations are audited. Future retrieval events must reference evidence, question version, scoring policy and answer-key revision inside the same durable transaction that acknowledges the operation.
