# ADR-0009: Controlled proposal for repairing migration replay

## Status

Proposal only. No migration files or migration history were changed in Sprint 2D.

## Observed blocker

Replay of the current migration directory against an empty disposable PostgreSQL database fails in `20261011222455_syllabus_taxonomy_foundation`: that migration alters `EmailVerificationToken` and `PasswordResetToken` before `20261012000800_auth_lifecycle_tokens` creates them. The current development database remains healthy and at the expected migration level.

Sprint 2E evidence: a disposable replay reached the first three migrations and failed with PostgreSQL `42P01: relation "EmailVerificationToken" does not exist`. The active database contains 15 successful migration records and remains unchanged. Its catalog currently reports 38 tables, 99 indexes, 96 constraints, 6 functions and 18 non-internal triggers, including the exam-pattern, pattern-child, question-revision and question-child immutability protections.

## Preferred recovery shape

Prepare a separately reviewed release-branch baseline migration from the healthy schema, then verify it twice: against an empty disposable database and against a copy of the current database. The baseline package must include:

- all tables, enums, foreign keys, unique/check constraints and indexes;
- every custom function and trigger, including immutability protections;
- validated data-only export and any required data transformations;
- a documented mapping from the 15 existing migration names to the baseline history;
- a rehearsal of `migrate deploy`, application startup, Prisma generation, API tests and rollback/restore procedure.

The existing migration history must be retained as an archived artifact and the new baseline introduced only through an explicitly approved release procedure. `migrate resolve` is appropriate only after the baseline schema has been independently verified; it is not a substitute for creating missing tables or objects.

## Alternatives rejected for now

- Reordering or editing already-applied migrations: rewrites migration history and can diverge existing installations.
- `prisma db push`: bypasses the reviewed migration contract and does not repair deterministic replay.
- `migrate resolve` alone: records history without proving schema equivalence.
- Resetting the development or shared database: destructive and unnecessary for Sprint 2D.

## Verification checklist

Before recommendation for adoption, compare schema-only dumps and catalog queries for tables, columns, indexes, constraints, functions, triggers, and enum values; compare row counts and checksums for authoritative tables; execute all data transforms on a disposable copy; replay from empty; deploy against a preserved copy; and run the full repository gates. Until that evidence exists, the migration replay blocker remains open and Sprint 2E readiness is conditional.
