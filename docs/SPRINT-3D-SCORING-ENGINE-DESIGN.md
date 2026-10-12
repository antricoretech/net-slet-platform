# Sprint 3D.0 Scoring Engine Design

## Boundary

The scoring engine is pure and database-independent. `scoring-policy.ts` accepts an immutable policy, question-version rules and ordered answer-selection events. It returns a deterministic score-run hash, integer-scaled totals and paper/section breakdowns. It does not read Prisma, publish results or expose an endpoint.

## Arithmetic and policy validation

Marks are integer scaled units. A policy must declare its ID, version, provenance, scale, positive/negative/unattempted treatment and excess-attempt policy. `UNRESOLVED` provenance or excess-attempt behavior is rejected for strict scoring. UGC NET zero-negative behavior is represented as a named research fixture, not a global default. Five CSIR subject fixtures are present as `RESEARCH_ONLY` and reject unresolved excess-attempt scoring.

Selection events are sorted by sequence and latest response per question is used. Attempt ceilings are applied by configured paper/section key. Dropped questions are excluded from maximum marks. Exact-match questions compare normalized option sets and can declare approved alternatives.

## Integrity limitations

The current fixtures are not official certification. Official cycle/subject rules require verified evidence, approved blueprint metadata and regression evidence before release. The engine intentionally rejects unresolved CSIR excess-attempt policy rather than inventing first-N, last-N or highest-score behavior.
