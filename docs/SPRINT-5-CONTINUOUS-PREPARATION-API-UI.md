# Sprint 5 — Continuous Preparation API and Student UI

This increment turns the cycle-independent preparation contracts into an authenticated read-side experience. It does not certify academic content or create a second CBT engine.

## API

`/api/v1/preparation` is restricted to authenticated student accounts and composes existing persisted records:

- `GET /examinations` — available examination families;
- `GET /:examinationCode` — cycle-independent preparation overview;
- `GET /:examinationCode/paper-i/syllabus` — published Paper I syllabus or an evidence-pending state;
- `GET /:examinationCode/paper-ii/subjects` — approved/published subject catalogue;
- `GET /:examinationCode/paper-ii/:subjectCode` — subject-specific syllabus, pattern and availability state;
- `GET /:examinationCode/pyqs` — rights-cleared published PYQ metadata with optional year/cycle/session/subject filters;
- `GET /:examinationCode/mocks` — published forms whose pattern is published, without answer keys or private snapshots;
- `GET /learning/summary` — account-scoped persisted topic performance.

All readiness decisions are server-side. Research-only, ambiguous, expired or unverified patterns do not become approved discovery results. Empty states identify missing syllabus evidence, qualified inventory, rights clearance or publication readiness.

## Student pages

- `/preparation` — UGC NET year-round dashboard;
- `/preparation/paper-i` — Paper I syllabus path without cycle or subject selection;
- `/preparation/paper-ii` — dynamic subject selection;
- `/preparation/paper-ii/:subjectCode` — subject-specific readiness and safe mock/PYQ links.

Existing attempt, CBT player, result-release and learning services remain the source of truth. This sprint does not alter Prisma schema, migration history or active databases.
