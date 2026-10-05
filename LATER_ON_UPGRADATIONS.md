# SMM UP — Later-On Website Upgradations

> **Status:** Final green light received on 2026-10-06. Implement incrementally in the dependency order below; every phase must pass security, TypeScript and production-build checks before deployment.
>
> **Created:** 2026-10-05 · **Expanded:** 2026-10-06
>
> **Purpose:** Master implementation roadmap for website security, payments, multi-key API access, account recovery, revocable sessions and the future Telegram owner control plane. Detailed bot implementation remains coordinated with `admin-bot/ADMIN_BOT_DEVELOPMENT_PLAN.md`.

---

## 0. Final green-light master roadmap

### Status legend

- `[x]` implemented in the current codebase
- `[~]` implementation in progress
- `[ ]` approved and queued
- `[BOT]` belongs to the Telegram owner-bot phase and must not be exposed through an unfinished public endpoint

### Phase 0 — page and payment foundations

- [x] Permanent `/account` page; remove the profile popup.
- [x] Permanent `/add-funds` page; remove the wallet popup.
- [x] Real account, wallet, support and history links.
- [x] `/profile` permanently redirects to canonical `/account`.
- [x] Separate Direct UPI and Razorpay payment rails.
- [x] Razorpay server-created Orders in paise.
- [x] Checkout and raw-body webhook HMAC verification.
- [x] Captured-payment-only, atomic, idempotent wallet settlement.
- [x] Test-mode non-spendable protection.
- [x] Refund/dispute holds and order blocking.
- [x] Narrow Razorpay CSP and updated legal/payment copy.

### Phase 1 — multiple paid API keys (code complete; database integration gate pending)

- [x] Dedicated hash-only `api_keys` and hash-only `api_key_versions` collections.
- [x] Multiple named keys per user; default maximum 10 non-archived identities.
- [x] Mandatory case-insensitively unique 3–40-character key names.
- [x] Stable public key ID/prefix plus one-time secret reveal.
- [x] Idempotent lazy legacy-key migration without integration breakage or fee.
- [x] Configurable creation fee: `API_KEY_CREATION_FEE_INR` (default ₹29).
- [x] Atomic key creation, wallet debit and wallet-ledger entry.
- [x] Idempotent creation operation to prevent duplicate charges.
- [x] Explicit permission scopes and synchronized Full Access / Select All UI.
- [x] Optional daily and monthly spending limits in integer paise.
- [x] IST daily/monthly spending buckets and atomic enforcement.
- [x] Optional expiration; Never is the default.
- [x] Pause/resume, free rotate/reissue and permanent archive lifecycle.
- [x] Exact-name destructive confirmation and no-refund disclosure.
- [x] Key-version history; old secrets can never be restored.
- [x] Per-key request, order, wallet-charge and refund attribution foundations.
- [x] New secrets never persist in `users.api_key`; legacy fields are unset atomically when migrated.
- [x] No IP allowlisting in this phase.
- [x] Static validation: root TypeScript, production build, diff check, admin-bot TypeScript and production dependency audit.
- [x] Reproducible `npm run test:api-keys` replica-set gate: transaction rollback, one-time secret storage, serial and concurrent duplicate-request idempotency, single fee ledger, daily-limit rollback, concurrent-limit enforcement, pause/resume, permanent rotation, exact-name archive and lazy legacy migration.

### Phase 2 — API activity and financial reporting

- [ ] Dedicated bounded `api_key_activity` collection.
- [ ] Request timestamp, action, result, HTTP status and latency.
- [ ] Order ID, service, target, quantity, gross charge, refund and net charge.
- [ ] Per-key totals, error rate and last-used metadata.
- [ ] Lifetime financial/order history and aggregates.
- [ ] Ninety-day detailed non-financial telemetry retention.
- [ ] Filter by key, date, action, service, order, result and amount.
- [ ] Archived keys retain complete audit attribution.
- [ ] Never store API secrets, authorization headers, passwords, cookies, OTPs or UPI PINs.

### Phase 3 — account recovery and temporary passwords

