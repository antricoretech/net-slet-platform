# L0.B.1 evidence governance design

The executable governance contracts are in `packages/exam-rules/src/learning-governance.ts`.

## Eligibility

`evaluateEvidenceEligibility` separates four purposes: mistake aggregation, review recommendations, future retrieval scheduling and future mastery verification. It requires a server-authorized outcome, immutable question-version identity, approved answer-key lineage, published content, valid syllabus/topic and unit mappings, distinct source event and practice-session context, trusted chronology and learner ownership. Missing or revoked explanation approval blocks recommendation, scheduling and mastery decisions while still allowing a valid basic mistake aggregate.

Repeated exposure to one question is not independent mastery evidence. `evaluateMasteryEvidence` requires configurable distinct-question, correct-response and distinct-session thresholds.

## Content gate

`validateContentReadiness` requires published question versions, approved answer keys, reviewed explanations, approved translations, licensed/permitted source material, syllabus/topic linkage and reviewed concept mapping. `assessFreshInventory` excludes exposed questions and requires approved parallel relationships. Synthetic fixtures are test-only; no real inventory counts are claimed.

## Architectural boundaries

These are pure contracts only. They do not authorize an API, read Prisma, mutate migration history, schedule retrieval, or publish content. Production callers must re-check ownership and approval state inside their transaction.
