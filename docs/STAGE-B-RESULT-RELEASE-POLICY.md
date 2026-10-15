# Stage B Result-Release Policy

The current candidate-facing policy is **aggregate-score disclosure while the result is `PENDING`**.

After an attempt reaches `SUBMITTED` or `EXPIRED`, scoring creates one immutable score run and an `AttemptResult` with status `PENDING`. The candidate may see the deterministic aggregate summary: total marks, maximum marks, correct, incorrect, unattempted, attempted, dropped and score-run reference. This preserves the existing CBT completion experience.

While the result is `PENDING`, the API and UI must not disclose answer keys, selected option IDs, per-question correctness, private explanations or unpublished content. The response explicitly returns `explanations: "UNAVAILABLE_UNTIL_RELEASE"`.

An authorized release operation may transition the result to `PUBLISHED`. Only then may the result workspace expose released explanations, subject to the existing candidate-ownership checks. A pending result is never treated as an official qualification result or prediction.

Regression coverage verifies both sides of this policy: aggregate fields remain available in `PENDING`, while answer keys, selected answers and explanations remain withheld.
