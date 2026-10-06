# SMM UP API Reference

> **Canonical origin:** `https://smmup.co.in`
> **Source baseline:** feature branch `improvement/full-audit-remediation`, remote commit `32205672bd8a1c7ea4d243c72391248cf57fdd26`; the earlier bot-modularization baseline remains in history at `2c60e657c5759f7a22cf9fbb872e1d1e051e7201`
> **Last reconciled:** 2026-10-06
> **Audience:** authorized engineers, operators and reseller-API integrators
> **Security:** examples contain placeholders only. Never place real credentials in URLs, source, browser code, screenshots, logs or support messages.

This document describes both HTTP surfaces in the repository:

1. the public reseller protocol at `POST /api/v2`; and
2. the first-party website APIs under `/api/auth`, `/api/orders`, `/api/payments`, `/api/razorpay`, `/api/reviews`, `/api/services`, `/api/cron` and `/api/razorpay-webhook`.

The website APIs are implementation contracts for the SMM UP browser application. They are not a promise of third-party compatibility. Reseller integrations should use `/api/v2`.

---

## 1. Contract hierarchy

When descriptions conflict, use this order:

1. deployed handler behavior for the exact deployment being called;
2. source code at the deployment commit;
3. this file;
4. the customer-facing `/api` page;
5. examples or historical notes.

A GitHub commit does not prove that Vercel deployed it. Record both source commit and Vercel deployment ID when investigating behavior.

---

## 2. Shared transport rules

- Use HTTPS only.
- JSON is the normal response format, except successful `POST /api/auth/support-page-view`, which returns `204 No Content`.
- Mutations use `POST`, except API-key update/archive also accept the documented alternate methods.
- Authenticated account APIs use secure HTTP-only cookies. They are same-site first-party browser APIs, not cross-origin APIs.
- API responses are marked `no-store` by Vercel headers. The public catalog adds a bounded shared-cache directive.
- Browser code parses responses through `src/lib/apiResponse.ts`, which enforces a bounded response body and handles non-JSON error bodies safely.
- Unknown actions return a bounded `400` or `404` JSON error.
- Top-level handlers catch initialization failures and return controlled JSON rather than leaking stack traces.

### Typical error shape

