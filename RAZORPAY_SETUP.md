# Razorpay Activation, Verification and Recovery Runbook

> **Current implementation checkpoint:** `32205672bd8a1c7ea4d243c72391248cf57fdd26` (`improvement/full-audit-remediation`)
> **Production verification:** pending
> **Canonical webhook URL:** `https://smmup.co.in/api/razorpay-webhook`

Razorpay is an independent funding rail. Direct UPI continues through `/api/payments/*`; Razorpay uses `/api/razorpay/*` and `/api/razorpay-webhook`.

---

## 1. Security and accounting invariants

1. The browser never receives the Razorpay key secret or webhook secret.
2. The server creates each provider order and stores a matching internal transaction.
3. All money comparisons use integer paise and INR.
4. Browser callback signatures are verified against the server-stored order ID.
5. A provider fetch—not browser-supplied state—must show `captured=true` and `status=captured` before settlement.
6. Webhook signatures cover the untouched raw request bytes.
7. Provider event IDs, order IDs, payment IDs and settlement keys have uniqueness protection.
8. Transaction state, wallet ledger and balance credit converge inside a MongoDB transaction.
9. Callback, status polling and webhook delivery may race, but one payment credits at most once.
10. Test-mode payments do not become production-spendable balance by default.
11. Refunds and disputes place matched accounts under payment/ordering review; they are not silently deducted.
12. Support Access sessions may read configuration/state but may not initiate or verify deposits.

Never “repair” a failed payment by manually changing only `users.balance`. Use an audited reconciliation procedure that preserves the transaction and ledger.

---

## 2. Server-only environment variables

Set these only in the Vercel environment. Do not place them in `VITE_*`, source control, browser logs, screenshots, chat or support tickets.

```text
RAZORPAY_KEY_ID=rzp_test_...             # rzp_live_... in Live Mode
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_MODE=test                       # exactly test or live; must match key prefix
RAZORPAY_ALLOW_TEST_WALLET_CREDIT=false # safe default
RAZORPAY_MAX_DEPOSIT_INR=100000          # optional; defaults to 100000
```

Code-enforced minimum deposit: ₹10. The maximum must be at least the minimum; otherwise code falls back to the default.

### Mode protections

- `rzp_test_...` must be paired with `RAZORPAY_MODE=test`.
- `rzp_live_...` must be paired with `RAZORPAY_MODE=live`.
- A mismatch returns service-unavailable behavior instead of guessing.
- `RAZORPAY_ALLOW_TEST_WALLET_CREDIT=true` is permitted only in an isolated staging database.
- Keep `RAZORPAY_ALLOW_TEST_WALLET_CREDIT=false` for every production-database deployment.

Only the key ID is returned to an authenticated checkout client.

---

## 3. Dashboard preparation

### Merchant readiness

- Complete Razorpay KYC and website/app review.
- Verify settlement bank account and authorized business details.
- Restrict dashboard administrator access and enable provider-supported MFA.
- Record which person owns merchant-account changes and incident contact.
- Enable automatic capture. The Orders API also requests capture.
- Enable only merchant-approved payment methods.

### Webhook

Create separate Test and Live webhooks. For production, use:

```text
https://smmup.co.in/api/razorpay-webhook
```

Generate a new high-entropy webhook secret and set exactly the same value as `RAZORPAY_WEBHOOK_SECRET` in the matching Vercel environment.

Subscribe at minimum to:

- `payment.captured`;
- `payment.failed`;
- `refund.created`;
- `refund.processed`;
- `refund.failed`;
- all available `payment.dispute.*` lifecycle events, including created/action-required events.

The endpoint records other correctly signed event types as ignored events. Unknown events must not mutate a wallet.

---

## 4. Implemented endpoints

| Endpoint | Method | Authentication | Purpose |
|---|---|---|---|
| `/api/razorpay/config` | GET | normal or read-only support session | Report safe availability, mode and amount limits |
| `/api/razorpay/create-order` | POST | normal session | Validate amount/hold/origin, create internal record and Razorpay Order |
| `/api/razorpay/verify` | POST | normal session | Verify callback signature, fetch provider payment and settle if captured |
| `/api/razorpay/status?transactionId=...` | GET | normal session | Poll exact owned deposit; fetch/settle an observed captured payment |
| `/api/razorpay-webhook` | POST | Razorpay HMAC | Process captured/failed/refund/dispute events from raw body |

### Creation state

1. Validate same-origin request and account payment hold.
2. Validate amount to at most two decimal places within configured bounds.
3. Insert internal `transactions` record with `creating` state and 30-minute expiry.
4. Create provider order in integer paise with internal receipt/notes.
5. Validate provider order ID, state, amount and currency.
6. Move internal record to `pending` with provider order ID.
7. If provider creation fails, mark still-`creating` records as `failed`.

### Settlement convergence

Browser callback, status polling and webhook all call the same settlement function. It verifies:

- exact internal/provider ownership;
- exact provider order and payment binding;
- matching test/live environment;
- exact amount and INR currency;
- captured state;
- no refund state;
- acceptable internal state;
- no user payment hold.

