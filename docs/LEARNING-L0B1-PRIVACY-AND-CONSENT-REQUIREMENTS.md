# L0.B.1 privacy and consent requirements

The contract layer distinguishes necessary practice history from optional profiling:

- progress tracking may be configured as necessary or optional;
- confidence and self-reported causes are optional learner data;
- personalized remediation is opt-in configurable;
- analytics are minimized and aggregated by default;
- research exports require a researcher/administrator role and minimized records.

Owner export, correction, deletion and consent-withdrawal requests require an authenticated verified learner context, are audit-required, and deletion/withdrawal invalidates derived clusters and remediation data. Cross-user operations are denied. Retention duration is a configuration placeholder requiring product, privacy and legal approval; this increment does not claim DPDP or any other legal compliance and does not invent a retention period.

Required future decisions include consent wording, lawful basis, age/guardian handling if applicable, retention schedule, legal holds, export format, deletion scope, backups, derived-data invalidation, audit retention, correction lineage and whether confidence/self-report may be used for research. These decisions must be approved before production learning APIs.