```json
{
  "error": "Human-readable bounded message",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

Do not branch only on error text. Use HTTP status and `code` when present.

### Status-code conventions

| HTTP | Meaning |
|---:|---|
| `200` | Request completed, including idempotent already-completed outcomes |
| `201` | Resource created |
| `202` | Accepted but provider capture/final state is still pending |
| `204` | Successful request with no response body |
| `400` | Invalid input, invalid lifecycle action, supplier rejection or unsupported action |
| `401` | Missing/invalid account session, API key or internal bearer credential |
| `403` | Authenticated but prohibited by scope, role, Support Access mode or account hold |
| `404` | Resource/action not found in the authenticated ownership boundary |
| `409` | One-time token conflict, replay, stale pending state or reconciliation conflict |
| `410` | Retired insecure API-key action |
| `413` | Bounded input/body limit exceeded |
| `429` | Persistent shared rate limit exceeded |
| `500` | Internal failure; mutation outcome may require inspection before retry |
| `502` | Invalid/unavailable provider response |
| `503` | Required dependency or secure configuration unavailable |

### Retry rule

Safe retries depend on the operation:

- read-only requests can use exponential backoff with jitter;
- one-time exchanges and credential mutations should be retried only after reading current state;
- payment settlement/status requests converge idempotently when they use the same exact identifiers;
- **never blindly retry `action=add` or website order creation after a timeout, `500` or `503`**. A wallet reservation and supplier submission may already exist. Inspect Order History or contact support with the returned/local reference first.

---

## 3. Authentication models

| Model | Used by | At-rest rule |
|---|---|---|
| Normal account session | first-party website APIs | random opaque token; SHA-256 hash only in `sessions` |
| Restricted recovery session | permanent-password completion | separate opaque cookie; hash only in `restricted_sessions` |
| Support Access session | owner read-only customer view | separate opaque cookie; actor and subject retained separately |
| Named API key | `/api/v2` | raw secret shown once; secret hash and safe hint persist |
| Cron bearer | `/api/cron/status-sync` | Vercel secret; minimum 32 characters |
| Razorpay webhook HMAC | `/api/razorpay-webhook` | server-only webhook secret |
| Public | service catalog and approved reviews | no credential; response fields are intentionally bounded |

### Support Access boundary

A Support Access session lasts 15 minutes after a one-time code exchange. It may read approved account, order, deposit and key metadata but cannot mutate passwords, API keys, sessions, orders, reviews or deposits. The owner’s actor identity and customer subject identity remain separate.

### Required production secrets

- `JWT_SECRET` must be at least 32 characters. Authentication fails closed when it is missing or too short.
- `CRON_SECRET` must be at least 32 characters. The status cron returns `503` when it is absent/short.
- Use `vercel.env.example` and `railway.env.example` as the exhaustive provider inventories.

---

# Part I — Reseller API (`/api/v2`)

## 4. Endpoint and authentication

**Recommended endpoint**

```text
POST https://smmup.co.in/api/v2
```

The handler also reads actions from GET query parameters for compatibility, but a raw API secret is never accepted in a URL. If `?key=` appears, the request is rejected with `SECRET_IN_URL_REJECTED`.

Preferred authentication:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

Accepted alternatives:

- `X-API-Key: YOUR_API_KEY`; or
- `key=YOUR_API_KEY` in a POST body.

Never put a key in browser JavaScript or a mobile binary. Call the reseller API from a server you control.

### Minimal request

```bash
curl --request POST 'https://smmup.co.in/api/v2' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"action":"balance"}'
```

```json
{
  "balance": "150.00",
  "currency": "INR"
}
```

## 5. Named-key lifecycle

Each integration receives a separate identity with:

- stable public key ID;
- one active version at a time;
- explicit scopes;
- optional expiration;
- optional daily and monthly INR limits;
- pause/resume state;
- free secret rotation/reissue;
- permanent archive with exact-name confirmation;
- bounded request activity and durable financial/order attribution.

Creating a new identity charges the configured wallet fee (default ₹29). Rotation is free. Archive gives no refund. A raw secret is returned only on creation/rotation and cannot be restored.

`Full Access` synchronizes all currently defined scopes. It is not a wildcard for future scopes.

## 6. Scopes

| Scope | Actions |
|---|---|
| `services:read` | `services` |
| `balance:read` | `balance` |
| `orders:create` | `add` |
| `orders:read` | `status` |
| `orders:cancel` | `cancel` |
| `orders:refill` | `refill`, `refill_status` |

Scope, key status, expiration and account holds are checked before the relevant mutation. The shared limiter allows 120 requests per 60-second fixed window per key identity.

## 7. Action summary

| Action | Required fields | Success shape | Mutation |
|---|---|---|---|
| `balance` | none | `{ balance, currency }` | no |
| `services` | none | array of public service records | no |
| `add` | `service`, `link`, quantity/type fields | `{ order }` | wallet, spend bucket, ledger, order, supplier |
| `status` | `order` | status object or map | may persist supplier status |
| `cancel` | `order` | accepted request message | supplier request + local status |
| `refill` | `order` | refill ID | supplier request + local refill ID |
| `refill_status` | `refill` | `{ status }` | no financial mutation |

## 8. `balance`

Request:

```json
{ "action": "balance" }
```

Response values are strings with two decimal places where applicable.

## 9. `services`

Request:

```json
{ "action": "services" }
```

Each item may contain:

```json
{
  "service": 5641,
  "name": "Service name",
  "type": "Default",
  "category": "Category",
  "platform": "Telegram",
  "rate": "50.59",
  "min": 100,
  "max": 100000,
  "dripfeed": false,
  "refill": true,
  "refill_days": 30,
  "refill_type": "30 Days Guaranteed",
  "cancel": false
}
```

`rate` is the customer-facing INR rate per 1,000 units. Private supplier cost and markup configuration are never returned. Service availability, rate, limits and capabilities are dynamic; cache briefly and revalidate before placing an order.

## 10. `add`

### Parameters

| Field | Required | Rule |
|---|---|---|
| `service` | yes | positive service ID from `services` |
| `link` | yes | public target or username; 3–2048 characters; no control characters |
| `quantity` | normally | safe integer in current min/max |
| `comments` | custom comments | one non-empty comment per line; maximum 100,000 characters |
| `runs` | optional | positive integer, maximum 10,000 |
| `interval` | optional | positive integer, maximum 1,000,000 |

Package services use an effective quantity of one. Custom Comments services derive quantity from non-empty comment lines.

### Reservation sequence

1. authenticate the key and enforce `orders:create`;
2. load and revalidate the current service;
3. calculate the charge server-side;
4. in one MongoDB transaction, reserve daily/monthly key spend, debit the wallet, write the wallet ledger, and create a local `Submitting` order;
5. submit to the supplier outside MongoDB;
6. finalize with the supplier order ID, or preserve a review-required local order when the supplier response is failed/ambiguous.

The local transaction happens before supplier execution so a supplier-accepted order never lacks a prior wallet reservation. The supplier call cannot be atomic with MongoDB.

### Successful request

```json
{ "order": 22001 }
```

A normal success returns the supplier order ID for SMM v2 compatibility. The internal MongoDB order ID remains available in account history and key activity/reporting.

### Failed or uncertain submission

A failed supplier response can return an internal local order ID:

```json
{
  "error": "Provider response was rejected or requires review.",
  "order": "68e4..."
}
```

If the supplier may have accepted an order but local finalization was interrupted, the response is `503`, includes the internal order ID, and explicitly says not to place it again. Funds remain associated with the durable order while the owner reconciles supplier state. There is no blind retry or automatic refund when duplicate fulfillment is possible.

### Client retry policy for `add`

- On validation `400` without an order reference, correct input before retrying.
- On insufficient-balance/scope/limit failures, change account/key state before retrying.
- On any response containing `order`, store it and do not create a replacement automatically.
- On a network timeout or unclassified `500`, treat the outcome as unknown. Check account order activity and balance before any new `add` request.
- The protocol currently has no caller-supplied idempotency key. Do not claim at-most-once creation from a client retry.

## 11. `status`

Single request:

```json
{ "action": "status", "order": "22001" }
```

Single response:

```json
{
  "charge": "50.59",
  "start_count": "1204",
  "status": "In progress",
  "remains": "612",
  "currency": "INR"
}
```

The `order` value may be an owned supplier order ID or an owned internal order ID that has a supplier binding. Ownership is always enforced.

For up to 100 orders, send comma-separated IDs. The response is keyed by supplier order ID. Known terminal local state is preserved instead of being overwritten by a nonterminal supplier response.

Canonical statuses include `Pending`, `In progress`, `Processing`, `Completed`, `Partial`, `Canceled`, `Failed` and `Refunded`.

## 12. `cancel`

```json
{ "action": "cancel", "order": "22001" }
```

Only orders whose service was marked cancelable are eligible. Success means the supplier accepted a cancellation **request** and local state became `Cancel requested`. It does not prove final cancellation or an immediate wallet adjustment.

## 13. `refill` and `refill_status`

Refill request:

```json
{ "action": "refill", "order": "22001" }
```

```json
{ "success": true, "refill": "99120" }
```

Refill status:

```json
{ "action": "refill_status", "refill": "99120" }
```

```json
{ "status": "Pending" }
```

A refill request is allowed only when the stored order was created with refill availability. Supplier acceptance and timing remain provider-dependent.

## 14. Activity, reports and retention

The account API exposes key-specific activity and reports to the signed-in owner of the account. Detailed request activity is retained for 90 days and can include action, result, status, latency, key version, service, target, quantity, order and amount attribution. Durable order, ledger and refund records retain lifetime financial attribution under the operating policy.

Telemetry excludes raw secrets, passwords, authorization headers, cookies, OTPs and banking credentials. Source IP is HMAC-pseudonymized before storage and is not returned by the activity endpoint.

---

# Part II — First-party website APIs

## 15. Endpoint matrix

### Account, email, recovery and sessions

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public, limited | create unverified account and send verification email |
| POST | `/api/auth/resend-verification` | public, limited | enumeration-resistant verification resend |
| POST | `/api/auth/verify-email` | one-time email token | verify registration or commit email change |
| POST | `/api/auth/forgot-password` | public, limited | enumeration-resistant reset request |
| POST | `/api/auth/reset-password-email` | one-time email token | replace password and revoke sessions |
| POST | `/api/auth/request-email-change` | normal session + current password | send confirmation to new mailbox |
| POST | `/api/auth/login` | public, limited | permanent login or restricted temporary-password login |
| POST | `/api/auth/logout` | session if present | revoke current session and clear cookies |
| GET | `/api/auth/me` | normal/support session | return bounded current account state |
| GET | `/api/auth/recovery-status` | restricted recovery cookie | inspect password-change-only session |
| POST | `/api/auth/complete-password-change` | restricted recovery cookie | create permanent password and invalidate recovery state |
| GET | `/api/auth/list-sessions` | normal/support-read | list bounded active-session metadata |
| POST | `/api/auth/revoke-session` | normal session | revoke one owned session |
| POST | `/api/auth/revoke-other-sessions` | normal session | revoke all other sessions and legacy cutover state |

Password creation/reset requires 10–128 characters and at least three of lowercase, uppercase, number and symbol categories. Login does not reapply creation complexity and allows bounded legacy password input.

### Support Access

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/exchange-support-access` | normal admin session + one-time code | create separate 15-minute read-only subject session |
| POST | `/api/auth/exit-support-access` | support session | revoke support session and audit exit |
| POST | `/api/auth/support-page-view` | support session | write bounded route audit; returns `204` |

