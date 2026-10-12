# L0.C spaced-revision entry criteria

## Gate outcomes

- **READY**: every criterion below is true and evidence is reviewable.
- **CONDITIONAL**: at most two criteria remain unresolved, with explicit owner, mitigation and no production enablement.
- **BLOCKED**: three or more criteria are unresolved, or any critical privacy, authorization, provenance or persistence control is absent.

## Required criteria

1. Durable, trusted learner history exists and is transactionally acknowledged.
2. Privacy, consent, retention, export, correction and deletion rules are approved.
3. Learner ownership, administrator/SME boundaries and minimized research access are implemented and tested.
4. Approved content inventory is sufficient for the intended revision scope.
5. Fresh parallel-item eligibility excludes previously exposed items.
6. Retrieval events carry source, question-version, scoring and answer-key provenance.
7. Scheduling configuration and time semantics are approved.
8. Mastery thresholds require independent questions and sessions; one correct answer is insufficient.
9. Answer-key corrections and learner corrections rebuild derived data without overwriting immutable evidence.
10. Accessible controls, opt-out and learner review are implemented.

The current repository is **BLOCKED** for L0.C because durable history, approved privacy/retention decisions, production content inventory and retrieval provenance are not yet implemented or approved. L0.B.1 supplies design contracts only.
