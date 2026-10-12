# Content Track C0.B — Content Inventory Contracts

`evaluateContentInventory` scopes records by exact examination, cycle, subject, section, language and type. It reports totals, structural validity, reviewed records, publication eligibility, rights-cleared records, language variants, fresh records, complete groups, strict-mock eligibility, practice-only records, exclusions and quarantined records.

Coverage requirements carry a denominator state and optional source reference. A gap is reported as required, available and missing; the implementation does not claim real inventory counts without records.

`detectContentDuplicates` identifies exact question-version, source-event, canonical-fingerprint and group reuse. It intentionally avoids a plagiarism conclusion and preserves immutable question lineage for later governance decisions.
