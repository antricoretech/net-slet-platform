# Sprint 3D.0 Results and Analytics Design

## Results and explanations

`results.ts` separates internal scoring-run inputs from `StudentResultProjection`. Candidate projections include attempt/form/pattern/run references, paper marks, counts, maximum marks and release/completion status; they do not include answer keys, reviewer metadata or private explanations. Explanation release is explicit and unauthorized callers receive a safe unavailable projection. Challenge action contracts remain candidate-safe and can later connect to the existing QBMS challenge workflow.

## Analytics

`analytics.ts` calculates overall, paper, section and topic distributions, accuracy and available time totals. Missing topic IDs or incomplete timing return explicit unavailable metrics. Revision priorities require configured evidence thresholds and use cautious labels such as low accuracy or repeated error; the code does not infer a misconception from one wrong answer.

## Strategy and rescoring

`strategy.ts` creates hypothetical CSIR/negative-marking comparisons without mutating an official score. `rescore.ts` requires a reason and approval reference, creates a distinct revised scoring-run reference and returns an explicit score delta/notification status. Original runs are never overwritten by the domain contract.

## Preview and production gate

`/results/preview` is server-gated in the same way as the CBT preview and contains synthetic illustrative data only. It displays no ranks, percentiles, qualification predictions or official affiliation. Production results require durable attempts, immutable forms, authorized score publication, rescoring audit lineage and authenticated API integration.
