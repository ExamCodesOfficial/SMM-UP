# Security Policy

## Supported code

Security fixes target the maintained deployment branch and reviewed candidates. The current audited candidate is `improvement/full-audit-remediation` at `32205672bd8a1c7ea4d243c72391248cf57fdd26`. The earlier bot-modularization checkpoint is `2c60e657c5759f7a22cf9fbb872e1d1e051e7201`; historical commits and unmaintained forks are not supported releases.

## Report privately

Do not open a public issue for a vulnerability.

Use GitHub’s private vulnerability reporting or a private Security Advisory for this repository when enabled. If unavailable, contact the repository owner through a previously verified private channel. Do not invent or trust contact information copied from an issue comment.

Include only what is necessary:

- affected commit/deployment and component;
- reproducible steps using non-production data;
- expected versus observed behavior;
- security impact;
- bounded, redacted logs or identifiers;
- suggested containment when known.

## Never include

- GitHub, Vercel, Railway, MongoDB, Telegram, supplier, Resend, Razorpay or mailbox credentials;
- raw session cookies or authorization headers;
- password or API-key values/hashes;
- email-change, recovery or Support Access tokens;
- UPI PIN, OTP, CVV or banking password;
- complete payment-email bodies;
- unnecessary user email, social target or payment evidence;
- private pricing values.

If a credential was exposed, revoke or rotate it immediately. Deleting the message or commit is not sufficient remediation.

## Response priorities

| Severity | Examples | Initial action |
|---|---|---|
| Critical | authentication bypass, remote admin action, raw-secret exposure, unauthorized wallet mutation | contain immediately; stop unsafe service/path; rotate/revoke |
| High | cross-account data access, session/Support Access escape, duplicate settlement risk | restrict affected flow; preserve evidence; patch urgently |
| Medium | bounded information exposure, abuse-control bypass without proven account/financial impact | validate scope; schedule reviewed fix |
| Low | hardening gap without direct exploit, documentation-only security drift | triage and address in normal maintenance |

No response-time promise is made publicly. The incident commander records detection, containment, scope, eradication, recovery and preventive work privately.

## Security invariants

- Permanent passwords are bcrypt-only and unreadable.
- Session, email-action, Support Access and API-key secrets are hash-only at rest, except explicitly protected five-minute owner action state.
- Support Access preserves actor/subject and remains read-only.
- Administrative mutations require numeric Telegram owner authorization and confirmation where designed.
- Financial mutations use transaction and idempotency/settlement identities.
- Direct UPI and Razorpay evidence must bind exactly before credit.
- The Telegram bot uses long polling, not an HTTP webhook.
- No website admin panel exists.

## Validation

Security-sensitive changes require relevant root/admin TypeScript, replica-set integration, dependency-audit, whitespace and credential-pattern checks. Provider/runtime claims require staging evidence; unit or integration tests alone are not production proof.

See [`SECURITY_DEPLOYMENT_RUNBOOK.md`](SECURITY_DEPLOYMENT_RUNBOOK.md) for deployment, rollback and incident procedures.

## Threat model summary

Primary protected assets are account control, wallet balances, order identity, payment evidence, reseller secrets, owner authority, mailbox access and private supplier/pricing configuration. Principal trust boundaries are browser→Vercel, Vercel→MongoDB/provider/Resend/Razorpay, Railway→Telegram/mailbox/MongoDB, and deployment-control-plane access.

High-risk classes include:

- actor/subject confusion in Support Access;
- replay of sessions, email links, admin callbacks or payment evidence;
- cross-account object lookup;
- duplicate wallet mutation under concurrency;
- supplier ambiguity followed by blind retry/refund;
- provider/webhook signature bypass;
- secret leakage through URLs, logs, Telegram, browser bundles or Git history;
- per-instance limiting that fails under serverless concurrency;
- startup/index failures silently weakening uniqueness.

Controls must fail closed. Availability work may not bypass authentication, transactions, exact evidence or unique indexes.

## Production secret minimums

`JWT_SECRET` and `CRON_SECRET` must each be at least 32 characters and must be distinct. HMAC-specific secrets should also be independently generated rather than derived from database/provider values. Use the provider templates as inventories, not as deployable values. Any secret exposed in chat, logs, screenshots or Git must be rotated even if later deleted.

## Coordinated remediation record

A private remediation record should include affected deployment/commit, detection time, bounded evidence, containment, credentials rotated, data/financial scope, migration or reconciliation performed, tests, deployment IDs, monitoring period and final owner sign-off. Never put exploit details or sensitive evidence in a public issue.

## Full-audit security controls (2026-10-06)

- Reset and email-change query credentials are copied to component memory and immediately removed with `history.replaceState` before reset/email-change network traffic.
- Guarded navigation waits for explicit session resolution. Continuation targets are mapped from an allowlist; arbitrary/external `next` values are ignored.
- Cookie-authenticated mutations in auth, orders, payments, reviews and presets perform same-origin host checking whenever the browser supplies `Origin`.
- Profile changes require the current password. Account erasure additionally requires exact-name confirmation, zero wallet balance, no active order and no pending deposit.
- Erasure revokes normal/restricted/support sessions, recovery tokens, API key identities/versions and removes public reviews, favourites/templates and sensitive order targets/comments while retaining pseudonymous required records.
- Templates accept only a sanitized name, service identity and optional quantity. They never store links, usernames or comments.
- Public review listing performs no seed/moderation write and returns no order target. Moderation remains in the owner-only Telegram path.
- Payment-limit endpoints expose safe numeric bounds only; gateway/UPI secrets and internal pricing remain server-only.
- Unknown routes do not receive the authenticated SPA shell; `public/404.html` is `noindex,nofollow` and contains no account data.

### New test obligations

Run `test:email-auth` for profile/erasure behavior, `test:presets` for ownership/privacy/origin behavior and `manualBrowserAudit.mjs` for token scrubbing, guarded metadata, modal navigation and 404 runtime behavior. A production release must additionally prove session/key revocation and target erasure against a disposable staging account.