The exchange code lasts five minutes, is one-time and hash-only at rest. Mutating first-party endpoints call the Support Access guard and fail closed.

### Named API-key management

| Method | Endpoint | Important inputs |
|---|---|---|
| GET | `/api/auth/list-api-keys` | none |
| POST | `/api/auth/create-api-key` | name, scopes, optional limits/expiry, idempotency input used by UI |
| POST/PATCH | `/api/auth/update-api-key` | key ID and safe configuration |
| POST | `/api/auth/pause-api-key` | key ID |
| POST | `/api/auth/resume-api-key` | key ID |
| POST | `/api/auth/rotate-api-key` | key ID and `confirm: true` |
| POST/DELETE | `/api/auth/archive-api-key` | key ID and exact confirmation name |
| GET | `/api/auth/api-key-activity` | bounded filters and limit ≤100 |
| GET | `/api/auth/api-key-report` | optional key/date/service/order/amount filters |

Legacy `generate-key`, `regenerate-key`, `reveal-key` and `delete-key` return `410`; they are not aliases for the secure multi-key design.

### Website orders

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST | `/api/orders/create` | normal session | reserve wallet + ledger + local order transactionally before supplier call |
| GET | `/api/orders/list` | normal/support-read | limit 1–100; exact escaped status filter |
| GET | `/api/orders/status?id=...` | normal session | owned internal order; supplier status when nonterminal |
| POST | `/api/orders/refill` | normal session | owned eligible order only |
| POST | `/api/orders/cancel` | normal session | accepted request is not final refund proof |

