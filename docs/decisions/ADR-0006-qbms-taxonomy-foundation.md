# ADR-0006 — QBMS syllabus taxonomy foundation

**Date:** 2026-10-12
**Status:** Accepted for Sprint 2A

## Decision

The QBMS taxonomy starts with `SyllabusVersion`, `SubjectUnit`, and hierarchical `SyllabusTopic` records. A syllabus version belongs to one existing `ExamCycle` and one `ExamSubject.code`, and is uniquely versioned within that scope. Topics support one level or many levels of nesting through a self-reference; the product may present a child as a subtopic without introducing a separate unversioned taxonomy.

Authoring is initially limited to authenticated SME and administrator accounts. New records begin in `DRAFT`; review and publication transitions are reserved for Sprint 2C. Public reads will only expose `PUBLISHED` versions once that transition exists. Synthetic fixtures remain research-only and are never presented as official syllabus evidence.

The existing `AuditEvent` model remains the audit ledger. QBMS events are represented by dedicated event types with scoped metadata; a second `AuditLog` table would duplicate the authoritative audit boundary.

## Consequences

- Question records in later increments must reference a concrete syllabus version/unit/topic, never a global subject-only taxonomy.
- Published taxonomy rows must be treated as immutable; corrections create a new syllabus version.
- Provenance, licensing, translations, and challenge records attach to content versions in later increments rather than weakening taxonomy identity.
- The API must verify examination, cycle, and subject ownership before creating or reading a syllabus tree.

## Open follow-ups

- Define the complete review evidence contract for syllabus approval in Sprint 2C.
- Decide whether future syllabus imports need a separate source artifact table or can use the planned `ContentProvenance` model.
