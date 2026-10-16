# Sprint 9.2 Import and Acceptance Contract

## Source integrity

Historical PYQ imports use two different digests:

- `sourceChecksum` is the SHA-256 of the canonical source payload. For JSON and CSV, the parsed records are serialized with stable sorted object keys; the per-row `sourceChecksum` field is excluded so the integrity value is not self-referential. CSV parsing occurs from UTF-8 text and preserves quoted commas, escaped quotations and embedded newlines before canonicalization.
- `manifestHash` is the SHA-256 of the normalized import manifest, including source name, format, source checksum and canonical records. It identifies the import operation and is not evidence of the source document digest.

The API rejects a checksum that does not match the canonical source payload, duplicate or empty CSV headers, malformed quoting, inconsistent row widths, missing structural headers and CSV content over 2 MiB. Domain validation separately rejects missing required metadata, invalid rights evidence and unauthorized question/language relationships.

Concurrent dry-run requests for the same manifest are resolved through the unique manifest constraint. A losing request rereads the committed manifest and returns an idempotent result; it does not create a second audit trail or partial manifest.

## Acceptance scope

Sprint 9.2 adds focused ingestion parser, checksum and duplicate-manifest regression coverage. The existing keyset pagination contract remains bounded to 100 records per database batch and has no permanent total-record cap. Dedicated authenticated HTTP and browser acceptance suites remain separate release gates until implemented against disposable PostgreSQL fixtures.
