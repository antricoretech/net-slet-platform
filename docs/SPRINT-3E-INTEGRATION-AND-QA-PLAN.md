# Sprint 3E.0 Integration and QA Plan

## Audit findings

Sprint 3A–3D provide compatible immutable form, attempt, scoring, result and analytics primitives. The main integration gap was that the CBT preview kept answer state in React and did not invoke the attempt aggregate. Sprint 3E adds an isolated `InMemoryCbtAttemptAdapter`; no production adapter or API route is registered. Existing candidate contracts contain no answer keys or reviewer metadata.

## Intended changes

- Start the synthetic preview through the form and attempt contracts.
- Route answer save and submission through the existing attempt engine.
- Preserve explicit non-durability messaging and server-side preview restrictions.
- Add cross-module tests, failure simulations, security checks, pattern-family traceability and deterministic benchmarks.

## Boundaries

No PostgreSQL, Redis, Prisma migration, production endpoint, official rule certification or 25,000-user capacity claim is in scope. Browser refresh is expected to lose in-memory state; this is not recovery evidence.