Website order creation validates the service and price on the server. A `Submitting` local order and debit exist before supplier execution. Failed/uncertain supplier outcomes are retained for owner review and are not blindly refunded or retried.

### Direct UPI

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST | `/api/payments/create-order` | normal session | creates exact pending deposit and UPI URI |
| GET | `/api/payments/check-status` | normal session | exact user-owned memo or transaction ID |
| POST | `/api/payments/verify-identifier` | normal session | exact pending ID, amount, memo and bank evidence |
| POST | `/api/payments/verify-utr` | normal session | compatibility alias for exact identifier flow |
| GET | `/api/payments/history` | normal/support-read | most recent 30 owned transaction records |

`create-order` returns `transactionId`, amount, memo, VPA and UPI URI. The browser generates its QR locally with `qrcode`; the payment URI is not transmitted to a public QR-image service.

Settlement requires one user-owned unexpired pending transaction, exact paise amount, exact receipt memo and unique anti-replay identifiers. Missing/mismatched evidence creates or preserves reconciliation state; it never produces a guessed credit.

### Razorpay

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/razorpay/config` | normal/support-read | safe mode/min/max only; no secret |
| POST | `/api/razorpay/create-order` | normal session + same origin | creates internal and provider order |
| POST | `/api/razorpay/verify` | normal session + same origin | verifies checkout HMAC and captured provider state |
| GET | `/api/razorpay/status` | normal session | converges captured payment settlement |
| POST | `/api/razorpay-webhook` | raw body + Razorpay HMAC | provider event convergence |

Captured provider state, exact order/payment/amount/currency/environment binding, unique settlement keys and MongoDB transactions protect wallet credit. Test-mode payments do not create spendable live balance unless the explicit isolated-test override is enabled.

### Reviews and catalog

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/reviews/list` | public | latest approved non-seed community reviews; no-store |
| GET | `/api/reviews/eligibility` | optional session | prior qualifying purchase and current own-review state |
| POST | `/api/reviews/submit` | normal session | one editable review per eligible user; 1–5 stars; 40–1200 chars |
| GET | `/api/services/list` | public | public catalog; supplier cost stripped; bounded shared cache |
| POST | `/api/services/list?refresh=1` | normal admin session | bypass process cache and refresh provider catalog |