- [ ] Store permanent passwords only as bcrypt hashes.
- [ ] Server-generated temporary password (recommended default).
- [ ] Optional owner-selected temporary password.
- [ ] Store temporary credential only as a hash.
- [ ] Default temporary lifetime: 3 hours.
- [ ] Environment override: `TEMP_PASSWORD_TTL_MINUTES`.
- [ ] Default temporary maximum uses: 2.
- [ ] Environment override: `TEMP_PASSWORD_MAX_USES` (bounded to 1–2).
- [ ] Every successful temporary-password login increments an atomic use counter.
- [ ] Telegram reset message is edited with ✅, usage count, time and remaining uses.
- [ ] Reaching the use limit or expiry invalidates the temporary credential.
- [ ] Temporary login receives only a restricted password-change session.
- [ ] User must create a new permanent password before normal access.
- [ ] Permanent-password completion invalidates the temporary credential immediately.
- [ ] Existing sessions are revoked when the owner initiates reset.
- [ ] Full email and recovery evidence are visible in the owner-only Telegram bot.
- [ ] Manual identity-verification checklist and admin reason.
- [ ] Five-minute Telegram confirmation for initiating reset.
- [ ] Website “Forgot password? Contact support” route/copy until verified email recovery exists.

### Phase 4 — MongoDB sessions and owner support access

- [ ] Hash-only, server-side revocable login sessions.
- [ ] Session ID, user ID, username snapshot, creation, activity, expiry, device and purpose.
- [ ] Revoke one session or all sessions.
- [ ] `[BOT]` Owner can inspect session metadata; raw session tokens are never shown.
- [ ] `[BOT]` One-time Support Access code; five-minute exchange window.
- [ ] Dedicated `/support-access` website route.
- [ ] Fifteen-minute read-only support/impersonation session.
- [ ] Preserve actor admin ID separately from subject user ID.
- [ ] Persistent “Support Session” banner and countdown.
- [ ] Manual exit and automatic expiry.
- [ ] Read account, orders, deposits, targets, key metadata and security state.
- [ ] Block spending, deposits, key mutation and password mutation by default.
- [ ] Page/view audit trail; no existing API secret or user password access.

### Phase 5 — Telegram owner control plane

- [ ] `[BOT]` Authorize by immutable Telegram numeric owner ID.
- [ ] `[BOT]` Verify Telegram webhook secret token.
- [ ] `[BOT]` Use inline buttons for confirmations and workflows.
- [ ] `[BOT]` Five-minute financial and sensitive-action confirmations.
- [ ] `[BOT]` Full user lookup with full email and account metadata.
- [ ] `[BOT]` Complete order, deposit, wallet, refund and dispute inspection.
- [ ] `[BOT]` Suspend/reactivate users; place ordering/payment holds.
- [ ] `[BOT]` Audited wallet corrections with exact reason.
- [ ] `[BOT]` Pause, rotate/reissue and archive API keys.
- [ ] `[BOT]` Initiate temporary-password resets and receive usage notifications.
- [ ] `[BOT]` Revoke user sessions and create Support Access sessions.
- [ ] `[BOT]` Administrative notes and bounded security events.
- [ ] No website admin panel.
- [ ] No raw password, password hash, API secret, cookie, authorization header, OTP or UPI PIN in Telegram.

### Phase 6 — platform-wide hardening

- [ ] Replace process-memory rate limits with a shared persistent limiter.
- [ ] Fail-closed cron authentication.
- [ ] Owner-authorized supplier catalog refresh.
- [ ] Persistent security-event records.
- [ ] Login, reset, key-management and API abuse throttling.
- [ ] Await and validate critical MongoDB indexes.
- [ ] Canonical-domain normalization and verification.
- [ ] Verified-email registration/recovery phase later.
- [ ] Password rules apply to registration/change/reset, never the login form.
- [ ] Do not impose a 10-character maximum; permit strong long passwords/passphrases.

### Non-negotiable secret boundaries

