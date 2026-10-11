# ADR-0002 — Authentication and identity boundaries

**Date:** 2026-10-12  
**Status:** Proposed Sprint 1 implementation baseline

## Decision

Use application-managed accounts with password hashes and opaque, database-backed sessions. The browser receives only a random session token in an HttpOnly, SameSite cookie; PostgreSQL stores a SHA-256 hash of that token, its expiry, revocation state and audit-relevant metadata.

Public registration always creates a `STUDENT`. `SME` and `ADMIN` assignment is an administrative workflow and is not exposed through request payloads or the frontend.

Passwords are hashed with Node.js `scrypt` using a per-password random salt. No password, raw session token or credential secret is persisted in logs or audit metadata.

## Session and request security

- Session cookies are HttpOnly, `SameSite=Lax`, path-scoped to `/`, and Secure in production.
- Sessions expire after seven days and can be revoked at logout or future account-security events.
- Expired and revoked sessions are rejected server-side; reconnecting does not extend a session automatically.
- Registration and login use bounded rate limiting. Local development falls back to process memory; production requires the configured Redis limiter and fails closed if it is unavailable.
- Authentication errors intentionally use generic messages to reduce account enumeration.
- API input is validated before database access. Public routes never accept a role or account identifier.
- CSRF protection is currently limited to SameSite cookies and same-origin browser use. A synchronizer token or equivalent protection is required before enabling cross-site state-changing clients.

## Email verification

Email verification and password-reset tokens are durable, single-use, hashed records. The repository includes a token-silent `console` development adapter and a production-capable HTTPS `webhook` adapter. The webhook requires `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, and `EMAIL_FROM`; credentials are environment-managed and never logged. The receiving provider must verify the sender domain and accept the JSON `{from,to,subject,text}` contract. In non-production local development, registration marks the account verified so the foundation can be exercised. Production registration fails closed unless the provider configuration is complete; the local verification shortcut cannot be used in production.

## Alternatives considered

- Hosted identity providers were not selected because Sprint 1 must run locally without a paid service dependency.
- JWT access tokens were not selected for the browser session because revocation and server-side expiry are simpler and more authoritative with opaque database sessions.
- A framework password library was not added for this increment; Node's built-in `crypto.scrypt` avoids another runtime dependency. Parameters must be reviewed before production hardening.

## Follow-ups

- Configure the external HTTPS provider, verified sender domain, secret, delivery policy and monitoring; actual delivery remains an external deployment verification step.
- Add CSRF tokens for any cross-origin state-changing client.
- Add MFA, account lockout/recovery policy and security event retention rules before production.
- Define the full authorization policy in the future exam-catalog and content ADRs.
- Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` from local and production shells; it is insecure and not required by this repository.
