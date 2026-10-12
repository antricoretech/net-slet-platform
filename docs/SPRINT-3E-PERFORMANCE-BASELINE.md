# Sprint 3E.0 Performance Baseline

Run after building the shared package:

```text
pnpm --filter @net-slet/exam-rules build
node scripts/benchmark-sprint3e.mjs
```

The benchmark uses Node `process.version`, a deterministic 500-question synthetic form, 500 answer events, a 500-question palette and 500 analytics records. It measures pure in-process operations only: form generation, attempt create/initialize/activate, palette calculation, scoring and analytics.

The benchmark is not a concurrency, memory-capacity or production SLA test. It does not exercise PostgreSQL, Redis, network latency, browser rendering, synchronized starts or 25,000 concurrent sessions. A future load plan must use isolated infrastructure and measure bursty autosave, session expiry and simultaneous submission behavior.

## Local baseline sample

Environment: Windows workspace, Node `v24.20.0`, one process, one run, built `@net-slet/exam-rules` package, 500 synthetic questions and 500 answer events.

| Operation | Elapsed time (ms) |
| --- | ---: |
| Test-form generation | 19.482 |
| Attempt create/initialize/activate | 1.689 |
| Palette calculation | 0.196 |
| Scoring | 6.638 |
| Analytics | 23.979 |

These values are a repeatable local sample, not an SLA or concurrency result. Memory growth was not instrumented in this first baseline.
