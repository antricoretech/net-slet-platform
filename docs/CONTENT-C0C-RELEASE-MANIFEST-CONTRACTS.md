# Content Track C0.C — Release Manifest Contracts

`buildReleaseManifest` records the candidate mock, exact exam identity, pattern and syllabus references, scoring-policy reference/hash, selected question versions, answer-key lineage, groups, translations, explanations, rights references, approvals and regression evidence.

The canonical serialization recursively sorts object keys while preserving array order. The content fingerprint includes the canonical manifest data and generated form hash. It is an integrity fingerprint only; an unsigned hash is not authenticated authorship, approval or official certification.

`validateReleaseManifest` rejects unsupported schema versions, missing version references, empty selections, duplicate selected versions and missing answer-key references. Frozen manifests are never silently mutated; post-freeze changes require a successor version.
