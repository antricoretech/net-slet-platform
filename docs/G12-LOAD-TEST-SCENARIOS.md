# G12 Performance Readiness Scenarios

These are test definitions, not capacity claims. Execute only against disposable or explicitly isolated services with synthetic data.

| Scenario | Measures | Integrity assertions |
|---|---|---|
| Concurrent sign-in | latency, error rate, session issuance | no cross-account session or token leakage |
| Exam discovery | catalogue latency and cache behavior | only published, scoped metadata is returned |
| Attempt creation | transaction latency and throughput | one attempt per idempotency key; ownership enforced |
| Answer persistence | acknowledgement latency and conflict rate | every success is durable; stale revisions rejected |
| Refresh/reconnect | resume latency and deadline accuracy | reconnect never extends the server deadline |
| Timer expiry | expiry-finalization latency | late answers rejected; terminal score is deterministic |
| Final submission | submission latency and duplicate rate | concurrent submissions converge idempotently |
| Result retrieval | pending/published latency | candidate-safe disclosure policy is preserved |

Record workload shape, concurrency, duration, data volume, p50/p95/p99, error classes, database saturation, Redis behavior and server resources. Any 25,000-session target requires a separate measured report and approval.
