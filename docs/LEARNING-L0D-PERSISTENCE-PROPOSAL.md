# L0.D.0 persistence proposal — not implemented

Future entities are `StudentTargetExam`, `StudentStudyAvailability`, `StudyPlan`, `StudyTask`, `StudyTaskEvidence`, `StudyPreference`, `StudyPlanRevision` and `StudyActivityCompletion`.

Ownership must link every learner record to the authenticated account and enforce target examination/cycle/subject ownership. A plan revision is immutable; a new revision references the prior revision and uses optimistic concurrency on the expected revision. Task creation, evidence references and the plan revision acknowledgement should be one transaction. Activity completion uses a unique idempotency key and source event.

Recommendations must retain contract/version, input evidence references, content/question versions, authorization decision and limitations. Corrections rebuild derived plans without rewriting evidence. Learner deletion or consent withdrawal invalidates plans, tasks and derived analytics according to the approved retention policy, with minimum auditable metadata only. No Prisma schema or migration is proposed in L0.D.0.
