# L0.D.0 study-planning contracts

Executable contracts are in `packages/exam-rules/src/prep-pilot.ts`.

`validateLearnerProfile` validates target identity, language, daily availability, study days, variable minutes, breaks and provisional inputs. `generateNextBestActions` creates reasoned, evidence-referenced actions only when content and authorization gates pass. `buildStudyPlan` allocates tasks across configured study days, rest days and daily budgets without exceeding the budget; it reports omitted work and remains provisional when dates, consent or other inputs are incomplete.

`summarizeCoverage` is target-specific and only counts verified syllabus entries. `toPrepDashboardProjection` exposes safe counts and limitations while explicitly disabling durable persistence and spaced review. `canRevisePlan` rejects stale revision updates for the future persistence layer.

The planner intentionally has no due dates, streak logic, mastery percentage, qualification prediction, ranking, answer key, private content metadata or production API.
