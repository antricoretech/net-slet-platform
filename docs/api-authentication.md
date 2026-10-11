# Authentication API - Sprint 1A

Base URL: `/api/v1/auth`

State-changing browser requests use the HttpOnly `netslet_session` cookie. Public registration always creates a `STUDENT`; the API never accepts a client-supplied role.

## Endpoints

- `POST /register` - `{ "email": string, "password": string }`; creates a student account and starts a local session. Production creates a pending account and sends a verification token.
- `POST /verify-email` - `{ "token": string }`; consumes a durable, hashed, expiring verification token once.
- `POST /password-reset/request` - `{ "email": string }`; returns a generic success response and sends a reset token when the account exists.
- `POST /password-reset/complete` - `{ "token": string, "password": string }`; consumes a reset token once, changes the password and revokes existing sessions.
- `POST /login` - `{ "email": string, "password": string }`; starts a session.
- `POST /logout` - revokes the current session; safe without a session.
- `GET /me` - returns the authenticated account's id, email, role and verification state.

Credential failures return a generic response. Passwords, raw session tokens, email tokens and private audit metadata are never logged or returned.

## Production email configuration

The development `console` adapter is token-silent. Production requires:

- `EMAIL_VERIFICATION_PROVIDER=webhook`
- `EMAIL_PROVIDER_URL` using HTTPS
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM` using an externally verified sender domain

The webhook receives JSON `{ from, to, subject, text }`. Provider credentials are environment-managed. Actual delivery requires deployment-level provider verification and monitoring; it is not claimed by local tests. MFA and synchronizer CSRF tokens remain deferred; SameSite cookies and same-origin Origin enforcement are active.