- Never collect a UPI PIN, OTP, card CVV or banking password.
- Never store a readable permanent user password.
- Never store an active raw session/cookie for administrative use.
- Never persist a raw API-key secret after its one-time response.
- Never store authorization headers.
- Never place GitHub, Razorpay or supplier secrets in source, MongoDB records, analytics, Telegram or support messages.
- Complete operational order/payment data may be retained with owner/user authorization controls and auditability.

---

## 1. Scope classification

### Being completed immediately in the current round

- Reduce Vercel Serverless Function count by moving shared TypeScript helpers outside `/api`.
- Preserve all existing API URLs and behavior.
- Verify TypeScript and the production build.
- Change future Telegram financial-confirmation expiry from 60 seconds to 5 minutes in planning documentation.
- Create this future-upgradations document.

### Next website-security implementation round, after explicit confirmation

- Harden API-key storage and rotation.
- Bind payment verification to an exact pending transaction.
- Replace memory-only rate limiting with a shared persistent limiter.
- Make cron and supplier-catalog refresh controls fail closed.
- Implement MongoDB-backed revocable login sessions.
- Decide final new-password rules without locking out existing users.
- Normalize the primary/canonical domain.

### Explicitly later, not now

- Razorpay integration and the two-option payment UI.
- Email verification.
- Forgot/reset-password email flow.
- Full inline Telegram admin-bot development.
- Multi-admin bot permissions.
- Two-factor authentication for normal customer accounts.

---

## 2. API-key security, migration and reliable reset

### 2.1 Problem being solved

The current account record can retain the usable plaintext reseller API key alongside its hash. Keeping the hash is correct; keeping the raw key long term is not.

If the database were exposed, a raw API key could be used immediately. A hash cannot be used directly as the API key.

### 2.2 Required final state

The database must store only:

- a unique key ID or prefix;
- SHA-256/HMAC hash used for validation;
- masked hint such as `sup_abcd••••••••wxyz`;
- user ID;
- status: pending, active, grace, revoked or expired;
- created, activated, revoked and last-used timestamps;
- key version;
- optional revocation reason.

The complete raw key is shown once and is never stored after the HTTP response is created.

### 2.3 Why reset/rotation needs more than a single button

A simple implementation would replace the old key immediately and show the new key once. If the browser disconnects after the database update but before the new key is displayed, the user could lose the new key while the old one has already stopped working.

That failure mode is avoidable.

### 2.4 Reliable rotation design

Use a separate `api_keys` collection and a two-stage rotation:

1. User is authenticated and requests a replacement key.
2. For sensitive rotation, request current password confirmation or another recent-authentication proof.
3. Server generates the new raw key and stores only its hash as a **pending** key.
4. Existing active key continues working.
5. Browser displays the new raw key once.
6. User confirms `I saved this key`.
7. Server atomically activates the pending key.
8. Previous key either:
   - is revoked immediately; or
   - enters a short, clearly shown grace period if that policy is selected.
9. Audit records store the rotation event without storing either raw key.

If the browser fails before activation, the old key still works and the abandoned pending key can be discarded safely.

### 2.5 Emergency security reset

A separate **Revoke immediately** action is required for suspected compromise. It must not use a grace period.

### 2.6 Migration of existing users

For every existing user with a plaintext key:

1. Validate key format.
2. Compute and store its hash.
3. Store a masked hint.
4. Verify the API authenticator accepts the hash.
5. Remove/unset the plaintext database field.
6. Record migration version and time.
7. Never write the raw key to logs.

Migration must be idempotent and resumable. Running it twice must not revoke or alter a correctly migrated key.

### 2.7 Reset protections

- Persistent rate limit.
- Recent authentication check.
- One pending rotation per user.
- Expiring pending key.
- Atomic activation.
- Unique indexes on key ID and hash.
- One-time raw reveal.
- Clear confirmation UI.
- Audit event on generation, activation and revocation.
- No raw key in Telegram, analytics, logs or support messages.

---

## 3. Exact pending-payment binding

### 3.1 Problem being solved

A payment identifier and amount should never be enough by themselves to credit an arbitrary signed-in account. Credit must belong to one exact pending deposit created by that user.

