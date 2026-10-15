# L0.E.0 test and quality report

## Independently executed

- `pnpm test`: passed — 59 exam-rules tests and 59 API tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; learning routes included `/dashboard/preview` and `/revision/mistakes/preview`.
- `pnpm exec playwright test tests/e2e/sprint3b-preview.spec.ts`: passed 5/5, including dashboard denial.

New L0.E.0 coverage includes practice-to-evidence-to-governance-to-Mistake-Mine-to-PrepPilot integration, duplicate events, cross-learner isolation, content gates, consent fallback, stale planning, deterministic repeated computation and 250 synthetic evidence records.

Existing Jest emits `ts-jest` warnings about compiled package JavaScript; these are warnings, not failures. No database-dependent test was run.