The settlement inserts a unique ledger item, updates the transaction and increments the user balance in one database transaction. If a concurrency race loses a unique index, it returns the already-settled exact payment rather than crediting again.

---

## 5. Required Test Mode validation

Use a dedicated Vercel preview project/database and Test credentials. Capture evidence without secret values or full personal data.

| Case | Expected result |
|---|---|
| Config absent | `enabled=false`; Checkout remains unavailable |
| Valid order creation | Internal `pending` transaction and matching provider order |
| Amount below/above limits or >2 decimals | Rejected before provider order creation |
| Payment-hold account | Create/verify rejected |
| Wrong-origin mutation | Rejected |
| Successful captured Checkout | `test_paid`; wallet unchanged with safe default |
| Forged callback signature | Rejected; no settlement |
| Wrong internal transaction/user/order | Rejected; no settlement |
| Wrong provider amount or currency | Rejected; no settlement |
| Authorized, not captured | `202`; no balance credit |
| Later capture observed by status | Same settlement path; one final record |
| Webhook before callback | Webhook settles; callback reports already settled |
| Callback before webhook | Callback settles; webhook deduplicates/converges |
| Duplicate callback | One settlement only |
| Duplicate webhook event ID | Accepted as duplicate; no second mutation |
| Concurrent callback/status/webhook | One ledger item and at most one balance increment |
| Failed payment then successful retry on same order | Failure recorded; captured retry may settle |
| Refund event | Review flag and account payment/ordering hold |
| Dispute event | Review flag and owner alert |
| Unknown valid event | Recorded/ignored; no wallet mutation |
| Missing/bad webhook headers or body | 4xx; no event/settlement |
| Oversized webhook body | Rejected |
| Test payment against production-like safe config | No spendable wallet credit |

### Database evidence

For a successful safe Test payment, verify:

- one internal `transactions` document bound to the exact provider order/payment;
- final status `test_paid`;
- `wallet_credited=false`;
- one non-spendable `wallet_ledger` test entry with zero credited amount and source amount retained;
- unique `payment_events` rows for unique webhook events;
- unchanged user spendable balance.

For an isolated staging test with test credit explicitly enabled, verify one `paid` transaction, one spendable ledger credit and one balance increment. Disable the override immediately afterward.

---

## 6. Content Security Policy check

The deployed CSP currently allows only the Razorpay origins needed by Checkout in the relevant directives. In a deployed browser:

1. open Add Funds;
2. open Razorpay Checkout;
3. exercise approved methods;
4. inspect browser console and network failures;
5. add an origin only when a reproducible required request is blocked;
6. never replace the allowlist with broad `https:` or wildcard sources.

A provider change can alter required origins, so repeat this check before launch and after major Checkout updates.

---

## 7. Live activation procedure

1. Finish Test Mode matrix and retain redacted evidence.
2. Confirm production MongoDB supports transactions and required unique indexes.
3. Confirm production backups and a rollback contact.
4. Add Live key ID, key secret and a new Live webhook secret to Vercel Production.
5. Set `RAZORPAY_MODE=live`.
6. Set `RAZORPAY_ALLOW_TEST_WALLET_CREDIT=false`.
7. Verify the dashboard Live webhook URL/events.
8. Redeploy production; do not rely on environment changes reaching an old deployment.
9. Verify `/api/razorpay/config` while authenticated shows enabled Live Mode and correct safe limits.
10. Make one small real payment from a controlled account.
11. Confirm exact order/payment/amount/currency binding.
12. Confirm one paid transaction, one wallet ledger settlement and one balance increment.
13. Confirm browser callback and webhook do not double credit.
14. Confirm owner Telegram success notification contains no secret.
15. Review Vercel function logs and Razorpay delivery status.
16. Keep Direct UPI available as a separate fallback unless it is deliberately paused.

No production success claim is valid until the real-payment evidence above is reviewed.

---

## 8. Refund and dispute handling

The current implementation is deliberately fail-closed:

1. verify the webhook;
2. insert a unique payment event;
3. find the exact Razorpay transaction when possible;
4. set `payment_review_required` on the transaction;
5. place the user under payment and ordering hold;
6. notify the owner through Telegram;
7. require manual financial reconciliation.

### Owner investigation

- Compare Razorpay order/payment/refund/dispute identifiers.
- Compare internal transaction, amount paise, environment and ledger settlement.
- Determine whether balance remains unspent, partially spent or fully spent.
- Review downstream orders and prior adjustments.
- Preserve an audit reason for every wallet correction/refund.
- Use transactional Telegram controls; do not directly edit MongoDB unless incident command explicitly approves an emergency repair.
- Release holds only after the provider and internal records reconcile.

A provider refund does not automatically mean a safe blind wallet deduction. The user may already have spent the funded balance.

---

## 9. Failure modes and response

### Provider API unavailable

- Order creation returns a bounded error and marks an unresolved `creating` record as `failed` where possible.
- Show Direct UPI as fallback.
- Do not create a manual paid transaction based on a screenshot.

### Callback lost or browser closed