### 3.2 Required pending transaction

Before payment begins, create a transaction containing:

- internal transaction ID;
- user ID;
- expected amount;
- currency;
- selected payment method;
- unique memo/reference;
- status `pending`;
- created and expiry times;
- settlement/idempotency state.

### 3.3 Verification requirements for the existing UPI/FamApp method

The server must verify:

1. The internal pending transaction exists.
2. It belongs to the authenticated user.
3. It is still pending and unexpired.
4. The submitted transaction ID/UTR is valid.
5. The trusted payment email exists.
6. The email indicates incoming/credited funds.
7. The sender matches the trusted configured sender.
8. The amount matches the pending transaction.
9. The memo/reference matches whenever available.
10. The payment identifier has never been processed.
11. This pending transaction has never been settled.

### 3.4 Idempotent settlement

Network retries, repeated button presses, duplicate emails or concurrent functions must still credit the wallet only once.

Use:

- unique processed-payment identifiers;
- a unique settlement/idempotency key;
- conditional status transition from `pending` to `processing`;
- atomic wallet/ledger work through a MongoDB transaction when supported;
- recoverable `processing` state and reconciliation if a multi-document transaction is unavailable.

### 3.5 Ledger binding

Update the exact pending transaction by `_id`. Do not update an arbitrary pending transaction merely because its amount matches.

### 3.6 Razorpay relationship

Razorpay is now implemented as a separate second payment method. Its wallet settlement is transactional and idempotent. The existing Direct UPI flow remains independent and still needs the additional hardening described in sections 3.3–3.5.

---

## 4. Razorpay activation and post-launch validation

> Implementation status (October 5, 2026): the two-method UI, dedicated Razorpay API, raw-body webhook, captured-payment verification, test-mode safety and wallet settlement are implemented. Account approval, credentials, deployed Checkout validation and real payment testing remain pending.

### 4.1 Payment methods

The Add Funds experience now offers:

1. **Direct UPI / existing verification method**
2. **Razorpay Checkout**

### 4.2 Implemented UI

```text
Choose payment method

[ Direct UPI ]
0% deposit fee
Pay with any UPI app
Uses unique payment reference

[ Razorpay ]
UPI, cards and other enabled methods
Automated gateway confirmation
Any applicable fee shown before payment
```

After a method is selected, show only that method's form and instructions. The user can return to payment-method selection before payment is created.

### 4.3 Razorpay does not eliminate every failure state

Razorpay greatly improves automated payment confirmation. The implementation covers these states, and staging must validate each one before Live Mode:

- customer closes checkout;
- payment fails;
- payment is authorized but webhook is delayed;
- duplicate webhook delivery;
- invalid webhook signature;
- amount/order mismatch;
- refunded or disputed payment;
- successful payment response reaches the browser before webhook;
- webhook reaches server before browser returns.

### 4.4 Implemented Razorpay backend baseline

The current implementation includes:

- server-side Razorpay order creation;
- authenticated user and exact internal pending transaction;
- amount converted safely to the smallest currency unit;
- INR currency validation;
- browser Razorpay Checkout;
- server-side payment signature verification;
- webhook signature verification using the raw request body;
- event/payment ID idempotency;
- amount, currency, Razorpay order and user binding;
- wallet credit only on verified success;
- audit and transaction records;
- webhook retry tolerance;
- no card data stored by SMM UP.

### 4.5 Razorpay activation secrets

Activation requires these server-side environment variables:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Secrets remain server-side. Only the publishable key ID may be sent to Checkout where Razorpay requires it.

### 4.6 Function-count and launch validation

Razorpay intentionally uses two dedicated Vercel functions: authenticated actions at `/api/razorpay/[action]` and an unauthenticated, HMAC-protected raw-body webhook at `/api/razorpay-webhook`. This separation prevents Razorpay from being coupled to Direct UPI/Paytm. Before Live Mode, validate the resulting function count/plan limits and observe the deployed browser's CSP console so only required Razorpay origins remain allowlisted.

---

