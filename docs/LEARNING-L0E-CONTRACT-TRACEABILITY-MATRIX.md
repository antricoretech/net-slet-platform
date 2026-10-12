# L0.E.0 contract traceability matrix

| Invariant | Contract/test evidence | Status |
|---|---|---|
| Practice response retains question version | `practice.ts`; `learning-integration.test.ts` | Verified |
| Correctness is server-authorized | `mistake-mine.ts`, governance tests | Verified |
| Source events deduplicate | `deduplicateMistakeEvidence`; integration tests | Verified in memory |
| Answer-key lineage is retained | `MistakeEvidenceRecord.lineage`; L0.B tests | Verified in memory |
| Learner isolation | authorization contracts and integration tests | Verified in memory |
| No optional profiling after withdrawal | PrepPilot fallback test | Verified in memory |
| No unapproved/unavailable recommendation | content gates and PrepPilot tests | Verified in memory |
| No unsupported syllabus equivalence | target-specific coverage contracts | Verified by design |
| No mastery from sparse evidence | governance mastery thresholds | Verified by design/tests |
| Daily plan never exceeds budget | planner tests | Verified in memory |
| No durable-saving claim | dashboard projection and preview text | Verified by inspection |
| No active spaced-revision scheduler | projection explicitly unavailable | Verified by inspection |
| Production preview denial | Playwright suite | Verified |

Database atomicity, durable concurrency and recovery remain deferred.
