# Stage B Result-Release Policy

The current candidate-facing policy is **aggregate-score disclosure while the result is `PENDING`**.

After an attempt reaches `SUBMITTED` or `EXPIRED`, scoring creates one immutable score run and an `AttemptResult` with status `PENDING`. The candidate may see the deterministic aggregate summary: total marks, maximum marks, correct, incorrect, unattempted, attempted, dropped and score-run reference. This preserves the existing CBT completion experience.

While the result is `PENDING`, the API and UI must not disclose answer keys, selected option IDs, per-question correctness, private explanations or unpublished content. The response explicitly returns `explanations: "UNAVAILABLE_UNTIL_RELEASE"`.

An authorized release operation may transition the result to `PUBLISHED`. Only then may the result workspace expose released explanations, subject to the existing candidate-ownership checks. A pending result is never treated as an official qualification result or prediction.

Regression coverage verifies both sides of this policy: aggregate fields remain available in `PENDING`, while answer keys, selected answers and explanations remain withheld.

## Candidate learning projections

The release state applies consistently across `/attempts/:id/result`, `/attempts/:id/learning-summary` and `/attempts/learning-history`.

- A `PENDING` learning summary returns only `attemptId`, `releaseStatus`, `available: false` and the stable withholding reason. It does not return topic aggregates, evidence identifiers, question identifiers, outcomes, mistake reasons or recommendations.
- Learning history is built only from attempts whose result is `PUBLISHED`. Account-wide persisted aggregates remain internal because they may include unreleased attempts.
- A `PUBLISHED` result may expose its released learning summary and question-identifiable mistake evidence to the owning student. Publication does not weaken ownership checks.

Scoring continues to create internal learning evidence transactionally while the result is pending. Withholding changes the candidate projection only; it never deletes or rewrites historical evidence.
