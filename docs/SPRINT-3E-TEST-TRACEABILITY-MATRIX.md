# Sprint 3E.0 Test Traceability Matrix

| Area | Evidence | Status |
| --- | --- | --- |
| Form/version and question compatibility | `cbt.test.ts`, `form.ts` | Tested |
| Attempt ownership, revisions, idempotency, deadlines and finality | `attempt-engine.test.ts` | Tested |
| Exact-match, alternatives, dropped items, ceilings and unresolved CSIR policy | `scoring-3d.test.ts` | Tested |
| Candidate result and explanation release | `scoring-3d.test.ts` | Tested |
| Analytics availability and priorities | `scoring-3d.test.ts` | Tested |
| Preview route server restriction | `tests/e2e/sprint3b-preview.spec.ts` | Tested, 2/2 |
| Integrated adapter | `cbt-preview-adapter.ts` and build/typecheck | Tested by type/build; browser journey remains preview-only |
| Browser refresh recovery | Intentional in-memory loss | Simulated limitation |
| PostgreSQL durability and concurrent transactions | No active DB access permitted | Blocked |
| Official exam-family scoring | Research fixtures only where unverified | Blocked pending evidence |

## Pattern-family traceability

| Family | Timer/navigation assessment | Scoring/source status |
| --- | --- | --- |
| P1 continuous dual-paper CBT | Configurable sections/sessions support the topology; no universal count or duration is hardcoded | UGC fixture is research-only until official cycle evidence is approved |
| P2 CSIR multipart CBT | Section ceilings, chronology and session locking are represented | Five subject fixtures are `RESEARCH_ONLY`; unresolved excess-attempt behavior rejects strict scoring |
| P3 single-sitting/staged OMR simulation | Blueprint delivery mode supports the family; OMR bubble UI is not implemented here | Requires verified cycle-specific rules |
| P4 independent paper-session OMR | Independent session timing and finality are represented | Requires verified cycle-specific rules |
| P5 Kerala-specific configurations | No Kerala count/timer is hardcoded; future rules remain configurable | No official configuration certified |
| P6 exceptional/pending-verification patterns | Unverified policies are rejected for strict scoring and labeled research-only | Requires source evidence and approval |
