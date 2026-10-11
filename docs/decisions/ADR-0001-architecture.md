# ADR-0001 — Development architecture and authoritative boundaries

**Date:** 2026-10-11  
**Status:** Proposed engineering implementation of project technical baseline; product approval remains distinct.

## Decision
One pnpm workspace, Next.js app, NestJS modular API, shared pure exam-rules package, PostgreSQL/Prisma, Redis/BullMQ, Docker Compose locally, GitHub Actions pipeline, browser-first responsive delivery.

## Rationale
One end-to-end TypeScript stack reduces coordination costs for the early team. A modular monolith avoids premature service boundaries. PostgreSQL is authoritative for state and history; Redis may accelerate reads and background queues but must not be relied upon as the only durable source for exams. Scoring must be independently testable and driven by immutable approved versioned blueprints. Target 25,000 concurrent sessions remains a *load-tested future objective*, not a Sprint 0 performance claim.

## Exam identity and rules
Examination identity != exam-format template. Version all exam/cycle/subject/section rules and official evidence. Support three categories: UGC NET, Joint CSIR-UGC NET, State/Regional SET/SLET. v2.1 supersedes the original claim that all SETs share a continuous 150/180 UGC NET examination pattern. No provisional information will be served as officially verified.

## Scope of Sprint 0
Workspace, executable web/API skeleton, readiness endpoints, DB schema starter (not full exam attempt schema), Redis connection check, automated guardrail tests, CI scaffold, Codex contract and requirements documentation.

## Not implemented
Student authentication, question content, attempts, save/resume, scoring, payment, notifications, AI tutor, load capacity guarantee, verified live exam catalog, S3 storage, production security controls and full PWA behavior. All require later stories, threat modelling and acceptance tests.

## Follow-ups
- ADR-0002 authentication/session boundaries.
- ADR-0003 published pattern/version schema and approval state machine.
- ADR-0004 answer mutation contract (transaction, idempotency, optimistic concurrency).
- ADR-0005 scoring key revisions and replayability.
- Official-cycle pattern evidence review and signoff.
