# Content Track C0.A — Inventory and publication readiness

`validatePublishedQuestionReadiness` requires a published question version, approved answer key, reviewed explanation, approved translation, approved syllabus mapping, acceptable rights status, verified provenance and complete identity/language scope.

`evaluateStrictMockPublication` combines that question readiness with official pattern integrity, exact language selection, duplicate-version detection, section inventory counts and grouped-question sequence checks. It returns `READY`, `INSUFFICIENT` or `BLOCKED`; unavailable or unapproved questions are never executable mock inventory.

The current implementation uses isolated fixtures only. No active database inventory was queried, and no approved question counts are claimed.
