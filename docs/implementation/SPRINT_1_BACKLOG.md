# Sprint 1 candidate backlog (proposal; do not auto-implement)

1. **Identity/auth boundaries:** HARDENED - local student registration/login/logout/session-me, database-backed sessions, role field, credentialed browser CORS, request-origin protection, Redis-backed production rate limiting, durable verification/reset tokens, configurable HTTPS webhook delivery and audit events are implemented. External provider verification, MFA and final threat-model signoff remain required.
2. **Examination catalogue:** HARDENED - normalized examination, organizer, reusable jurisdiction, cycle and subject mappings, public search/detail/cycle reads, admin-gated writes, subject management and audit events are implemented. No real identities are seeded or certified.
3. **Pattern lifecycle:** HARDENED - cycle/subject/session/section/scoring/language configuration, subject overrides, evidence-backed review states, deterministic checksum, database immutability triggers, immutable publication snapshots, supersession audit and unit/database/browser regression tests are implemented. External evidence verification and certified pattern seeding remain out of scope.
4. **Question bank:** schema for versioned reviewed items, choices, solutions, languages, licensing/provenance, corrections.
5. **Attempt lifecycle:** start with approved snapshot, reliable PostgreSQL answers, idempotency and optimistic version checks, server-deadline expiry/recovery, authorized access.
6. **UGC NET score engine:** apply a confirmed policy from an explicitly approved pattern fixture; robust tests and replayable score snapshots. Do not claim certification before external review.

Each story must have security, accessible interaction and failure-mode tests. Recommended dependency order: roles -> catalog/pattern approvals -> content reviews -> attempt lifecycle -> real scoring and UX.
