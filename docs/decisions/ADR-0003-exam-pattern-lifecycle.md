# ADR-0003 — Examination catalogue and pattern lifecycle

**Date:** 2026-10-12  
**Status:** Proposed Sprint 1B implementation baseline

## Decision

Keep examination identity, organizer, jurisdiction and exam-cycle pattern versions as separate records:

- `Examination` identifies a product catalogue entry such as UGC NET, Joint CSIR-UGC NET or a named SET/SLET.
- `ExamOrganizer` identifies the authority or organizing body without asserting affiliation or endorsement.
- `Jurisdiction` is reusable and connected through `ExaminationJurisdiction`; one regional examination may cover multiple states or union territories.
- `ExamCycle` and `ExamPatternVersion` preserve cycle-specific rules and historical reproducibility.

Public catalogue reads expose only allowlisted identity, organizer, jurisdiction and pattern-status fields. They never expose `rules`, reviewer identity, approval metadata, answer keys or private audit records.

Public registration cannot write catalogue data. Catalogue creation and updates require an authenticated `ADMIN` account, input validation, and an audit event. No public endpoint assigns roles.

## Verification boundary

Catalogue identity is not proof of official examination affiliation. New records may be created by an authorized administrator, but pattern versions remain `RESEARCH_ONLY` by default. A pattern can only progress through a future approval workflow after exact examination/cycle/subject evidence, reviewer identity, checksum and regression evidence are captured.

The catalogue does not seed historical or current exam identities in this increment. This prevents unsupported research data from being presented as a live verified catalogue.

## Alternatives considered

- A single state string on `Examination` was rejected because regional exams can span multiple states/UTs and jurisdiction is independently reusable.
- Embedding organizer and jurisdiction JSON in `Examination` was rejected because search, uniqueness and referential integrity are required.
- Exposing the full `ExamPatternVersion` object was rejected because draft rules and reviewer metadata are private and potentially sensitive.

## Follow-ups

- Add a reviewer approval state machine and immutable publication snapshots in Increment 1C.
- Add admin endpoints for explicit cycle/subject pattern drafts with evidence and checksum validation.
- Add organizer/jurisdiction provenance records when official evidence is supplied.
