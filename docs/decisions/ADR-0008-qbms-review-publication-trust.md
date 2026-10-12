# ADR-0008 — QBMS review, publication, and content trust

**Date:** 2026-10-12
**Status:** Accepted for Sprint 2C, subject to migration replay remediation

## Decision

Question revisions use the existing lifecycle enum: `DRAFT` → `SUBMITTED_FOR_REVIEW` → `SME_REVIEWED` → `APPROVED` → `PUBLISHED`, with `REJECTED` and historical correction revisions. Review decisions, publication snapshots, challenges, translation reviewers, and rights status are stored separately and linked to the exact `QuestionVersion`.

Authors cannot review, approve, or publish their own revisions. SME review must be assigned; administrator approval and publication are separate actions. Publication requires a valid answer key, explanation, syllabus mapping, provenance, and non-restricted rights evidence. Licensed or permission-based content also requires licence evidence.

Public delivery uses a separate projection containing only published prompt/options and approved translations. It never returns answer keys, explanations, provenance, licensing, review notes, or moderation fields. Challenge submissions reference a published revision and cannot mutate content.

## Migration blocker

The existing migration chain is not replayable from empty PostgreSQL: migration `20261011222455_syllabus_taxonomy_foundation` alters `EmailVerificationToken` and `PasswordResetToken` before migration `20261012000800_auth_lifecycle_tokens` creates those tables. The current development database remains healthy and additive 2C migrations are applied, but clean replay is a release blocker until an approved remediation preserves already-applied history.