## 5. Shared persistent rate limiting

### 5.1 Problem being solved

The current rate limiter stores counters in one process's memory. Vercel can run many isolated instances and regularly starts fresh ones. Therefore, one instance's counter is not a reliable global limit.

### 5.2 Required replacement

Use a shared store that every function sees:

- Upstash Redis; or
- MongoDB time-bucket/TTL records.

The final choice will be made before implementation. Redis is usually cleaner for high-frequency limits; MongoDB avoids adding a vendor but must be designed carefully.

### 5.3 Endpoints to protect

- registration;
- login;
- future password-reset request;
- future email-verification resend;
- API-key generation/rotation/revocation;
- order creation;
- mass order;
- deposit creation;
- payment verification;
- order status/refill/cancel;
- public review submission;
- supplier catalog refresh;
- reseller API requests.

### 5.4 Limit keys

Depending on the endpoint, use combinations of:

- normalized IP;
- user ID;
- email/identifier hash;
- API-key ID;
- action name.

### 5.5 Responses

Return HTTP 429 with a safe retry duration. Do not reveal whether a specific email exists.

### 5.6 Security events

Important repeated failures should create bounded `security_events` records so the future Telegram bot can display them without receiving raw passwords or tokens.

---

## 6. Point 4 in simple terms: fail closed

### 6.1 Cron endpoint

A cron endpoint is a private URL Vercel calls on a schedule to synchronize order statuses.

The current logic is effectively:

```text
If a secret exists, check it.
If no secret exists, continue anyway.
```

That is dangerous because a missing configuration accidentally unlocks the endpoint.

Correct logic:

```text
If secret is missing: deny.
If secret is wrong: deny.
Only if secret is correct: run.
```

This is called **fail closed**: when security configuration fails, the door stays locked.

### 6.2 Supplier catalog refresh

Normal visitors use a cached catalog. The current endpoint supports a public `refresh=1` request that forces the server to contact the supplier immediately.

Someone could repeatedly force refreshes and create unnecessary upstream traffic.

Correct behavior:

- Public requests always use the normal cache.
- Forced refresh requires an internal/owner-authorized path.
- The future Telegram bot can offer a safe **Refresh Catalog** button.
- Refresh attempts are rate-limited and audited.

### 6.3 This change does not alter customer prices

It only prevents outsiders from triggering internal maintenance work.

---

## 7. MongoDB-backed login sessions

### 7.1 Goal

Every successful login creates a server-side session that can be viewed and revoked. A stolen token must not remain valid merely because its signed expiry date has not arrived.

### 7.2 Proposed `sessions` document

```json
{
  "session_id": "random-public-identifier",
  "session_token_hash": "hash-only-never-raw",
  "user_id": "ObjectId",
  "username_snapshot": "username-at-login",
  "created_at": "date",
  "last_active_at": "date",
  "expires_at": "date",
  "revoked_at": null,
  "revoked_reason": null,
  "ip_hash": "privacy-conscious-hash-or-truncated-value",
  "user_agent": "bounded browser/device description",
  "login_method": "password",
  "last_route": "optional bounded activity label",
  "last_action": "optional non-sensitive action label"
}
```

### 7.3 Interpreting “what it does”

A session may record safe operational activity such as:

- signed in;
- viewed account;
- created order;
- generated API key;
- added funds;
- last route/action category.

It must not record:

- password;
- raw API key;
- complete JWT/session token;
- payment card data;
- private social credentials;
- full sensitive request bodies.

Detailed security/financial actions belong in separate audit/security records, not an endlessly growing session document.

### 7.4 Request verification

Every authenticated request should:

1. verify token signature;
2. extract session ID;
3. load session or use a short safe cache;
4. reject missing/revoked/expired sessions;
5. verify user is not locked;
6. update `last_active_at` at a controlled interval, not on every millisecond-level request.

### 7.5 Session UI later

Account page can show:

- Current session
- Other devices/sessions
- Created date
- Last active
- Approximate device/browser
- Revoke one
- Revoke all other sessions

### 7.6 Indexes and retention

