# Content Track C0.B — QBMS Quality Design

The C0.B quality boundary is a pure, deterministic TypeScript contract in `@net-slet/exam-rules`. It is deliberately independent of Prisma, PostgreSQL, Redis and production API controllers.

## Gate model

`validateQuestionQuality` composes the existing C0.A publication-readiness contract with question-type structure, immutable identity, versioned answer keys, reviewed difficulty, explanation trust, rights, translation, provenance and challenge/quarantine controls. It fails closed and never promotes a record merely because its shape is valid.

Supported structural checks include single and multiple choice, assertion/reason, matching, ordering, reading-comprehension/data-interpretation groups, mathematical/LaTeX items and rectangular tables. Group completeness remains an inventory/form concern as well as an item concern.

Every failure is a structured issue with code, severity, field path and remediation. Answer-trust requires reviewed correct and distractor rationales, concept references, reviewer metadata, answer-key alignment and attributable evidence. AI-generated evidence is not accepted as verified evidence.

## Safety properties

- No answer keys are returned by student contracts.
- Rights and governance failures block publication and strict mock use.
- Duplicate detection reports identity/source/fingerprint/group reuse only; a fingerprint is not a plagiarism finding.
- Synthetic audit fixtures are explicitly labelled and the audit has no side effects.
