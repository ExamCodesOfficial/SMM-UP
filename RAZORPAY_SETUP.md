# Razorpay activation checklist

The Razorpay integration is implemented as a payment rail separate from Direct UPI/Paytm. Direct UPI continues to use `/api/payments/*`; Razorpay uses `/api/razorpay/*` and `/api/razorpay-webhook`.

## 1. Server-only environment variables

Set these in the Vercel project environment. Do not put them in frontend variables, source control, chat, screenshots or support tickets.

```text
RAZORPAY_KEY_ID=rzp_test_...             # use rzp_live_... only for Live Mode
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_MODE=test                       # must match the key prefix exactly
RAZORPAY_ALLOW_TEST_WALLET_CREDIT=false # safe default; see warning below
RAZORPAY_MAX_DEPOSIT_INR=100000          # optional
```

Only the Key ID is sent to authenticated Checkout clients. Key Secret and webhook secret stay server-side.

**Test safety:** Test Mode payments are recorded as `test_paid` and do not create spendable wallet balance by default. Do not set `RAZORPAY_ALLOW_TEST_WALLET_CREDIT=true` against the production wallet database. That override is only for an isolated staging database/project.

## 2. Dashboard webhook

Create a Razorpay webhook pointing to:

```text
https://smmup.co.in/api/razorpay-webhook
```

Use a new high-entropy webhook secret and set the identical value as `RAZORPAY_WEBHOOK_SECRET`. Subscribe at minimum to:

- `payment.captured`
- `payment.failed`
- `refund.created`, `refund.processed` and `refund.failed`
- all available `payment.dispute.*` lifecycle events, including `payment.dispute.created` and `payment.dispute.action_required`

The endpoint verifies the HMAC over the untouched raw request body, deduplicates `x-razorpay-event-id`, fetches authoritative captured payment data and uses transactional idempotent wallet settlement.

## 3. Capture and methods

- Keep automatic capture enabled. The Orders API also requests automatic capture.
- Enable only payment methods approved for the merchant account.
- Wallet credit requires Razorpay payment state `captured`; an `authorized` callback is not enough.
- No customer surcharge is added by this implementation. If the commercial fee policy changes, update the displayed payable/credit amounts and legal copy before launch.

## 4. Required pre-live tests

Use Test Mode and an isolated database to exercise:

1. Successful Checkout and captured payment.
2. Failed payment and user cancellation.
3. Forged Checkout signature (must be rejected).
4. Mismatched order, amount and currency (must be rejected).
5. Authorized payment followed by delayed capture.
6. Webhook before browser callback.
7. Browser callback before webhook.
8. Duplicate callback and duplicate webhook delivery (must credit once).
9. Refund and dispute events (must put the payment/account under review).
10. Test Mode against production-like configuration with test credit disabled (must add no spendable balance).

After credentials are configured, verify Checkout in the deployed browser and inspect CSP violations. Keep the allowlist limited to Razorpay origins actually required; do not add broad `https:` or wildcard sources.

## 5. Live activation

- Complete Razorpay KYC/website approval.
- Replace all three Test credentials/secrets with Live values and set `RAZORPAY_MODE=live`.
- Keep `RAZORPAY_ALLOW_TEST_WALLET_CREDIT=false`.
- Recreate/verify the webhook in Live Mode; Test and Live configuration are separate.
- Complete one small real payment, confirm exactly one `transactions` settlement, one `wallet_ledger` entry and one wallet credit, then verify refund/dispute alerts and support procedures.
