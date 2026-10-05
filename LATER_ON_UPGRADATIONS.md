# SMM UP — Later-On Website Upgradations

> **Status:** Approved planning material, not an instruction to deploy every item immediately.
>
> **Created:** 2026-10-05
>
> **Purpose:** Preserve every website-security, authentication and payment upgrade discussed before implementation begins. The Telegram admin-bot implementation has its own specification at `admin-bot/ADMIN_BOT_DEVELOPMENT_PLAN.md`.

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

Razorpay will become a later second payment method, but both methods must produce the same internal wallet ledger outcome. The payment source changes; wallet integrity rules do not.

---

## 4. Future two-method payment UI

### 4.1 Payment methods

The Add Funds experience will later offer:

1. **Direct UPI / existing verification method**
2. **Razorpay Checkout**

### 4.2 Proposed UI

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

Razorpay greatly improves automated payment confirmation, but the website must still handle:

- customer closes checkout;
- payment fails;
- payment is authorized but webhook is delayed;
- duplicate webhook delivery;
- invalid webhook signature;
- amount/order mismatch;
- refunded or disputed payment;
- successful payment response reaches the browser before webhook;
- webhook reaches server before browser returns.

### 4.4 Razorpay backend design

Later implementation should include:

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

### 4.5 Razorpay secrets

Future environment variables may include:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Secrets remain server-side. Only the publishable key ID may be sent to Checkout where Razorpay requires it.

### 4.6 Function-count consideration

Razorpay should use existing payment routing where practical. A dedicated webhook endpoint is acceptable after the shared-library move reduces Vercel's function count, but it must be designed for raw-body signature verification.

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

## 14. Explicit non-goals for the current round

The current documentation/function-count round will not:

- alter existing customer balances;
- migrate keys automatically;
- revoke existing keys;
- change payment verification;
- add Razorpay;
- change password validation;
- create login sessions;
- send emails;
- change Vercel domain settings;
- implement Telegram inline menus;
- expose any browser admin panel.

---

## 15. Decisions still requiring final approval

1. Password maximum: exactly 10 or recommended 128?
2. API-key old-key grace period: immediate revoke or short overlap?
3. API-key rotation recent-auth requirement: password re-entry or session age?
4. Persistent rate limiter: Upstash Redis or MongoDB?
5. Unverified-account permissions.
6. Transactional email provider.
7. Razorpay fee presentation/business policy.
8. Razorpay launch timing.
9. Apex versus `www` final confirmation, although apex is recommended.
10. Session retention and privacy treatment for IP/device data.