The six established homepage reviews remain separate seed records. Review moderation has no website endpoint; it is Telegram-owner-only.

### Internal cron

```text
GET /api/cron/status-sync
Authorization: Bearer CRON_SECRET
```

The configured schedule is `0 4 * * *` (04:00 UTC daily). The handler scans at most 500 nonterminal supplier-bound orders from the last 30 days and requests supplier statuses in groups of 100. It fails with `503` when the secret is missing/short and `401` when the bearer value is wrong.

---

## 16. First-party data exposure rules

The browser may receive:

- its own username, email, balances and bounded account counters;
- its own order targets and operational status;
- its own deposit references and statuses;
- masked API-key metadata, scopes, limits and history;
- one newly created/rotated API secret exactly once;
- read-only subject data during an audited owner Support Access session.

The browser must never receive:

- permanent password hashes or readable passwords;
- prior/raw API-key secrets;
- raw stored session tokens;
- supplier credentials or private pricing multipliers;
- Razorpay secret/webhook secret;
- mailbox app passwords;
- UPI PIN, OTP, CVV or banking password.

---

## 17. State and idempotency map

| Flow | Stable identity | Replay control |
|---|---|---|
| Normal session | session object ID + token hash | revocation/expiry + hash lookup |
| Email action | email-token hash + purpose | one-time `used_at`/`invalidated_at` claim |
| Temporary password | temporary record + bcrypt hash | atomic use count + expiry + completion invalidation |
| Support Access | code hash then support session hash | one-time code + actor-bound transaction |
| API-key creation | identity + request idempotency record | unique transaction/ledger keys |
| API order | local order ID + wallet settlement key | transactional reservation; no blind supplier retry |
| Website order | local order ID + `web_order_charge:<id>` | transactional reservation; no blind supplier retry |
| Direct UPI | pending transaction + memo + UTR/transaction ID | unique anti-replay records + settlement transaction |
| Razorpay | provider event/payment/order + settlement key | HMAC + unique event/settlement identity |
| Telegram mutation | pending action + callback token hash | actor-bound atomic claim + expiry |

---

## 18. Rate-limit summary

Limits are persistent MongoDB fixed-window counters keyed with HMAC-pseudonymized identities. Representative policies in source include:

- registration: 5/hour per client identity;
- login: 10/5 minutes;
- resend/recovery/email change: 3/hour for the relevant identity;
- API-key management: 60/10 minutes per user/client identity;
- reseller API: 120/minute per key identity;
- website order creation: 30/minute per user;
- Direct UPI create: 8/5 minutes; manual verify: 5/3 minutes;
- Razorpay create: 8/5 minutes; verify: 12/5 minutes; status: 90/5 minutes;
- review edits: 5/10 minutes.

These are operational controls, not customer throughput promises. Source is authoritative if a policy changes.

---

## 19. Provider and database failure behavior

- Database initialization is lazy and handler-bounded; an unavailable database produces controlled API failure.
- Critical indexes are awaited before readiness is accepted.
- Financial and multi-record security operations require a transaction-capable MongoDB deployment.
- Provider responses are type/shape checked and provider text is sanitized before public return.
- A supplier timeout after local order reservation is ambiguous. The order remains durable for review.
- API activity write failure does not turn an already-completed supplier operation into a retryable error.
- Direct UPI and Razorpay settlement use exact evidence; unknown evidence remains pending/reconciliation.
- Telegram notification failure never substitutes for database evidence.