- Unique index on session ID/token hash.
- Index on user ID and last activity.
- TTL index on expiry.
- Revoked-session retention long enough for security investigation, followed by deletion according to policy.

---

## 8. Password policy decision

### 8.1 User-proposed rule

For newly created passwords:

- 8–10 characters;
- at least one capital letter;
- at least one special character.

### 8.2 Important engineering correction

Password-complexity requirements should be checked when:

- registering;
- changing password;
- resetting password.

They should **not** be checked during login. Login must test whether the supplied password matches the stored hash. Applying new formatting rules during login would lock out existing users whose valid old password does not match the new rule.

### 8.3 Maximum-length concern

A maximum of only 10 characters reduces the strength of password-manager-generated passwords and passphrases.

Recommended final policy:

- minimum 8 characters;
- maximum 128 characters;
- at least one uppercase letter;
- at least one special character;
- permit lowercase letters and numbers;
- reject known-invalid input and extremely oversized payloads.

If the business decision remains exactly 8–10 characters, it can be implemented, but the security tradeoff should be accepted explicitly before coding.

### 8.4 Existing accounts

- Existing password hashes remain valid.
- Existing users are not forcibly locked out.
- New policy applies when they intentionally change/reset their password.
- A later forced-upgrade campaign can be considered separately if needed.

---

## 9. Forgot/reset password — later

### 9.1 Prerequisite

Choose and configure a transactional email provider and verified sending domain.

Possible providers can be evaluated later. Do not implement password reset using Telegram messages or manual support disclosure.

### 9.2 Safe request flow

1. User enters email.
2. Server always returns a generic response such as `If this account exists, an email has been sent`.
3. Apply IP and email-hash rate limits.
4. Generate a cryptographically random token.
5. Store only token hash, user ID, purpose and expiry.
6. Send HTTPS reset link.
7. Token is single-use and short-lived.
8. New password follows the finalized new-password policy.
9. Revoke all old sessions after successful reset.
10. Notify user that password changed.
11. Audit the reset without logging the token.

### 9.3 Abuse protections

- Generic responses prevent email enumeration.
- Limit requests and resends.
- Do not use predictable codes.
- Do not store plaintext reset tokens.
- Do not let support agents view or set user passwords.

---

## 10. Email verification — later

### 10.1 Registration flow

1. User registers.
2. Account is marked unverified.
3. Send one-time verification link.
4. Store only verification-token hash.
5. On success, set `email_verified_at`.

### 10.2 Decide unverified-account permissions

Before implementation, decide whether unverified users may:

- sign in;
- add funds;
- place orders;
- generate API keys;
- submit reviews.

Recommended approach: allow limited account access but block money/API-sensitive actions until verification.

### 10.3 Email-change flow

Changing email should require:

- recent authentication;
- verification of the new address;
- security notification to the old address;
- session review/revocation option.

---

## 11. Canonical-domain normalization

### 11.1 Current observation

The live apex currently redirects:

```text
https://smmup.co.in
→ https://www.smmup.co.in
```

Current sitemap/canonical/schema configuration primarily uses the apex:

```text
https://smmup.co.in
```

Search engines should receive one consistent preferred host.

### 11.2 Recommended choice

Use the shorter apex as primary:

```text
https://smmup.co.in
```

Redirect `www.smmup.co.in` to the apex.

### 11.3 Vercel steps

1. Open Vercel.
2. Open the SMM UP project.
3. Go to **Settings → Domains**.
4. Confirm both hostnames are attached:
   - `smmup.co.in`
   - `www.smmup.co.in`
5. Enter hostnames without `https://` in the domain field.
6. Open the domain options for `smmup.co.in` and set it as the production/primary destination where the Vercel UI provides that choice.
7. Configure `www.smmup.co.in` to redirect permanently to `smmup.co.in`.
8. Do not configure the apex to redirect back to `www`.
9. Follow the exact DNS records Vercel displays for the apex and `www` host. Do not guess if Vercel displays different records for the account.
10. Wait for Vercel to report valid configuration and certificates.

