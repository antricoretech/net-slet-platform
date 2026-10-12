# Content Track C0.A — Evidence and source contracts

`packages/exam-rules/src/examdna.ts` provides `ExaminationCycleIdentity`, `ExaminationSourceEvidence` and `verifySourceEvidence`.

Evidence is eligible only when its examination, cycle and subject match exactly; the source URL is HTTPS; the document hash is SHA-256; title, issuing authority, excerpt and artifact reference exist; timestamps are valid; the state is `VERIFIED`; and an authorized reviewer and review time are recorded. A new corrigendum uses a new source/pattern lineage and does not rewrite historical attempts.

`validateOfficialPatternIntegrity` additionally requires an approved/published blueprint, matching rule hash, regression report, exact verified source and non-negative question-bank coverage. This is validation metadata, not an authentication or official-authority claim.