---

## 20. Validation matrix

Before releasing API changes, run sequentially:

```bash
npm ci
npm run typecheck
npm run build
npm run test:search-appearance
npm run test:api-keys
npm run test:recovery
npm run test:support-access
npm run test:rate-limit
npm run test:direct-upi
npm run test:email-delivery
npm run test:email-auth
npm run test:core-indexes
npm run test:order-reservations
npm audit --omit=dev
```

Also validate:

- method and authentication negatives for every changed action;
- cross-account ownership rejection;
- Support Access mutation rejection;
- duplicate/concurrent settlement behavior;
- supplier malformed/ambiguous responses;
- no secret in URL, response, logs or telemetry;
- response-size and non-JSON frontend handling;
- provider staging behavior and exact deployment environment.

---

## 21. Change checklist

Any API change must update, as applicable:

1. handler and shared library;
2. browser client and bounded response schema checks;
3. integration tests, especially transaction/concurrency cases;
4. this API reference and customer-facing `/api` page;
5. `architecture/website-architecture.md` and `architecture/full-architecture.md`;
6. `vercel.env.example` or `railway.env.example` when configuration changes;
7. deployment, rollback and reconciliation runbooks;
8. rate-limit, index, retention and privacy documentation.

Do not add a field merely because a provider returns it. Document why it is needed, who may read it, retention, sanitization and whether it contains personal, financial or supplier-sensitive data.

---

## 22. Full-audit endpoint delta (2026-10-06)

### Profile and erasure

| Endpoint | Auth and method | Contract |
|---|---|---|
| `/api/auth/update-profile` | normal account session, `POST`, same-origin when `Origin` exists | Requires the current password. Accepts a 3–40 character unique username, a sanitized display name up to 60 characters and an allowlisted avatar colour. Updates active session display metadata and non-seed review attribution. Limited to five attempts per account per hour. |
| `/api/auth/delete-account` | normal account session, `POST`, same-origin when `Origin` exists | Requires the current password and exact `DELETE <username>` confirmation. Rejects non-zero wallet balances, active orders and pending deposits. Pseudonymizes identity, erases order targets/comments, removes reviews/favourites/templates, archives keys, revokes key versions/sessions/recovery records and retains only necessary pseudonymous financial/operational evidence. |

Support Access is read-only and cannot call either mutation. A deleted account is locked and cannot restore the prior password, email, username, API secret or session.

### Server-owned payment configuration

`GET /api/payments/config` requires an account session and returns only Direct UPI `minAmount` and `maxAmount`. The maximum is resolved server-side from `DIRECT_UPI_MAX_AMOUNT_INR`, clamped to the implemented safety range. The browser must fail closed if this response is unavailable or malformed; it must not recreate an environment-dependent fallback maximum. Razorpay bounds remain owned by `GET /api/razorpay/config`.

### Favourites and privacy-safe templates

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/presets/list` | `GET` | Returns up to 50 service IDs and 25 templates owned by the signed-in account. |
| `/api/presets/toggle-favorite` | `POST` | Adds or removes one validated service ID. |
| `/api/presets/save-template` | `POST` | Stores a sanitized name, service ID and optional positive integer quantity only. Target links, usernames and comments are ignored and never persisted. |
| `/api/presets/delete-template` | `POST` or `DELETE` | Deletes only the authenticated user's valid template ID. |

Preset mutations are same-origin when `Origin` is present, rate-limited, blocked in Support Access and ownership-scoped by `user_id`. Current catalog data remains authoritative when a favourite/template is opened.

### Read-only review feed and order actions

`GET /api/reviews/list` is read-only, excludes homepage seed records, returns at most 12 approved community records, uses persistent IP limiting and may be edge-cached briefly. It never seeds or moderates. Website order cancellation is a supplier request, not a cancellation/refund guarantee. Reorder carries only the service identity and revalidates against the current catalog before the user supplies a new target and quantity.

### Browser-origin defense

Cookie-authenticated non-read mutations in auth, orders, Direct UPI payments, reviews and presets reject a mismatched `Origin` host when the header is supplied. SameSite cookies remain the primary browser boundary; origin checking is defense in depth and does not replace authentication, ownership, rate limits or transaction controls.