- Webhook delivery or authenticated status polling can settle a captured payment.
- Search by exact internal and provider IDs during support handling.

### Webhook delayed

- Callback/status may settle first.
- Review provider dashboard delivery state.
- Retry only from the provider dashboard; replay remains safe because of event and settlement uniqueness.

### Webhook secret mismatch

- Deliveries return unauthorized.
- Compare secret assignment by environment without pasting values into logs/chat.
- Correct Vercel secret and redeploy.
- Retry failed provider events.

### Captured payment not credited

- Confirm mode, account payment hold, transaction ownership/state, amount/currency and refund state.
- Confirm provider fetch succeeds.
- Inspect for unique-index or transaction errors.
- If the account was held, keep payment under reconciliation; do not bypass the hold.

### Duplicate-key/index conflict

- Stop rollout.
- Determine whether conflict is a legitimate concurrent winner or pre-existing inconsistent data.
- Do not drop uniqueness casually.
- Repair/reconcile duplicate data with an auditable migration before retrying.

### Credentials suspected exposed

1. pause Razorpay if risk warrants;
2. rotate the affected key/webhook secret in the dashboard;
3. update Vercel secret values;
4. redeploy;
5. review provider access/event/payment logs;
6. invalidate obsolete webhook configuration;
7. record scope, timing, owner and evidence without recording the secret.

---

## 10. Rollback

If Razorpay activation is unsafe while the website is otherwise healthy:

1. remove or invalidate Razorpay credentials in the affected Vercel environment;
2. redeploy so config reports disabled;
3. disable/pause the provider webhook if it causes repeated failure;
4. keep Direct UPI operational if independently healthy;
5. do **not** roll back transaction/ledger records already settled;
6. reconcile captured-but-unsettled payments before reactivation;
7. preserve logs and provider delivery evidence;
8. restore only after the Test Mode matrix passes on the candidate deployment.

Code rollback alone does not refund a payment, reverse a wallet, rotate a secret or stop an old webhook delivery.

---

## 11. Ongoing operations

### Daily during initial launch

- Review failed webhook deliveries.
- Review unmatched/orphaned payment events.
- Review `payment_review_required` transactions and account holds.
- Compare successful provider captures with internal paid settlements.
- Watch Vercel error rates and Telegram alerts.

### Periodic

- Review enabled payment methods and merchant users.
- Rotate secrets according to incident/policy requirements.
- Re-test callback/webhook ordering and CSP after dependency/provider changes.
- Test restoration/reconciliation procedures.
- Confirm Test credentials are absent from Production and Live credentials are absent from previews.

### Evidence to retain

- deployment ID and source commit;
- environment/mode name, never secret values;
- webhook URL and enabled event list;
- redacted provider order/payment/event IDs;
- internal transaction and ledger IDs;
- test result and timestamp;
- reviewer and rollback decision.

## 12. API, mode and reconciliation contract

- `GET /api/razorpay/config` exposes only enabled state, mode and safe bounds; it never returns a secret.
- `POST /api/razorpay/create-order` requires a normal account session, same-origin request when `Origin` is present, no payment hold and exact two-decimal INR bounds.
- `POST /api/razorpay/verify` validates the browser signature, then fetches authoritative provider state. An authorized-but-not-captured payment returns `202` and no wallet credit.
- `GET /api/razorpay/status` may discover a captured payment and converge through the same settlement function.
- `POST /api/razorpay-webhook` uses the raw body and webhook HMAC; never route it through body reserialization.
- Direct UPI and Razorpay have separate internal identities. Never settle one rail using evidence from the other.

### Deployment-variable source

Use `vercel.env.example` for the complete Vercel inventory. Razorpay values are server-only. `RAZORPAY_MODE` must agree with the key prefix, and `RAZORPAY_ALLOW_TEST_WALLET_CREDIT` stays false outside an isolated disposable test environment. A changed secret or mode requires a new deployment and a recorded smoke test.

## 13. Add Funds configuration ownership after the full audit

The Add Funds screen now treats limits as runtime configuration, not browser constants:

1. `GET /api/payments/config` supplies authenticated Direct UPI minimum/maximum values.
2. `GET /api/razorpay/config` supplies Razorpay enabled state, mode and minimum/maximum values.
3. The amount entry step remains disabled until both configuration requests settle.
4. A failed Direct UPI config response disables that method and exposes retry; it does not substitute a copied environment maximum.
5. Each method independently displays its accepted range and is disabled when the selected amount is outside that range.
6. Server creation/verification remains authoritative even after browser eligibility passes.

### Preview smoke additions

- choose an amount valid for both rails and confirm both are eligible;
- choose amounts valid for only one rail and confirm only that method is enabled;
- simulate malformed/missing limits and confirm fail-closed UI with no invented maximum;
- alter `DIRECT_UPI_MAX_AMOUNT_INR`, redeploy and confirm the browser reflects the new server value;
- alter `RAZORPAY_MAX_AMOUNT_INR`, redeploy and confirm Razorpay config/creation agree;
- verify success/error feedback is announced without requesting OTP, UPI PIN, CVV or banking password.
