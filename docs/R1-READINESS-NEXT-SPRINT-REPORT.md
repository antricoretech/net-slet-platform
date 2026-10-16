# Release 1 readiness — next-sprint recommendation

## Decision

G13 is technically ready for review, not production release. PR #6 remains subject to required code-owner/security review and merge protection. No official examination approval, content-rights approval, active-database reconciliation approval or deployment authorization is claimed.

## Gap register

| Workstream | Current evidence | Remaining implementation / approval | Dependencies | Acceptance evidence | Owner type | Priority |
|---|---|---|---|---|---|---|
| G04 official cycle verification | ExamDNA contracts and pattern lifecycle | Obtain authoritative cycle/subject bulletins and independent rule-owner approval | Official source access | Source hash, scoped pattern, regression matrix, approval audit | Examination/rules owner | P0 |
| G05 rights-cleared inventory | QBMS provenance/licence models and readiness contracts | Populate real inventory and validate rights per item | Rights-holder records | Inventory coverage and rights audit | Content/licensing owner | P0 |
| G06 qualified publication evidence | C0.C qualification contracts | Complete real SME, rights, explanation and regression approvals | G04/G05 | Qualification manifest and publication audit | Content owner + SME | P0 |
| G08 active database reconciliation | Stage A/R3 recovery evidence and protected runbooks | Separate owner authorization and controlled reconciliation rehearsal | Backup, rollback and maintenance window | Reconciliation report and post-change comparison | Database owner | P0 |
| G09 auth/email/security | Auth lifecycle, role guards, TLS CI checks | Hosted secret/email provider and security review | Staging environment | Authenticated matrix, abuse/rate-limit and secret scans | Security/platform owner | P1 |
| G10 privacy/accessibility | Candidate-safe projections and accessible UI foundations | Formal privacy review and WCAG-oriented audit | Real workflows and staging | Access-control, disclosure and accessibility reports | Privacy/accessibility owner | P1 |
| G11 hosted staging | CI builds isolated non-root artifacts | Provision approved staging without production claims | Platform budget and secrets | Staging smoke/E2E and rollback evidence | DevOps owner | P1 |
| G12 performance/load | No capacity claim; deterministic tests exist | Isolated representative load test | Staging and test data | p95/p99 workload report and limits | QA/performance owner | P1 |
| G15 monitoring | Audit events and health checks | Define operational dashboards, alerts and retention | Hosted staging | Alert drills and incident runbook | Operations owner | P1 |
| G31 backup/DR | Verified isolated restoration evidence | Schedule approved backup and restore rehearsal | G08 authorization | Backup checksum, restore test, RTO/RPO evidence | Database/operations owner | P0 |

## Recommended next sprint

1. Secure code-owner/security review and merge PR #6 without bypassing branch protection.
2. Run G04/G05 evidence acquisition in parallel with the database-owner G08 reconciliation approval package.
3. Build a staging-only release rehearsal covering G09, G10, G11, G15 and G31; keep active migration reconciliation separate.
4. Execute G12 only after representative, rights-safe staging fixtures and monitoring are available.

## External approvals required

Product owner, examination/rules owner, content/SME owner, rights/licensing owner, security owner, privacy/accessibility reviewer, database owner, DevOps/release owner and operations owner. The repository contains no fabricated approval records.