### 11.4 Verification

Expected final behavior:

```text
https://smmup.co.in/terms            → 200
https://www.smmup.co.in/terms        → 308 to https://smmup.co.in/terms
```

Then verify:

- canonical URL uses apex;
- `og:url` uses apex;
- JSON-LD URLs use apex;
- sitemap uses apex;
- Google Search Console has the domain property verified;
- submit the apex sitemap.

### 11.5 Alternative

If `www` remains primary, update every canonical, schema and sitemap URL to `https://www.smmup.co.in`. Do not keep a split configuration.

---

## 12. Telegram confirmation expiry decision

The future bot's financial confirmation window is now planned as **5 minutes**, not 60 seconds.

Reason:

- temporary owner internet failures should not force the entire wizard to restart immediately;
- five minutes remains bounded;
- one-time tokens and atomic consume still prevent repeated execution;
- Cancel and Close invalidate pending actions immediately.

After five minutes, confirmation must be rebuilt from current database state rather than extended blindly.

---

## 13. Recommended implementation order

### Immediate deployment unblock

1. Move shared modules outside `/api`.
2. Verify only real HTTP handlers remain in `/api`.
3. Type-check and build.
4. Deploy and verify production.

### Website security round 1

1. Fail-closed cron.
2. Remove unauthenticated forced catalog refresh.
3. Add persistent registration/login/payment/order limits.
4. Add security-event foundations.

### Website security round 2

1. Introduce `api_keys` collection.
2. Implement robust pending-key rotation.
3. Migrate plaintext keys.
4. Remove plaintext compatibility after migration verification.

### Website security round 3

1. Bind existing payment method to exact pending transactions.
2. Add settlement idempotency state.
3. Add reconciliation for interrupted settlements.
4. Test duplicates and concurrency.

### Website security round 4

1. Add MongoDB-backed sessions.
2. Add session management/revocation UI.
3. Add account lock handling.
4. Finalize and apply new-password policy to new/change/reset flows only.

### Later account features

1. Transactional email provider.
2. Email verification.
3. Forgot/reset password.
4. Email-change verification.

### Later payments

1. Razorpay sandbox integration.
2. Two-method Add Funds UI.
3. Signature and webhook verification.
4. Idempotent ledger integration.
5. Production Razorpay launch after test reconciliation.

### After the website is complete

Begin `admin-bot/ADMIN_BOT_DEVELOPMENT_PLAN.md` Phase 1.

---

## 14. Standing non-goals and security boundaries

The final green light does not authorize shortcuts across these boundaries:

- no browser-based admin panel;
- no API-key IP allowlisting;
- no readable permanent or temporary password storage;
- no API-secret, session-token, authorization-header or cookie logging;
- no UPI PIN, OTP, CVV or banking-password collection;
- no fake session/device controls before revocable MongoDB sessions exist;
- no unrestricted mutation through the default Support Access session;
- no automatic failed-order refund outside the audited owner workflow;
- no public disclosure of provider markup multipliers;
- no deployment until the active dependency phase passes its validation gate.

---

## 15. Approved defaults and implementation choices

These decisions no longer require another approval prompt:

1. New/change/reset password policy may support up to 128 characters; login only verifies the supplied credential.
2. API-key rotation revokes the old secret immediately, with no grace overlap.
3. Rotation, settings, pause/resume and legacy migration are free; a new named identity uses the configured creation fee.
4. Persistent rate limiting will be implemented behind a provider-neutral adapter; select MongoDB or managed Redis using security and operational fit without changing endpoint contracts.
5. Temporary passwords default to three hours and two successful uses, bounded to one or two.
6. Support Access code exchange lasts five minutes; read-only support sessions last 15 minutes.
7. Owner Telegram screens may show full email and operational records but never raw secrets or password hashes.
8. Canonical-domain, verified-email and transactional-email work remains dependency-gated in the later phases above.
9. Device/IP data must be minimized, pseudonymized where practical and governed by explicit retention.
10. Razorpay remains captured-payment-only and is reconciled through the idempotent wallet ledger.
