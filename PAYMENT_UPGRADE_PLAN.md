# SMM UP — Payment Methods Upgrade Plan
**Target:** add (1) **UPI Automatic** via FamGateway, (2) **Crypto** via OxaPay; retire/gate the manual **Direct UPI** flow behind a Vercel-side toggle.

Status: **implementation in progress.** Phases 0–3 are written and typecheck clean in both repos; the frontend rewrite, the bot panel and the internal endpoint are landed. See §12 for the as-built state.

---

## 0. Executive summary

### Decisions locked with the owner (2026-11-09)

| # | Decision | **Locked** |
|---|---|---|
| D1 | Build pattern | Mirror the **existing Razorpay implementation** (`api/razorpay/[action].ts` + `api/razorpay-webhook.ts` + `server/lib/razorpay.ts` + `server/lib/wallet.ts`). It is already provider-generic at the DB layer. |
| D2 | Toggle mechanism | **Two layers**: Vercel env var (`PAYMENT_METHOD_*_ENABLED`) as the baseline, overridden instantly by a MongoDB `payment_method_config` document (toggled from the Telegram bot). **No Vercel Feature Flags.** Credentials-present is a **hard gate** on top. |
| D3 | Direct UPI | **Turned OFF via the toggle**, code and IMAP worker retained for rollback. |
| D4 | Razorpay | Also **toggleable**. |
| D5 | Disabled methods | **Hidden entirely from the UI** — not shown greyed-out. A disabled method must not appear in the method picker, the amount-limit maths, or the history legend. |
| D6 | Crypto fee | **Payer pays the network fee** (`fee_paid_by_payer = 1`). Set the toggle **on in the OxaPay Merchant API Key** *and* send it explicitly per invoice so we never depend on the key default. |
| D7 | Crypto underpayment tolerance | `under_paid_coverage = 2` (per-invoice override), on top of the merchant-key setting. |
| D8 | Bot → provider access | The bot calls a **signed internal endpoint on the website** (`/api/internal/reconcile`). Provider API keys stay **only in Vercel**. Hardened per §5.7. |
| D9 | Wallet ledger | `wallet_ledger.settlement_key` and `payment_events {provider,event_id}` unique indexes **already exist and are provider-agnostic**. No migration needed. |
| D10 | Crypto denomination | Wallet stays **INR**. OxaPay invoice in **INR if supported** (`GET /v1/common/fiats`), else **USD with a locked INR credit**. Credit the locked INR figure, never the live crypto value. |
| D11 | Deployment target | Live domain `smmup.co.in` → Vercel project **`smm-up-j26l`** (`prj_ELW77yz1Q6JT6q9nQgZA4cD0iaj5`), branch **`master`**. |
| D12 | Repo hygiene | `SMM-UP/admin-bot/` is a **stale vendored copy** of the bot. Make `SMMUP_BOT` the single source of truth. |
| D13 | Deposit UI flow | **Method first, then amount, then pay.** The customer picks the rail before the number. One method = one screen. No scattered panels. |
| D14 | Per-method denomination | Each method owns its **currency, min, max, presets and fee disclosure**. UPI methods and Razorpay are **INR**; **Crypto is USD**, $1 – $500, credited at the locked INR rate. |
| D15 | USD→INR rate | **1 USD = ₹98**, adjustable **live** from the owner bot. The rate is locked when the invoice is created and never recomputed. |
| D16 | Everything adjustable | **No future change requires a code edit.** Limits, presets, currency, rate, fee payer, under-paid coverage and lifetimes are all three-layer configurable (Mongo override → env → default). |
| D17 | Crypto payment UX | The customer **leaves the site** for the OxaPay hosted checkout and returns to `/add-funds?paid=1&tx=…`. The wallet is credited by the signed webhook; the return page verifies and shows the result. |
| D18 | FamGateway payment UX | The customer can pay **from our site** (QR rendered in-browser from the provider's `upi_intent`) **or** open the provider's hosted checkout page **or** deep-link into a UPI app. All three lead to the same order. |
| D19 | In-flight payment safety | The pending payment is mirrored to `localStorage` and **restored after a refresh** (the QR is regenerated from the stored intent, never stored as an image). A red "do not go back" banner and a `beforeunload` guard protect the live window. |
| D20 | Wrong-amount recovery | "**Wrong amount?**" → cancel the request → confirm → create a fresh one. Cancelling never orphans money: if the customer still pays a cancelled order, the webhook **still credits it** and flags it for owner review. |

### Owner instructions folded in after the first implementation pass (2026-11-09)

- **Vercel toggles set:** Direct UPI `false`, Razorpay `false`, FamGateway `true`, OxaPay `true`.
  The credential gate still hides both new rails until their API keys exist.
- **Crypto is quoted in dollars:** `$1` minimum, `$500` maximum, **1 USD = ₹98**.
- **OxaPay dashboard values** are written up verbatim in `/home/user/OXAPAY_SETUP.md`;
  the FamGateway equivalents are in `/home/user/FAMGATEWAY_SETUP.md`.

### Still open (needs a live account check)

| # | Question | Resolution path |
|---|---|---|
| Q1 | Does FamGateway accept your existing `UPI_VPA`, or only a FamPay (`@fam`) VPA? | Ask FamGateway support **before** Phase 1. If `@fam` only, your settlement account changes. |
| Q2 | Reuse the existing `FAMPAY_EMAIL` for FamGateway, or a **second dedicated Gmail**? | **Second mailbox recommended** (removes the IMAP-contention risk entirely). |
| Q3 | Does `GET /v1/common/fiats` include **INR**? | One live call with the merchant key. Decides D10 path A vs B. |
| Q4 | Which coins? | Start **USDT + BTC + ETH**; expand later via the OxaPay key's "accepted currencies" setting. |
| Q5 | Crypto min/max deposit | **RESOLVED — $1 min, $500 max** (D14). ≈ ₹98 – ₹49,000 at the locked rate. |

---

## 1. Current-state audit

### 1.1 Repo map — `ExamCodesOfficial/SMM-UP` (website + API)

```
api/
  v2.ts                        # public reseller API (balance/services/add/cancel/refill/status)
  payments/[action].ts         # Direct UPI  <-- the manual system we are replacing
  razorpay/[action].ts         # Razorpay (built, NOT configured in prod)
  razorpay-webhook.ts          # Razorpay webhook
  auth/[action].ts             # register/login/session/recovery
  orders/[action].ts           # service ordering
  presets/[action].ts
  reviews/[action].ts
  services/list.ts
  cron/status-sync.ts          # daily upstream order sync (needs CRON_SECRET — not set in prod)
server/lib/
  db.ts                        # Mongo client + per-domain index guards (fail-closed)
  wallet.ts                    # settleRazorpayDeposit / recordRazorpayEvent / flagRazorpayPaymentForReview
  razorpay.ts                  # Razorpay client + HMAC helpers
  directUpiQuote.ts            # unique-paise reservation allocator
  directUpiSettlement.ts       # Direct UPI settlement (Mongo txn)
  imap.ts                      # Gmail receipt parsing / lookup
  auth.ts, apiKeys.ts, rateLimit.ts, telegram.ts, email.ts, smm.ts, http.ts, sanitize.ts, recovery.ts
src/components/
  AddFundsPage.tsx             # <-- the deposit UI to extend (1067 lines)
  NewOrder.tsx, OrderHistory.tsx, AuthPage.tsx, ...
vercel.json                    # rewrites, CSP, cron, functions
```

### 1.2 How the current Direct UPI flow actually works

`method: "FAMPAY_UPI"` in the `transactions` collection.

1. **Create** — `POST /api/payments/create-order`
   - Validates amount (₹10 … `DIRECT_UPI_MAX_AMOUNT_INR`, default ₹100,000)
   - Reserves a **globally unique paise amount** in `direct_upi_amount_reservations` (unique index on `amount_paise`). The customer pays e.g. ₹250.07, not ₹250 — because FamApp often strips the `tn` memo, so the unique paise is the fallback identifier.
   - Generates a 5-char memo `SUPXXXXX` (unique index on `transactions.memo`).
   - Builds `upi://pay?pa=<UPI_VPA>&pn=SMM UP&am=250.07&tn=SUPXXXXX&tr=SUPXXXXX&cu=INR`
   - TTL 30 min (`DIRECT_UPI_PENDING_TTL_MINUTES`), late-verification window 24 h.
2. **Poll** — `GET /api/payments/check-status` every 3.5 s. **MongoDB read only — no IMAP per poll.**
3. **Auto-settle** — the **Railway bot worker** (`SMMUP_BOT/src/worker/paymentScanner.ts`) polls the FamPay Gmail via IMAP, extracts memo/UTR/TxID/amount, and calls `settleImapPendingPayment()`.
4. **Manual fallback** — website `POST /api/payments/verify-identifier` (owner pastes UTR/TxID; server reads the mailbox directly), or Telegram `/settleupi` (owner-confirmed, queued admin action).
5. **Settlement** — `server/lib/directUpiSettlement.ts`: MongoDB transaction, `direct_upi_settlement_key` unique, credits `users.balance`, writes `wallet_ledger` + `security_events`.

**Where the manual work comes from:** FamApp/CRED frequently strips the `tn` note from the receipt. When it does, the memo cannot be extracted, and the paise-reservation path only helps if the amount is uniquely reserved *and* the receipt is dated correctly. Everything that falls through lands in `payment_reconciliation` and requires the owner to run `/settleupi` by hand. **This is exactly the pain FamGateway is meant to remove.**

### 1.3 Vercel deployment reality

| Item | Value |
|---|---|
| Live project for `smmup.co.in` | **`smm-up-j26l`** — `prj_ELW77yz1Q6JT6q9nQgZA4cD0iaj5` |
| Aliases | `smmup.co.in`, `www.smmup.co.in`, `smm-up-j26l.vercel.app` |
| Production branch | `master` (GitHub repo `SMM-UP`, private) |
| Last prod deploy | `dpl_5Atu6Rx3BTR4fBDbKoh5E41rw5aj` — READY/PROMOTED, commit `db017a0` |
| Region | `iad1`, Node 24.x, Vite framework, Hobby plan |
| Other project | `smm-up` (`prj_LLdYYlK7p543FXe68MBCiia9tU22`) — **stale clone, `env: []`**, no domain |

**Env vars actually present on `smm-up-j26l` (prod + preview):**
`MONGODB_URI`, `DATABASE_NAME`, `PANEL_URL`, `PANEL_KEY`, `TIER1_MARKUP`, `TIER2_MARKUP`, `UPI_VPA`, `UPI_MERCHANT_NAME`, `FAMPAY_EMAIL`, `FAMPAY_APP_PASSWORD`, `FAMPAY_SENDER_FILTER`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_SUPPORT_URL`

**Not present — and this matters:**
- ❌ `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` → **Razorpay is dead code in production.** The UI hides it (the `/api/razorpay/config` endpoint returns `enabled:false`). So today there is exactly **one** live deposit method: Direct UPI.
- ❌ `CRON_SECRET` → `/api/cron/status-sync` returns 503 and the daily sync never runs. Unrelated to payments, but worth knowing.
- ❌ `RESEND_API_KEY`, `SESSION_METADATA_HASH_SECRET`, `RATE_LIMIT_HASH_SECRET`, `API_ACTIVITY_HASH_SECRET` → several features are degraded/failing in prod.

> **Implication for this project:** we are not replacing Razorpay (it was never live) — we are replacing **Direct UPI** with **FamGateway UPI**, and **adding** crypto. Razorpay stays as a third, currently-dormant option.

### 1.4 The admin bot — `TheFinalBtIsHere/SMMUP_BOT`

Owner-only Telegraf bot + Railway background worker, sharing the same MongoDB.

```
bot.ts                          # owner middleware, command registration, setMyCommands
src/commands/    general, dashboard, operations, recovery, users
src/callbacks/   adminActions   # confirms queued admin actions
src/domain/      adminActions, pendingActions, recoveryActions
src/worker/      paymentRuntime, paymentScanner (IMAP), settlement, runtime, recoveryStatus
src/db/          client, indexes
src/ui/          adminDashboard, reviews
```

Existing commands: `/start` `/menu` `/help` `/stats` `/user` `/userorders` `/deposits` `/wallet` `/events` `/orders` `/failed` `/pending` `/checkmemo` `/settleupi` `/credit` `/debit` + recovery set.

`/settleupi` is exactly the manual-credit path you want to kill. Flow: parse `SUPABCDE 50.00 987654321012 FMPIB1234567890 | reason` → validate against a `pending`/`expired` `FAMPAY_UPI` transaction → `queueAdminAction("direct_upi_reconcile")` → inline confirm button → `executeConfirmedAdminAction`.

**Drift finding:** `SMM-UP/admin-bot/` is an **older vendored copy** of this bot. `SMMUP_BOT` has `src/commands/dashboard.ts`, `src/domain/recoveryActions.ts`, `src/ui/adminDashboard.ts` and a newer `bot.ts` — none of which exist in the vendored copy. The vendored copy is dead weight and a future footgun. **All bot work goes in `SMMUP_BOT`; `SMM-UP/admin-bot/` should be deleted in a cleanup commit.**

### 1.5 Existing DB collections relevant to payments

| Collection | Purpose | Key indexes |
|---|---|---|
| `transactions` | one row per deposit attempt | `memo` unique(partial), `razorpay_order_id` unique sparse, `razorpay_payment_id` unique sparse, `direct_upi_settlement_key` unique(partial), `{user_id,created_at}` |
| `wallet_ledger` | append-only credit/debit audit | `settlement_key` unique(partial), `{user_id,created_at}` |
| `payment_events` | provider webhook idempotency | `{provider,event_id}` **unique** |
| `payment_reconciliation` | unmatched receipts needing owner action | `{memo,status,reason}` unique(partial, status=open) |
| `direct_upi_amount_reservations` | unique-paise allocator | `amount_paise` unique, `expires_at` TTL |
| `processed_transactions` | legacy IMAP dedupe | `utr`/`transaction_id`/`memo` unique sparse |
| `users` | accounts | `balance`, `payment_hold` |

> **The good news:** `payment_events` is keyed `{provider, event_id}` and `wallet_ledger` by `settlement_key`. Both are **already provider-agnostic**. Adding FamGateway and OxaPay requires **no destructive index migration** — only two new sparse unique indexes on `transactions`.

---

## 2. Provider research

### 2.1 FamGateway — "UPI Automatic"

Non-custodial UPI gateway. It connects to **your** FamPay-linked Gmail + Google App Password, parses the bank credit alert itself, extracts the 12-digit NPCI UTR, and fires a signed webhook. Funds go **directly to your UPI VPA** — 0% platform commission, no custody.

**Base URL:** `https://famgateway.in`

#### Endpoints (verified against `/docs.txt` v2.0 and `/openapi.json`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/create-order` | `X-Api-Key` or `Authorization: Bearer` (or body `api_key`) | create order → QR + intent + hosted checkout |
| `GET` | `/api/qr.php` | api_key | query-string alias; returns JSON or raw PNG |
| `GET` | `/api/checkout-status.php?order_id=fg_XXX` | **public, no key** | browser-safe polling |
| `GET` | `/api/verify-order.php?order_id=fg_XXX` | api_key | authoritative server-to-server check |
| `GET` | `/api/qr-image.php?order_id=fg_XXX` | public | PNG QR stream |
| `GET` | `/pay.php?order_id=fg_XXX` | public | hosted checkout page |
| `POST` | merchant webhook URL | `X-FamGateway-Signature` | instant success callback |

**Create-order request body**
```jsonc
{
  "amount": 499.00,          // required, INR, min ₹1
  "redirect_url": "...",     // optional
  "webhook_url": "...",      // optional — PER-ORDER OVERRIDE (we need this)
  "customer_name": "...",    // optional
  "customer_email": "...",   // optional
  "customer_phone": "..."    // optional
}
```

**Create-order success response**
```jsonc
{
  "status": "success",
  "data": {
    "order_id": "fg_DYCBZH5D",              // 10-char id, GENERATED BY FAMGATEWAY
    "qr_url": "https://famgateway.in/api/qr-image.php?order_id=fg_DYCBZH5D",
    "checkout_url": "https://famgateway.in/pay.php?order_id=fg_DYCBZH5D",
    "upi_id": "merchant@fam",
    "amount": "499",
    "payable_amount": "499",                 // EXACTLY the requested amount
    "upi_intent": "upi://pay?pa=...&tr=fg_DYCBZH5D&tn=fg_DYCBZH5D&am=499.00&cu=INR",
    "created_at_ist": "...",
    "expires_at_ist": "..."                  // created + 5 minutes
  }
}
```

**Webhook payload + signature**
```jsonc
// POST body
{ "event": "payment.success", "status": "success", "order_id": "fg_DYCBZH5D",
  "transaction_id": "FMP987654321", "amount": 499.00,
  "utr": "420987654321", "sender_name": "Rahul Sharma",
  "payment_time_ist": "08-09-2026 09:16:45" }

// X-FamGateway-Signature = HMAC-SHA256(rawBody, YOUR_API_KEY).hex
// (the API key IS the HMAC secret — there is no separate webhook secret)
```
Webhook delivery: 3 retries (5 m / 10 m / 15 m) per destination; parallel fan-out to multiple registered URLs; SSRF-blocked.

#### Facts that change our design

1. **No unique-paise reservation needed.** `payable_amount` "strictly matches requested base amount"; FamGateway matches by the **Order ID embedded in the UPI note** + UTR dedupe. → Customer pays exactly ₹250.00. Big UX win; we can drop the paise trick entirely for this method.
2. **No `order_id` field in the create-order body** (the official `docs.txt` parameter table does not list it). FamGateway generates `fg_XXXXXXXX`. → **We must carry our internal transaction ID ourselves**, via the per-order `webhook_url` override and by storing `famgateway_order_id` on our transaction row.
3. **Order lifetime is 5 minutes**, not 30. UI must set expectations and offer one-tap regenerate.
4. **The API key doubles as the webhook HMAC secret.** One credential, two duties — treat it as a single high-value secret.
5. **Polling must be ≥ 3 s** (FamGateway has a 5 s IMAP cooldown lock). Our current 3.5 s interval is fine.
6. **Never put the API key in a URL in production** — use headers.
7. ⚠️ **Requires a FamPay-connected Gmail** (or a bank UPI VPA whose credit alerts land in a connected Gmail). We already have `FAMPAY_EMAIL` / `FAMPAY_APP_PASSWORD` / `FAMPAY_SENDER_FILTER` — the same mailbox. **This creates a shared-credential + shared-IMAP dependency.**

#### ⚠️ Critical risk: Gmail IMAP contention

Today, **three** things would touch that Gmail if FamGateway is enabled:

| Actor | Frequency | Host |
|---|---|---|
| Railway bot `paymentScanner` | periodic | Railway |
| Website `verify-identifier` (manual UTR submit) | on user demand | Vercel |
| **FamGateway** | continuous while orders are pending | FamGateway's servers |

Gmail enforces strict concurrent-connection limits; a third poller can trigger `IMAP IDLE` rejections, auth failures, or temporary account suspension. FamGateway even warns about its own 5-second cooldown lock.

**Mitigation (mandatory, not optional):**
- When FamGateway is enabled, the **Railway IMAP scanner must stand down** for FamGateway-served orders. Easiest correct rule: the scanner only settles `method: "FAMPAY_UPI"` rows (legacy) and never touches `FAMGATEWAY_UPI` rows — plus a global `DIRECT_UPI_SCANNER_ENABLED` kill switch.
- Prefer **one** dedicated mailbox for FamGateway (a second Gmail with its own App Password) if the legacy scanner stays on.
- Website manual verification must remain the only other IMAP client, and it's already user-triggered + rare.

### 2.2 OxaPay — Crypto

Non-custodial crypto gateway. Merchant creates an invoice; payer pays in any supported coin (BTC, ETH, USDT, USDC, BNB, DOGE, …) against a locked rate; OxaPay confirms on-chain and calls back. Merchant settles in USDT (or via auto-withdrawal to a configured address).

**Base URL:** `https://api.oxapay.com/v1`

#### Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/payment/invoice` | `merchant_api_key` header | create invoice → `track_id` + `payment_url` |
| `GET` | `/payment/{track_id}` | `merchant_api_key` header | authoritative payment info incl. `txs[]` |
| `GET` | `/payment/accepted-currencies` | `merchant_api_key` header | coins enabled for this merchant |
| `GET` | `/common/fiats` | `merchant_api_key` header | **supported fiat currencies (INR check lives here)** |
| `GET` | `/common/prices` | `merchant_api_key` header | live crypto prices |
| `GET` | `/common/networks` | `merchant_api_key` header | supported networks |
| `POST` | merchant `callback_url` | `HMAC` header | payment status callback |

**Create-invoice request body**
```jsonc
{
  "amount": 100,                 // required
  "currency": "USD",             // optional; if set, amount is in that currency
  "lifetime": 60,                // optional; minutes, 15..2880, default 60
  "fee_paid_by_payer": 1,        // optional; 1 = payer covers network fee
  "under_paid_coverage": 2.5,    // optional; max acceptable shortfall %, max 60
  "to_currency": "USDT",         // optional; only USDT conversion allowed
  "auto_withdrawal": false,      // optional
  "mixed_payment": true,         // optional
  "callback_url": "...",         // our webhook
  "return_url": "...",           // where payer is redirected
  "email": "customer@...",       // optional
  "order_id": "ORD-12345",       // optional  <-- WE DO GET AN ORDER ID BACK!
  "thanks_message": "...", "description": "...",
  "sandbox": false
}
```

**Response**
```jsonc
{ "data": { "track_id": "184747701", "payment_url": "http://pay.oxapay.com/12373985/184747701",
            "expired_at": 1734546589, "date": 1734510589 },
  "message": "Operation completed successfully!", "error": {}, "status": 200, "version": "1.0.0" }
```

**Webhook — the real payload (from `docs.oxapay.com/webhook`)**

```jsonc
// "Paying" IPN — payer transferred, awaiting confirmation
{
  "track_id": "151811887",
  "status": "Paying",              // ⚠️ CAPITALISED in webhooks
  "type": "invoice",
  "module_name": "OxaPay",
  "amount": 10,                    // invoice amount (FIAT)
  "value": 3.6839,                 // crypto value
  "sent_value": 3.6839,            // crypto actually sent
  "currency": "POL",               // crypto currency
  "order_id": "ORD-12345",
  "email": "customer@oxapay.com",
  "fee_paid_by_payer": 0,
  "under_paid_coverage": 0,
  "date": 1738493900,
  "txs": [{
    "status": "confirming",        // → "confirmed"
    "tx_hash": "x",
    "sent_amount": 10,             // FIAT sent
    "received_amount": 9.85,       // FIAT received AFTER the fee  ← the ~1.5% gap
    "value": 3.6839, "sent_value": 3.6839,
    "currency": "POL", "network": "Polygon Network",
    "sender_address": "x", "address": "x",
    "rate": 0.36839,               // ⚠️ THE LOCKED RATE: fiat → crypto
    "confirmations": 10,
    "auto_convert_amount": 0, "auto_convert_currency": "USDT",
    "date": 1738494035
  }]
}
```
OxaPay retries an unacknowledged callback **up to 5 times**. Acknowledge with HTTP 200.

#### ⚠️ Four gotchas in that payload

1. **Status case is inconsistent between endpoints.** The webhook sends `"Paid"` / `"Paying"` (capitalised); `GET /v1/payment/{track_id}` returns `"paid"` (lowercase). **Always normalise:** `String(status).toLowerCase()`. A strict `=== "paid"` check against a webhook body would silently never settle. This is the single most likely bug in this integration.
2. **`txs[].rate` is the locked rate** (`crypto = fiat × rate`). It is the authoritative record of what the customer was quoted. We store our own INR-side lock at invoice creation and never recompute from it.
3. **`txs[].sent_amount` vs `received_amount`** shows the fee. With `fee_paid_by_payer=1` the payer sends `amount + fee` and the merchant receives the full `amount`; with `0` the payer sends `amount` and the merchant receives `amount − fee`. Our ledger records both so reconciliation is possible.
4. **`payment_url` in the doc example is `http://pay.oxapay.com/...`.** Before redirecting a user we must **validate the host is `pay.oxapay.com`** (or a subdomain of `oxapay.com`) and force `https`. Otherwise a compromised/spoofed response becomes an open redirect from our domain.

#### Where the toggles actually live

`fee_paid_by_payer`, `under_paid_coverage`, `mixed_payment`, `auto_withdrawal`, `auto_convert` and the accepted-currency list are **Merchant API Key settings** ("Advanced Options" when creating/editing a key in `app.oxapay.com/dashboard`) — and each can be **overridden per invoice** via the request body. The body value wins.

> **So we do both:** turn the toggles **on in the OxaPay Merchant API Key** (as the owner requested), *and* send `fee_paid_by_payer: 1` + `under_paid_coverage: 2` explicitly on every invoice. If the key's default ever changes, our invoices are unaffected. Note that `fee_paid_by_payer` is documented as `number · decimal · max: 1` — send the integer `1`, not `true`/`"1"`.

**OxaPay requires no KYC/KYB** to activate merchant services, so account setup is not gated on verification paperwork.

**Status machine** (from the official status table):
`new` → `waiting` → `paying` → `paid` | `manual_accept` | `underpaid` | `refunding` → `refunded` | `expired`

#### Facts that change our design

1. **OxaPay accepts `order_id` in the body** — but we should **not** trust it as our identity; we bind `track_id → our transaction _id` in MongoDB. The `order_id` we send is a redundant cross-check.
2. **`underpaid` is a first-class status.** The customer can pay 97% of the invoice and land in `underpaid`, not `paid`. We must decide: auto-credit pro-rata, auto-credit full, or hold for owner review. **Recommendation: hold for review** when the shortfall exceeds `under_paid_coverage`; auto-credit only when the invoice status is exactly `paid`.
3. **Crypto amount ≠ INR amount.** The wallet is INR. We credit the **INR figure locked at invoice creation**, never the live crypto value. Crypto price movement between invoice and confirmation must not change what the customer was quoted.
4. **Per-chain idempotency.** `txs[].tx_hash` is the on-chain idempotency key. A single invoice can have multiple txs (mixed payment). We need a unique index on `tx_hash` so a replayed/duplicated tx can never credit twice.
5. **Sandbox mode exists** (`sandbox: true`) — use it for staging, mirroring the Razorpay `RAZORPAY_MODE=test|live` pattern.
6. **Network fee is ~1%.** `fee_paid_by_payer=1` makes the customer pay it on top (cleaner for us); `0` means we eat it out of the credited INR (customer gets less than quoted). **Recommend `1`.**
7. **`/common/fiats` tells us whether INR is supported.** Must be checked live with a real merchant key before finalizing the FX design.
8. **Webhook status case differs from the GET endpoint** (`"Paid"` vs `"paid"`). Normalise before comparing — see §2.2 gotcha 1.
9. **Fee / underpayment / mixed-payment toggles are Merchant API Key settings**, overridable per invoice. We set them in both places — see §2.2 "Where the toggles actually live".
10. **OxaPay also offers a White Label endpoint** (`POST /v1/payment/white-label`) that returns a per-chain address + QR, letting us render a fully in-site crypto checkout instead of redirecting. It requires choosing a specific `pay_currency` + `network` per invoice. **Not in the first pass** (the hosted Invoice supports 40+ coins automatically and is far simpler), but it is the natural upgrade if you later want the crypto flow to stay on `smmup.co.in`.

### 2.3 Side-by-side

| | **Direct UPI** (current) | **FamGateway UPI** (new) | **OxaPay Crypto** (new) |
|---|---|---|---|
| Provider API | none (self-built) | REST + HMAC-SHA256 webhook | REST + HMAC-SHA512 webhook |
| Amount charged | ₹250.**07** (unique paise) | **₹250.00 exact** | ₹250.00 equivalent in crypto |
| Customer identifies payment by | memo `SUPXXXXX` (often stripped) | **order id in UPI note** | on-chain `tx_hash` |
| Settlement trigger | IMAP poll (bot) / manual | **provider webhook (~2–4 s)** | **provider webhook** |
| Manual owner step | **often yes** ← the pain | no | only for `underpaid`/edge cases |
| Order lifetime | 30 min (+24 h late window) | **5 min** | 15 min – 48 h (we pick 60) |
| Settlement code exists | `directUpiSettlement.ts` | new | new |
| Currency | INR | INR | INR (wallet) / crypto (paid) |
| Custody | n/a | none (direct to your VPA) | none (direct to your wallet) |
| Fee | 0% | 0% claimed | ~1% network fee |
| Credential | Gmail App Password | 64-char API key (also HMAC secret) | Merchant API Key (also HMAC secret) |

---

## 3. Target architecture

```
                    ┌──────────────────────────────────────────┐
                    │      AddFundsPage.tsx  (method picker)    │
                    │  Direct UPI │ UPI Auto │ Crypto │ Razorpay│
                    └───────────────┬──────────────────────────┘
                                    │  GET /api/payments/methods  (single source of truth)
                                    ▼
      ┌───────────────────────────��────────────────────────────────────────┐
      │            server/lib/paymentMethods.ts  (toggle resolver)        │
      │  Feature Flag (Vercel)  >  MongoDB runtime config  >  env default  │
      │  AND gate: provider credentials must be present                    │
      └───┬───────────────┬────────────────┬───────────────────┬──────────┘
          │               │                │                   │
   /api/payments    /api/famgateway   /api/oxapay      /api/razorpay
   (legacy UPI)     /api/oxapay      (existing, dormant)
          │               │                │
          │        ┌──────┴──────┐         │
          │        │             │         │
          │   FamGateway     OxaPay        │        ┌──────────────────────────┐
          │   create-order   invoice       │        │ server/lib/wallet.ts     │
          │   verify-order   payment/{id}  │        │  settleProviderDeposit() │
          │        │             │         │        │  + cryptoSettlement.ts   │
          │        │             │         │        └───────────┬──────────────┘
          ▼        ▼             ▼         │                    ▼
   ┌──────────┐ ┌──────────┐ ┌─────────┐ │            ┌───────────────────┐
   │famgateway│ │ oxapay   │ │         │ │            │ transactions      │
   │-webhook  │ │ -webhook │ │         │ │            │ wallet_ledger     │
   │HMAC-SHA256│ │HMAC-SHA512│ │        │ │            │ payment_events    │
   └────┬─────┘ └────┬─────┘ │        │ │            └───────────────────┘
        │            │       │        │ │
        └────────────┴───────┴────────┘
                     │  MongoDB transaction (one atomic credit)
                     ▼
              users.balance  +  wallet_ledger  +  security_events
                     │
                     ▼
        Telegram admin alerts + owner dashboard
```

### 3.1 Toggle model — the "toggle in Vercel"

**Why one knob isn't enough.** A Vercel env var is the canonical, auditable, single place to look — but changing it **requires a redeploy**, so you cannot kill a method during a payment incident without a deploy. The MongoDB layer fills that gap: it flips instantly, and it is what the Telegram `/payments` panel writes to.

**Resolution order (first hit wins):**

```
L1  MongoDB   payment_method_config doc  → instant, no redeploy, Telegram-bot driven
L0  Vercel env var   PAYMENT_METHOD_<ID>_ENABLED  → baseline, needs redeploy
```

Then a **hard credential gate** on top: a method can only be *enabled* if its provider credentials resolve. Turning on a method with no API key yields `enabled:false` + a reason, never a broken checkout.

**Method IDs:** `direct_upi`, `famgateway_upi`, `oxapay_crypto`, `razorpay`.

**MongoDB document**
```jsonc
// collection: payment_method_config, _id: "global"
{
  "_id": "global",
  "methods": {
    "direct_upi":     { "enabled": false, "updated_at": "...", "updated_by": "telegram:owner" },
    "famgateway_upi": { "enabled": true,  "updated_at": "...", "updated_by": "telegram:owner" },
    "oxapay_crypto":  { "enabled": true,  "updated_at": "...", "updated_by": "telegram:owner" },
    "razorpay":       { "enabled": false }
  },
  "note": "runtime override over Vercel env defaults"
}
```
This single doc is what makes the bot's `/payments` panel work instantly, and it is also the audit trail.

**Env-var defaults (the "in Vercel" knob):**
```
PAYMENT_METHOD_DIRECT_UPI_ENABLED=true       # flip to false when FamGateway is proven
PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED=false
PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED=false
PAYMENT_METHOD_RAZORPAY_ENABLED=false
```

**UI behaviour — a disabled method is invisible (D5).**
`GET /api/payments/methods` returns only the **enabled** methods. The UI therefore:
- renders a method card **only** for an enabled method;
- computes the selectable amount range from the enabled set only;
- never shows a disabled method in the history legend or in any error message.

A disabled method must be **unreachable**, not merely unclickable. Enforced server-side too:
- `POST /api/famgateway/create-order` → `403` if `famgateway_upi` is off;
- `POST /api/oxapay/create-invoice` → `403` if `oxapay_crypto` is off;
- `POST /api/payments/create-order` → `403` if `direct_upi` is off;
- `POST /api/razorpay/create-order` → `403` if `razorpay` is off.

**Critical exception — in-flight payments are never orphaned.** Turning a method **off** stops *new* orders. It must not stop the **settlement** of orders already created:
- `FAMGATEWAY_UPI` orders keep settling via webhook even after the toggle goes off.
- `OXAPAY_CRYPTO` orders keep settling via webhook.
- Legacy `FAMPAY_UPI` rows keep settling via the Railway IMAP scanner.
- Only *creation* is gated. Settlement is never gated by a toggle.

This is why the toggle check lives in the `create-*` handlers and **not** in the shared settlement function.

### 3.2 Data model

**`transactions`** — new method values, new sparse unique indexes.

```jsonc
// FAMGATEWAY_UPI
{
  "_id": ObjectId, "user_id": ObjectId, "user_email": "...",
  "amount": 250.00, "amount_paise": 25000, "currency": "INR",
  "method": "FAMGATEWAY_UPI", "provider": "famgateway",
  "environment": "live",
  "status": "pending",                       // creating|pending|processing|paid|expired|failed
  "famgateway_order_id": "fg_DYCBZH5D",      // UNIQUE SPARSE INDEX
  "famgateway_checkout_url": "https://famgateway.in/pay.php?order_id=fg_...",
  "famgateway_qr_url": "https://famgateway.in/api/qr-image.php?order_id=fg_...",
  "famgateway_upi_id": "merchant@fam",
  "famgateway_webhook_path": "/api/famgateway-webhook?tx=<ourObjectId>",
  "utr": "420987654321", "sender_name": "...", "transaction_id": "FMP...",
  "wallet_credited": false,
  "created_at": ISODate, "expires_at": ISODate, "paid_at": ISODate, "updated_at": ISODate
}

// OXAPAY_CRYPTO
{
  "_id": ObjectId, "user_id": ObjectId, "user_email": "...",
  "amount": 250.00, "amount_paise": 25000, "currency": "INR",   // wallet denomination
  "method": "OXAPAY_CRYPTO", "provider": "oxapay", "environment": "live|sandbox",
  "status": "pending",
  "oxapay_track_id": "184747701",            // UNIQUE SPARSE INDEX
  "oxapay_payment_url": "https://pay.oxapay.com/...",
  "oxapay_invoice_currency": "INR|USD",
  "oxapay_invoice_amount": 250.00,           // amount as invoiced to the provider
  "oxapay_fiat_rate_locked": 83.42,          // INR per 1 USD at invoice creation (if USD path)
  "oxapay_status": "waiting",
  "crypto_paid_amount": 0.00613418, "crypto_paid_currency": "ETH",
  "crypto_tx_hashes": ["0x2Deh..."],
  "wallet_credited": false,
  "created_at": ISODate, "expires_at": ISODate, "paid_at": ISODate, "updated_at": ISODate
}
```

**`payment_events`** — reuses the existing unique `{provider, event_id}` index.
```jsonc
{ "provider": "famgateway", "event_id": "fg_DYCBZH5D", "event_type": "payment.success",
  "famgateway_order_id": "fg_...", "transaction_id": ObjectId, "status": "paid",
  "payload_summary": { "utr": "...", "amount": 250.00 }, "received_at": ISODate }

{ "provider": "oxapay", "event_id": "<sha256(rawBody)>", "event_type": "invoice.paid",
  "oxapay_track_id": "184747701", "transaction_id": ObjectId, "status": "paid",
  "payload_summary": { "tx_hashes": ["0x..."] }, "received_at": ISODate }
```
> For OxaPay, the event_id is a SHA-256 fingerprint of the **raw body** — because OxaPay provides no event ID and can deliver the same logical event with differing bodies. This also gives us free duplicate detection.

**`wallet_ledger`** — settlement keys:
```
famgateway:fg_DYCBZH5D
oxapay:184747701
crypto_tx:0x2DehmnxMDFMhS3KHXCPpGSx41NeLBjH34q5vjN1oGbUDFFAMC9rG3   ← per on-chain tx
razorpay:pay_XXXXXXXX   (existing)
direct_upi:<pendingId>  (existing)
```

**New collection `crypto_payment_txs`** — per-chain idempotency, independent of the invoice:
```jsonc
{ "_id": "0x2Deh...", "track_id": "184747701", "transaction_id": ObjectId,
  "network": "Ethereum Network", "currency": "ETH", "amount": 0.00613418,
  "status": "confirmed", "confirmations": 11, "created_at": ISODate }
```
Unique `_id` on `tx_hash` → a replayed tx can never credit twice, even across mixed-payment invoices.

**`wallet_ledger` for crypto** — credit the locked INR amount, and record the crypto side separately:
```jsonc
{ "settlement_key": "oxapay:184747701", "type": "deposit_credit", "provider": "oxapay",
  "user_id": ObjectId, "amount": 250.00, "amount_paise": 25000, "currency": "INR",
  "source_amount": 250.00, "source_currency": "INR",
  "crypto_amount": 0.00613418, "crypto_currency": "ETH", "crypto_network": "Ethereum Network",
  "balance_after": 1250.00, "spendable": true, "transaction_id": ObjectId, "created_at": ISODate }
```

### 3.3 The three flows

**Flow A — FamGateway UPI (Automatic)**
```
User picks "UPI Automatic", enters ₹250
  → POST /api/famgateway/create-order
      • auth user, payment_hold check, rate limit
      • create transactions row (status=creating)  [no paise reservation]
      • POST https://famgateway.in/api/create-order  (X-Api-Key header)
          body: {amount:250, customer_name, customer_email,
                 redirect_url: "https://smmup.co.in/add-funds?paid=1",
                 webhook_url: "https://smmup.co.in/api/famgateway-webhook?tx=<ObjectId>"}
      • validate response (status==success, order_id matches /^fg_[A-Za-z0-9]+$/,
        payable_amount === 250)
      • update row: famgateway_order_id, checkout_url, qr_url, status=pending
  → respond { transactionId, orderId, checkoutUrl, qrUrl, upiIntent, amount:250.00 }

Browser renders: our own QR (proxied PNG) + "Open UPI app" deep link
  → poll GET /api/famgateway/status?transactionId=... every 3.5s  (Mongo read, no provider call)

Provider: bank credit → FamGateway IMAP → parses UTR → POST /api/famgateway-webhook
  → verify X-FamGateway-Signature = HMAC-SHA256(rawBody, API_KEY)  [timing-safe]
  → dedupe on payment_events {provider:"famgateway", event_id: order_id}
  → fetch authoritative state: GET /api/verify-order.php (server-to-server, key in header)
  → settleProviderDeposit() inside a Mongo transaction:
      tx row pending→paid, wallet_credited=true, utr/sender recorded
      users.balance += 250.00
      wallet_ledger insert (settlement_key = famgateway:<order_id>)
      security_events insert
  → 200 {received:true}   → Telegram alert to owner
```
Browser poll sees `status==="paid"` → confetti + balance refresh. **Webhook is authoritative; the poll is only UX.**

**Flow B — OxaPay Crypto**
```
User picks "Crypto", enters ₹250
  → POST /api/oxapay/create-invoice
      • auth, payment_hold check, rate limit
      • resolve INR credit amount = requested INR amount (integer paise)
      • create transactions row (status=creating)
      • POST https://api.oxapay.com/v1/payment/invoice   (merchant_api_key header)
          body: { amount: 250, currency: "INR"   (or USD fallback, see §4.4),
                  lifetime: 60, fee_paid_by_payer: 1, under_paid_coverage: 2,
                  to_currency: "USDT", order_id: "<ourObjectId>",
                  callback_url: "https://smmup.co.in/api/oxapay-webhook",
                  return_url: "https://smmup.co.in/add-funds?paid=1",
                  email: <user email>, description: "SMM UP wallet top-up",
                  sandbox: <false in prod> }
      • validate: status===200, data.track_id present, payment_url present
      • update row: oxapay_track_id, payment_url, invoice currency/amount, status=pending

Browser redirects to payment_url (OxaPay-hosted checkout, 40+ coins)
  → poll GET /api/oxapay/status?transactionId=... every 5s (Mongo read)

Provider: on-chain confirm → POST /api/oxapay-webhook
  → verify HMAC = HMAC-SHA512(rawBody, MERCHANT_API_KEY)  [timing-safe, raw bytes]
  → dedupe on payment_events {provider:"oxapay", event_id: sha256(rawBody)}
  → GET /v1/payment/{track_id}  → authoritative status + txs[]
  → status machine:
        paid        → settle full locked INR amount
        underpaid   → DO NOT auto-credit → flag for owner review (see §5)
        paying/waiting/new → record only, no credit
        refunded/refunding → review + payment_hold
        expired     → mark expired
  → per tx_hash: insert into crypto_payment_txs (unique) → if 11000, already known, skip
  → settleCryptoDeposit() in one Mongo transaction:
      tx row → paid, wallet_credited=true, crypto amounts recorded
      users.balance += <locked INR amount>
      wallet_ledger (settlement_key = oxapay:<track_id>) + crypto_tx:<tx_hash> ledger entries
  → 200 "ok"
```
**Status-polling fallback:** `GET /api/oxapay/status` can call `GET /v1/payment/{track_id}` server-side if the row is still pending and older than N seconds — so a dropped webhook never strands a payment.

**Flow C — Direct UPI (legacy, gated off)**
Unchanged code. Only two edits: (1) `create-order` refuses with a clear message when the toggle is off; (2) existing pending `FAMPAY_UPI` rows **keep settling** (never orphan a customer mid-payment). The Railway IMAP scanner stays for them.

---

## 4. Implementation plan — file by file

### 4.1 Website — `ExamCodesOfficial/SMM-UP`

#### New files

| File | Purpose |
|---|---|
| `server/lib/paymentMethods.ts` | Toggle resolver + method registry. Single source of truth for "which methods are on". |
| `server/lib/famgateway.ts` | FamGateway REST client + HMAC-SHA256 webhook verifier. |
| `server/lib/oxapay.ts` | OxaPay REST client + HMAC-SHA512 webhook verifier. |
| `server/lib/cryptoSettlement.ts` | Crypto-specific settlement (underpaid, tx idempotency, FX lock). |
| `api/payments/methods.ts` | `GET` → the full method list the UI renders from. |
| `api/famgateway/[action].ts` | `create-order` · `status` · `verify`. |
| `api/famgateway-webhook.ts` | Raw-body HMAC webhook. |
| `api/famgateway/qr.ts` | `GET` → proxies the FamGateway QR PNG through our domain (privacy + no CSP change). |
| `api/oxapay/[action].ts` | `create-invoice` · `status`. |
| `api/oxapay-webhook.ts` | Raw-body HMAC-SHA512 webhook. |

#### Modified files

| File | Change |
|---|---|
| `server/lib/wallet.ts` | Extract the shared body of `settleRazorpayDeposit` into `settleProviderDeposit({provider, settlementKey, ...})`; keep `settleRazorpayDeposit` as a thin wrapper so **Razorpay behaviour is byte-identical**. Add `settleFamGatewayDeposit`. |
| `server/lib/db.ts` | New `ensurePaymentProviderIndexes()`: unique sparse on `famgateway_order_id`, unique sparse on `oxapay_track_id`, unique on `payment_method_config._id` (implicit), and the `crypto_payment_txs` `_id` unique (implicit). Fail-closed before any write. |
| `server/lib/telegram.ts` | New alert templates: `sendFamGatewayPaymentAlert`, `sendCryptoPaymentAlert`, `sendPaymentMethodAlert`, `sendCryptoReviewAlert`. |
| `api/payments/[action].ts` | Gate `create-order` behind the toggle; keep `check-status`/`verify-identifier`/`history` working for legacy rows. |
| `api/cron/status-sync.ts` | No change needed — but **add a second cron** `api/cron/payment-reconcile.ts` that sweeps stale pending FamGateway/OxaPay rows (webhook lost) and re-checks them server-side. |
| `src/components/AddFundsPage.tsx` | New method cards + crypto flow (redirect + status poll) + a "UPI Automatic" QR step. |
| `src/components/OrderHistory.tsx` | Render the new method labels. |
| `vercel.json` | `functions` maxDuration for the new routes; **CSP unchanged** (we proxy the QR and redirect for crypto — no third-party `img-src`/`connect-src`/`frame-src` needed). Add the new cron. |
| `.env.example`, `vercel.env.example` | New vars (below). |
| `planner.md`, `LATER_ON_UPGRADATIONS.md`, `API_REFERENCE.md`, `README.md` | Update the payment sections (this repo is rigorously documented — the docs are part of the definition of done). |

#### `server/lib/paymentMethods.ts` — sketch

```ts
export type PaymentMethodId = "direct_upi" | "famgateway_upi" | "oxapay_crypto" | "razorpay";

export interface ResolvedMethod {
  id: PaymentMethodId;
  enabled: boolean;
  configured: boolean;
  reason?: string;              // why disabled
  source: "feature_flag" | "runtime_config" | "env_default";
  minAmount: number;
  maxAmount: number;
  currency: "INR";
  feePayer: "merchant" | "customer";
  label: string;
}

export async function resolvePaymentMethods(db: Db): Promise<ResolvedMethod[]> {
  // L1: MongoDB runtime override
  const runtime = await db.collection("payment_method_config").findOne({ _id: "global" });
  // L2: Vercel Feature Flag (best-effort, short timeout, fail-open to L1)
  const flags = await readVercelFeatureFlags(PaymentMethodFlagNames);
  // L0: env defaults
  const envDefaults = { direct_upi: envBool("PAYMENT_METHOD_DIRECT_UPI_ENABLED", true), ... };
  // hard credential gate
  const configured = {
    direct_upi: Boolean(process.env.UPI_VPA && process.env.FAMPAY_APP_PASSWORD),
    famgateway_upi: Boolean(process.env.FAMGATEWAY_API_KEY),
    oxapay_crypto: Boolean(process.env.OXAPAY_MERCHANT_API_KEY),
    razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  };
  ...
}
```
`envBool` treats `"false"`, `"0"`, `"off"`, `"no"` as false — never the naive `Boolean(process.env.X)`.

#### `server/lib/famgateway.ts` — sketch

```ts
const BASE = "https://famgateway.in";

export function hasFamGatewayConfig(): boolean {
  return Boolean(process.env.FAMGATEWAY_API_KEY);
}
export function getFamGatewayConfig() {
  const apiKey = String(process.env.FAMGATEWAY_API_KEY || "").trim();
  if (!apiKey || apiKey.length < 16) throw new ProviderError("FamGateway is not configured.", 503);
  return { apiKey };
}

export async function createFamGatewayOrder(input: {
  amountInr: number; customerName?: string; customerEmail?: string;
  redirectUrl: string; webhookUrl: string;
}) {
  const { apiKey } = getFamGatewayConfig();
  const res = await fetch(`${BASE}/api/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },  // header, never query string
    body: JSON.stringify({
      amount: input.amountInr,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      redirect_url: input.redirectUrl,
      webhook_url: input.webhookUrl,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== "success" || !body?.data?.order_id) {
    throw new ProviderError("FamGateway could not create the order.", res.status >= 400 && res.status < 500 ? 400 : 502);
  }
  const d = body.data;
  if (!/^fg_[A-Za-z0-9]+$/.test(d.order_id)) throw new ProviderError("FamGateway returned an invalid order id.", 502);
  if (Number(d.payable_amount) !== input.amountInr) throw new ProviderError("FamGateway altered the payable amount.", 502);
  return { orderId: d.order_id, qrUrl: d.qr_url, checkoutUrl: d.checkout_url,
           upiIntent: d.upi_intent, upiId: d.upi_id, payableAmount: Number(d.payable_amount) };
}

export function verifyFamGatewayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const { apiKey } = getFamGatewayConfig();
  const expected = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
  return timingSafeHexEqual(expected, signature);   // hex-length + charset check + timingSafeEqual
}

export async function fetchFamGatewayOrder(orderId: string) {
  const { apiKey } = getFamGatewayConfig();
  const res = await fetch(`${BASE}/api/verify-order.php?order_id=${encodeURIComponent(orderId)}`,
    { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(10_000) });
  ...
}
```

#### `api/famgateway-webhook.ts` — sketch

```ts
export const config = { api: { bodyParser: false } };   // raw bytes required for HMAC

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const rawBody = await readRawBody(req);                 // 1 MB cap, same helper as razorpay-webhook
  const signature = header(req, "x-famgateway-signature");
  if (!signature) return res.status(400).json({ error: "Missing signature" });
  if (!verifyFamGatewayWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  const event = JSON.parse(rawBody.toString("utf8"));
  const db = await getDb();

  // 1. dedupe
  const eventId = String(event.order_id || "");
  if (!/^fg_[A-Za-z0-9]+$/.test(eventId)) return res.status(200).json({ received: true, ignored: true });

  // 2. resolve our transaction
  const tx = await db.collection("transactions").findOne({ famgateway_order_id: eventId });

  // 3. authoritative provider state (never trust the webhook body alone)
  const authoritative = await fetchFamGatewayOrder(eventId);

  // 4. settle (idempotent, single Mongo transaction)
  const result = await settleFamGatewayDeposit({ transactionId: tx?._id, order: authoritative, eventId });

  // 5. notify
  ...
  return res.status(200).json({ received: true, settled: result.walletCredited });
}
```

#### `server/lib/oxapay.ts` — sketch

```ts
const BASE = "https://api.oxapay.com/v1";

export async function createOxaPayInvoice(input: {
  amount: number; currency: string; orderId: string;
  callbackUrl: string; returnUrl: string; email?: string;
  lifetimeMinutes: number; feePaidByPayer: 0 | 1; underPaidCoverage: number;
  sandbox: boolean;
}) {
  const merchantApiKey = getOxaPayConfig().merchantApiKey;
  const res = await fetch(`${BASE}/payment/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json", merchant_api_key: merchantApiKey },
    body: JSON.stringify({ ... }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 200 || !body?.data?.track_id) throw new ProviderError(...);
  return { trackId: String(body.data.track_id), paymentUrl: body.data.payment_url,
           expiresAt: Number(body.data.expired_at) };
}

export function verifyOxaPayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto.createHmac("sha512", getOxaPayConfig().merchantApiKey).update(rawBody).digest("hex");
  // sha512 hex = 128 chars
  return timingSafeHexEqual(expected, signature);
}
```

#### `src/components/AddFundsPage.tsx` — changes

1. Replace the hardcoded two-config load (`directUpiLimits` + `razorpayConfig`) with a single `GET /api/payments/methods` load that returns an array of methods.
2. Amount bounds become the **intersection/union** of the enabled methods' limits — today the code computes `minSelectableAmount`/`maxSelectableAmount` across both configs; extend to N methods.
3. Method step renders one card per enabled method:
   - **Direct UPI** (legacy QR + memo + manual UTR form) — only when enabled
   - **UPI Automatic** (FamGateway) — shows the proxied QR + "Open UPI app" deep link + live status pill
   - **Crypto** (OxaPay) — "Pay with crypto" button → `window.location.href = paymentUrl`; status poll continues after the redirect via a `/add-funds?tx=<id>` deep link
   - **Razorpay** — unchanged
4. New polling effect for FamGateway/OxaPay rows (3.5 s / 5 s respectively — both ≥ the provider's minimum).
5. History rows: map `FAMGATEWAY_UPI → "UPI (Auto)"`, `OXAPAY_CRYPTO → "Crypto"`, `FAMPAY_UPI → "Direct UPI"`.
6. Copy updates: "0% deposit fee" claims must be re-worded for crypto (network fee applies).

### 4.2 Admin bot — `TheFinalBtIsHere/SMMUP_BOT`

| File | Change |
|---|---|
| `src/commands/payments.ts` **(new)** | `/payments` — owner control panel: shows each method's state (enabled/disabled, source, configured?), live counters (pending, settled 24 h, failed), and inline toggle buttons. `/payments toggle famgateway_upi on\|off`. |
| `src/domain/adminActions.ts` | New action type `payment_method_toggle` → writes `payment_method_config.methods.<id>.enabled` + audit row. Must go through the existing confirm-and-execute flow (never mutate on the button press alone). |
| `src/domain/pendingActions.ts` | Register the new action type in the pending-action schema/validator. |
| `src/worker/paymentScanner.ts` | Scope the IMAP scanner to `method: "FAMPAY_UPI"` only. Add `DIRECT_UPI_SCANNER_ENABLED` kill switch. **Never** scan for `FAMGATEWAY_UPI` (FamGateway owns that). |
| `src/worker/runtime.ts` | Add a periodic **crypto/UPI reconciliation sweep**: find `OXAPAY_CRYPTO` / `FAMGATEWAY_UPI` rows pending longer than the provider's grace window and re-check them **through the website's internal endpoint** (D8), so a dropped webhook still settles. |
| `src/commands/operations.ts` | Add `/settlecrypto <track_id> <amount> <tx_hash> \| reason` — owner-confirmed manual credit for the rare `underpaid`/`expired-then-paid` crypto case. |
| `src/db/indexes.ts` | Add `payment_method_config` + `crypto_payment_txs` indexes. |
| `src/ui/adminDashboard.ts` | Surface the new payment-method states + crypto/UPI 24 h stats. |
| `bot.ts` | Register `registerPaymentCommands(bot)` + add to `setMyCommands`. |

> **D8 — the bot never holds a provider API key.** The bot calls `POST https://smmup.co.in/api/internal/reconcile` with a signed request; the website holds the FamGateway/OxaPay keys and performs the provider lookups. Provider credentials therefore live in exactly one place (Vercel) and the bot cannot be used to make payments even if it is compromised. Hardening spec in §5.1.

### 4.2.1 `api/internal/reconcile.ts` — the bot's only door into the payment engine

```ts
// POST /api/internal/reconcile
// Headers:
//   x-internal-timestamp: <unix seconds>
//   x-internal-nonce:    <random hex, 32 chars>
//   x-internal-signature: HMAC-SHA256(secret, `${timestamp}.${nonce}.${body}`).hex
// Body: { action: "reconcile_pending", provider?: "famgateway"|"oxapay", limit?: 1..100 }
```
Server behaviour: verify signature → verify timestamp is within **±300 s** → verify the nonce has not been seen (5-minute TTL collection) → verify `Origin`/`Host` allow-list (no Origin header is fine for a server-to-server call) → execute → always return a generic JSON body (never provider error text) → log the request id.

Returns `{ reconciled: n, settled: n, stillPending: n }` — **no amounts, no UTRs, no provider payloads**, so the endpoint cannot be used as an oracle.

**Fail-closed:** if `INTERNAL_API_SECRET` is missing or shorter than 32 characters, the endpoint returns `503` and does nothing.

### 4.3 Environment variables

**Website (`smm-up-j26l`) — new:**
```
# Payment method toggles (baseline; runtime override lives in MongoDB)
PAYMENT_METHOD_DIRECT_UPI_ENABLED=true
PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED=false
PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED=false
PAYMENT_METHOD_RAZORPAY_ENABLED=false

# FamGateway — the 64-char key from famgateway.in/api-keys.php
FAMGATEWAY_API_KEY=
FAMGATEWAY_MAX_DEPOSIT_INR=100000
FAMGATEWAY_ORDER_LIFETIME_MINUTES=5
FAMGATEWAY_WEBHOOK_URL=https://smmup.co.in/api/famgateway-webhook

# OxaPay — Merchant API Key from app.oxapay.com/dashboard
OXAPAY_MERCHANT_API_KEY=
OXAPAY_MODE=live
OXAPAY_INVOICE_CURRENCY=INR          # switch to USD only if /common/fiats lacks INR
OXAPAY_MAX_DEPOSIT_INR=100000
OXAPAY_INVOICE_LIFETIME_MINUTES=60
OXAPAY_FEE_PAID_BY_PAYER=1
OXAPAY_UNDER_PAID_COVERAGE=2         # percent
OXAPAY_SETTLE_CURRENCY=USDT
OXAPAY_ALLOW_SANDBOX_CREDIT=false    # mirrors RAZORPAY_ALLOW_TEST_WALLET_CREDIT

# Legacy Direct UPI kill switch for the Railway IMAP worker
DIRECT_UPI_SCANNER_ENABLED=true

# Internal bot→website reconciliation channel (if we use it)
INTERNAL_API_SECRET=
```

**Bot (Railway) — new:**
```
# D8: the bot holds NO provider API key. Only the shared internal secret.
INTERNAL_API_SECRET=
# Accepted during a rotation overlap window; remove after the swap.
INTERNAL_API_SECRET_PREVIOUS=
# Kill switch for the legacy IMAP scanner (must be off once FamGateway is live).
DIRECT_UPI_SCANNER_ENABLED=true
```

### 4.4 The FX / denomination decision (must be settled before coding crypto)

The wallet is **INR**. Three viable paths:

| Path | How | Verdict |
|---|---|---|
| **A. INR invoice (preferred)** | `POST /v1/payment/invoice` with `currency: "INR"`, `amount: 250` | **Use this if `GET /v1/common/fiats` includes INR.** OxaPay locks the INR↔crypto rate at invoice creation. We credit exactly ₹250.00. No FX logic in our code at all. |
| **B. USD invoice + locked INR credit** | Invoice in USD at the live rate; store `oxapay_fiat_rate_locked` at creation; credit that locked INR figure | Fallback. We must fetch a rate at invoice time (`/common/fiats` or `/common/prices` + our own USD→INR reference) and freeze it. Crypto moves during the 60 min window do not change the customer's quote. |
| **C. USD invoice, credit at confirmation** | Credit `amount_usd × rate_at_confirmation` | ❌ **Never.** The customer's INR quote would change with the market. Unacceptable for a wallet top-up. |

**Decision: A if INR is supported; otherwise B. C is out.** The very first live action item is to call `GET https://api.oxapay.com/v1/common/fiats` with the merchant key and check.

Underpayment policy for **both** paths: OxaPay's `under_paid_coverage` (we set 2%) defines the tolerated shortfall. Status `paid` ⇒ credit the full locked INR amount. Status `underpaid` ⇒ **do not auto-credit**; raise a review item for the owner with the exact crypto received and the INR shortfall. (§5.4)

---

## 5. Security & money-safety rules

These are non-negotiable and mirror the existing Razorpay rules in `server/lib/wallet.ts`.

1. **Webhook bodies are raw bytes.** `export const config = { api: { bodyParser: false } }` + a manual reader, exactly like `api/razorpay-webhook.ts`. Re-serializing JSON before HMAC invalidates the signature.
2. **Timing-safe signature comparison.** Hex length check → charset check (`/^[a-f0-9]{64}$/i` for SHA-256, `/^[a-f0-9]{128}$/i` for SHA-512) → `crypto.timingSafeEqual`. Never `===`.
3. **Never trust the webhook body for the amount.** Always re-fetch the authoritative state from the provider (`/api/verify-order.php`, `/v1/payment/{track_id}`) and settle from *that*. The webhook is a *trigger*, not a *source of truth*. (Razorpay already does this — `fetchRazorpayPayment(payment.id)`.)
4. **Every credit happens inside one MongoDB transaction** that atomically: flips the transaction row `pending → paid` (with a conditional filter so only one caller wins), increments `users.balance`, inserts the `wallet_ledger` row, and inserts a `security_events` row.
5. **Unique keys prevent double-credit:** `wallet_ledger.settlement_key` (unique partial), `payment_events {provider,event_id}` (unique), `transactions.famgateway_order_id` (unique sparse), `transactions.oxapay_track_id` (unique sparse), `crypto_payment_txs._id` = tx_hash (unique).
6. **Provider keys never reach the browser.** The browser only ever talks to `/api/payments/*` on our own origin. The FamGateway QR is **proxied** through `/api/famgateway/qr` so `img-src` stays `'self'` and no third party sees our users. Crypto redirects to OxaPay's hosted page (no key exposure).
7. **Same-origin enforcement** on all mutating payment routes (`sameOriginIfPresent`, already used in `api/payments/[action].ts` and `api/razorpay/[action].ts`).
8. **Rate limits** mirror existing patterns: `payment_create_*` 8/300 s, `famgateway_create_*` 8/300 s, `oxapay_create_*` 8/300 s, status polls 90/300 s.
9. **`payment_hold` is honoured** on every create/settle path — a held account cannot deposit and cannot be credited.
10. **Payment review flags.** `underpaid`, `refunded`, `refunding`, expired-then-paid, and amount mismatches set `payment_review_required` + `payment_hold`, exactly like Razorpay's dispute handling, and notify the owner on Telegram.
11. **Sandbox cannot fund the production wallet.** `OXAPAY_MODE=sandbox` ⇒ `wallet_credited=false`, status `test_paid`, mirroring `RAZORPAY_ALLOW_TEST_WALLET_CREDIT`.
12. **Owner actions are two-phase.** Every bot mutation goes through `queueAdminAction` → inline confirm → `executeConfirmedAdminAction`, with an audit row.
13. **Env vars are never logged**, including inside error messages. The existing `sanitize.ts` helper should be applied to provider error bodies.

### 5.1 Internal endpoint hardening (D8 — "make sure everything is so much secureeee")

The bot↔website channel is the newest attack surface in this build, so it gets the tightest treatment:

| Control | Implementation |
|---|---|
| **Auth** | `HMAC-SHA256(INTERNAL_API_SECRET, `${timestamp}.${nonce}.${body}`)` over the **raw body**, hex digest. The secret is ≥ 32 random chars, stored only in Vercel + Railway. |
| **Replay protection** | Two independent layers: (a) timestamp window of **±300 s**; (b) the nonce is recorded in an `internal_request_nonces` collection with a **unique index on `nonce`** and a 5-minute TTL — a replayed request hits a duplicate-key error and is rejected. |
| **Timing-safe comparison** | Hex charset + length check → `crypto.timingSafeEqual`. Never `===`. |
| **Body integrity** | The signature covers the raw bytes. The body is parsed **after** verification, from the same buffer that was signed. |
| **Least privilege** | The endpoint accepts a fixed allow-list of `action` values (`reconcile_pending`). Unknown actions → `400`. It cannot create orders, credit wallets, or read user data. |
| **No data leakage** | Responses contain counts only. No amounts, UTRs, emails, provider payloads, or error strings from upstream. |
| **Rate limit** | 20 requests / 60 s per source, plus a hard cap of 100 rows per reconcile call. |
| **Fail closed** | Missing/short `INTERNAL_API_SECRET` → `503`, no work done. |
| **Audit** | Every call writes `security_events { type: "internal_reconcile", request_id, action, reconciled, settled }` — visible to the owner in the Telegram dashboard. |
| **No provider keys in the bot** | The bot physically cannot call FamGateway/OxaPay. A bot compromise yields no ability to move or credit money — only to *ask* the website to re-check a payment that is already pending. |
| **Rotation** | `INTERNAL_API_SECRET` is rotatable; the bot supports an `INTERNAL_API_SECRET_PREVIOUS` value for a zero-downtime overlap window (both accepted, new secret preferred). |

> The reconcile endpoint **cannot create a credit that wasn't already authorised by a provider**. It only asks the website to re-fetch the authoritative provider state and run the *same* settlement function the webhook uses — with the same signature verification, the same idempotency keys, and the same Mongo transaction. There is no "trust the bot" path.

---

## 6. Testing strategy

The repo already has an integration-test convention (`tests/*.integration.ts` run against `mongodb-memory-server` with a replica set, since transactions need one).

| Test file | Covers |
|---|---|
| `tests/paymentMethods.integration.ts` | Toggle resolution: env default, Mongo override, feature-flag override, credential gate, "on but unconfigured ⇒ disabled with reason". |
| `tests/famgateway.integration.ts` | Create-order validation (bad order id, altered amount, non-success body), webhook signature accept/reject, exact-amount matching, replay of the same `order_id` credits once, expired-then-paid handling. |
| `tests/oxapay.integration.ts` | Invoice creation + validation, webhook HMAC accept/reject, `paid` credits the **locked INR** amount, `underpaid` does **not** credit and creates a review item, duplicate `tx_hash` across invoices credits once, `refunded` sets `payment_hold`. |
| `tests/providerSettlement.integration.ts` | Cross-provider double-credit attempts (webhook + browser poll racing), `payment_hold` blocks credit, unique-index races. |

Static gates: `npm run typecheck` and `npm run build` must pass. Then a staging pass on the `preview` target with sandbox/sandbox credentials before production.

---

## 7. Rollout plan

| Phase | Work | Gate |
|---|---|---|
| **0** | Foundations: `paymentMethods.ts`, `db.ts` indexes, `GET /api/payments/methods`, `wallet.ts` refactor (**Razorpay behaviour unchanged**). Toggle infra shipped. | typecheck + build + all existing tests green. Razorpay regression-tested. |
| **1** | FamGateway: client, routes, webhook, settlement, UI card, QR proxy. Toggle **OFF** by default. | Staging order created → webhook received → wallet credited → duplicate webhook credits once. |
| **2** | OxaPay: client, routes, webhook, crypto settlement, UI. Sandbox mode. Toggle **OFF**. | Sandbox invoice → webhook → **test_paid, wallet not credited**. |
| **3** | Bot: `/payments` panel + toggles, scanner scoping, `api/internal/reconcile`, reconciliation sweep, `/settlecrypto`. | Toggle flips from Telegram **without a redeploy**. Replay/nonce/timestamp rejection verified. |
| **4** | Production enable: turn on **FamGateway only**. Keep Direct UPI on for 48 h. | 10 real payments, all auto-credited, **zero** owner `/settleupi` actions. |
| **5** | Turn **off Direct UPI** (toggle only). Keep the code + scanner for rollback. | No new `FAMPAY_UPI` rows created; legacy pending rows still settle. Disabled method is **absent** from the UI (D5). |
| **6** | Turn **on Crypto**. | Sandbox → live with a small `OXAPAY_MAX_DEPOSIT_INR` first (e.g. ₹500), then raise. |
| **7** | Cleanup: delete the stale `SMM-UP/admin-bot/` vendored copy; update `planner.md`, `LATER_ON_UPGRADATIONS.md`, `API_REFERENCE.md`, `README.md`, `SECURITY_DEPLOYMENT_RUNBOOK.md`. | Docs match the shipped behaviour. |

---

## 8. Risks & mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Gmail IMAP contention** with FamGateway (same mailbox as the Railway scanner + website manual verifier) | 🔴 High | Scope the scanner to `FAMPAY_UPI` only; add `DIRECT_UPI_SCANNER_ENABLED`; prefer a **dedicated second mailbox** for FamGateway; verify with Gmail's IMAP dashboard before enabling. |
| R2 | **FamGateway requires a FamPay-linked Gmail / may not support arbitrary bank UPI VPAs** | 🔴 High | Confirm with FamGateway support **before** building. If only FamPay VPAs work, `UPI_VPA` must change to your `@fam` handle — which changes where your Direct UPI money lands. Verify first. |
| R3 | **OxaPay may not support INR invoices** | 🟠 Medium | `GET /v1/common/fiats` check on day one; fallback = USD invoice + locked INR credit (§4.4 path B). |
| R4 | **Crypto price movement** between quote and confirmation | 🟠 Medium | Credit the locked INR amount, never the live crypto value. `under_paid_coverage` handles the tolerance. |
| R5 | **Underpayment** (`underpaid` status) | 🟠 Medium | Never auto-credit. Owner review flow + Telegram alert + `/settlecrypto`. |
| R6 | **Double-credit** from webhook + browser poll racing | 🟠 Medium | Single Mongo transaction + conditional status filter + unique `settlement_key` + unique `tx_hash`. Already proven by the Razorpay path. |
| R7 | **Oxapay's 5 webhook retries** re-delivering different bodies | 🟡 Low | Event id = SHA-256 of raw body → each body is a distinct event, but settlement is still idempotent per `track_id` and per `tx_hash`. |
| R8 | **Env-var toggle needs a redeploy** → can't kill a method during an incident | 🟡 Low | MongoDB runtime override + feature flag give instant kill-switches. |
| R9 | **Adding env vars to `smm-up-j26l` requires a redeploy** anyway (that's how Vercel works) | 🟡 Low | Batch all new env vars into one redeploy. The project is **not** in git-link mode (`"sourceless": true`, `autoAssignCustomDomains: true`), so we can deploy from the CLI/connector too. |
| R10 | **Repo drift** between `SMM-UP/admin-bot/` and `SMMUP_BOT` | 🟡 Low | Delete the vendored copy; treat `SMMUP_BOT` as the only bot source. |
| R11 | **Crypto deposits + refunds** create a tax/ledger question (INR income from crypto) | 🟠 Medium | `wallet_ledger` records source amount + crypto amount + rate + network → a clean audit trail for accounting. Confirm your obligations separately; this is not legal/tax advice. |
| R12 | **Hobby plan limits** — Vercel Hobby caps cron frequency and function duration | 🟡 Low | Crons stay daily; webhooks do the real-time work. New routes get `maxDuration: 30`. |

---

## 9. Open questions — what I still need from you

**Already decided (see §0 D1–D12):** toggle shape, Direct UPI off + hidden, Razorpay toggleable + hidden, crypto fee paid by payer, bot uses the signed internal endpoint, no Vercel Feature Flags.

**Still blocking:**

| # | Question | Why it blocks | How to resolve |
|---|---|---|---|
| Q1 | Does FamGateway accept your current `UPI_VPA`, or only a FamPay `@fam` VPA? | Determines whether your settlement account changes | Ask FamGateway support. If `@fam` only, `UPI_VPA` must change — and that affects the legacy Direct UPI flow too. |
| Q2 | Second dedicated Gmail for FamGateway, or reuse `FAMPAY_EMAIL`? | Decides whether we need IMAP-contention mitigation at all | Your call. Second mailbox = zero contention risk. |
| Q3 | Does `GET /v1/common/fiats` include **INR**? | Chooses D10 path A (INR invoice, no FX code) vs path B (USD invoice + locked INR credit) | I can run it myself the moment you give me the OxaPay key. |
| Q4 | Crypto coins to enable | OxaPay key "accepted currencies" | **Recommend USDT + BTC + ETH** to start. |
| Q5 | Crypto min/max deposit | Network fees make sub-₹100 deposits uneconomic | **Recommend min ₹100, max ₹50,000.** |
| Q6 | Delete the stale `SMM-UP/admin-bot/` vendored copy? | Repo hygiene (D12) | **Recommend yes**, as a separate cleanup commit so it's easy to review/revert. |

---

## 10. What I need from you to start building

| # | Item | Needed for |
|---|---|---|
| 1 | **GitHub PAT** with `repo` scope for `ExamCodesOfficial/SMM-UP` (and `TheFinalBtIsHere/SMMUP_BOT` if we're changing the bot in the same pass) | pushing the commits |
| 2 | **FamGateway API key** (64-char, from `famgateway.in/api-keys.php`) — or add it yourself in Vercel and tell me it's there | Phase 1 |
| 3 | **OxaPay Merchant API Key** (from `app.oxapay.com/dashboard`) — or add it in Vercel yourself | Phase 2 + answering Q3 |
| 4 | Your answers to Q1, Q2, Q4, Q5, Q6 | everything |
| 5 | Confirmation that I should **write the new env vars to Vercel** `smm-up-j26l` (prod + preview) via the connector, or whether you'd rather set them yourself | deployment |
| 6 | In the OxaPay dashboard: turn **on "Fee Paid by Payer"** and set **Underpaid Coverage** on the Merchant API Key (D6/D7) | Phase 2 — though we also send both per invoice, so this is belt-and-braces |

**Webhook registration:** not strictly required — FamGateway accepts a per-order `webhook_url` and OxaPay a per-invoice `callback_url`, so we pass our own URLs in the create call. Registering them in the provider dashboards as well is a good backup, not a prerequisite.

---

## 11. Recommended sequencing

1. **You** → give me the PAT + answers to Q1/Q2/Q4/Q5/Q6.
2. **Me** → build **Phase 0 (foundations)** and **Phase 1 (FamGateway)**, with every toggle shipped **off**. Push to a branch `feature/payment-methods-upgrade` on `SMM-UP`; you review the diff.
3. **Me** → build **Phase 2 (OxaPay crypto)** in sandbox mode, still off.
4. **Me** → build **Phase 3 (bot `/payments` panel + internal endpoint + reconciliation sweep)** in `SMMUP_BOT`.
5. **You** → merge to `master` → Vercel redeploys → you flip **FamGateway on** from Telegram (instant, no redeploy).
6. **After 48 h of clean auto-settlement** → flip **Direct UPI off**. After crypto is proven in sandbox+live-small → flip **crypto on**.

Nothing changes in production until you explicitly enable it. Every step is reversible from the Telegram `/payments` panel.

---

## 12. As-built state (2026-11-09)

Everything below is **written, typechecked and building**. The bot's test suite
passes; the website's new integration suite passes.

### 12.1 Website — `SMM-UP`

**New server modules**
- `server/lib/paymentMethods.ts` — the registry. Three-layer resolution for
  **every** knob (Mongo override → Vercel env → built-in default), a hard
  credential gate, `getEnabledPaymentMethods` (drives the "hidden when off"
  rule), `setPaymentMethodEnabled`, `setPaymentMethodSettings`.
- `server/lib/famgateway.ts` — order creation, authoritative order fetch,
  HMAC-SHA256 webhook verification, order-id validation, **VPA guard**.
- `server/lib/oxapay.ts` — invoice creation, payment fetch, `common/fiats`,
  HMAC-SHA512 webhook verification, status normalisation, `payment_url` host
  pinning.
- `server/lib/cryptoSettlement.ts` — INR-denominated crypto settlement, per
  `tx_hash` idempotency, `underpaid` → review (never auto-credit),
  **replayed-hash detection across invoices**.
- `server/lib/paymentReconciliation.ts` — the shared re-check used by the
  cron, the bot's internal channel and the browser's manual "check now".

**Rewritten**
- `server/lib/wallet.ts` — one atomic `settleProviderDeposit()` core.
  `settleRazorpayDeposit` delegates to it (behaviour unchanged);
  `settleFamGatewayDeposit` is new. A **cancelled** request is still
  settleable — real money is never dropped.

**New API routes**
| Route | Purpose |
|---|---|
| `GET /api/payments/methods` | The enabled + configured methods. The single source of truth for the UI. |
| `POST /api/payments/cancel` | "Wrong amount?" → cancel, then create a fresh one. |
| `/api/famgateway/[action]` | `config`, `create-order`, `status`, `verify`. |
| `/api/famgateway-webhook` | Raw-body signature → authoritative re-fetch → inline settle → always 200 after a valid signature. |
| `/api/oxapay/[action]` | `config`, `fiats`, `create-invoice`, `status`, `verify`. |
| `/api/oxapay-webhook` | Raw-body HMAC-SHA512 → authoritative re-fetch → settle; `underpaid`/`refunding` → review. |
| `POST /api/internal/reconcile` | The bot's only door in. Signed, nonce-protected, action allow-list, counts-only responses. |
| `GET /api/cron/payment-reconcile` | The 30-minute safety net. |

**Frontend — `src/components/AddFundsPage.tsx` was rewritten**
- **Step 1 Method → Step 2 Amount → Step 3 Pay.** Nothing scattered.
- Each method carries its own currency, range, presets and fee disclosure.
- The QR is rendered in-browser from the provider's `upi_intent` — no proxy
  route, no provider key in the browser.
- The pending payment is **restored after a refresh**; the QR is regenerated
  from the stored intent.
- Red "**do not go back**" banner, live expiry countdown, `beforeunload` guard.
- "**Wrong amount?**" → cancel → confirm → new request.
- "**I have paid — check now**" on both the UPI and crypto screens.
- The crypto return URL (`?paid=1&tx=…`) resumes the check even if
  localStorage was cleared.
- Crypto shows both the dollar amount and the exact INR credit.

### 12.2 Admin bot — `SMMUP_BOT` (`gasprop/SMMUP_BOT`)

- `src/domain/internalApi.ts` — the signed client. The bot holds **no**
  provider key and can only ask the website to re-check a payment.
- `src/domain/paymentMethods.ts` — reads and writes the runtime override.
- `src/commands/payments.ts` — the `/payments` panel: live on/off state,
  instant toggles (two-phase confirm), and live limit/rate/fee editing.
- `src/worker/paymentScanner.ts` — scoped to `method: "FAMPAY_UPI"` only, with
  the `DIRECT_UPI_SCANNER_ENABLED` kill switch (defaults to **off**).
- `src/worker/paymentRuntime.ts` — the provider reconciliation sweep
  (default every 5 minutes) plus `/reconcile`.
- `src/db/indexes.ts` — the provider-reference indexes, named identically to
  the website's so the two repos cannot collide on MongoDB.

### 12.3 Vercel environment — `smm-up-j26l`

Set (Production + Preview):

```
PAYMENT_METHOD_DIRECT_UPI_ENABLED=false
PAYMENT_METHOD_RAZORPAY_ENABLED=false
PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED=true
PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED=true
OXAPAY_INVOICE_CURRENCY=USD
OXAPAY_USD_TO_INR_RATE=98
OXAPAY_MIN_DEPOSIT_USD=1
OXAPAY_MAX_DEPOSIT_USD=500
CRON_SECRET=<generated>
INTERNAL_API_SECRET=<generated>
RATE_LIMIT_HASH_SECRET=<generated>
SESSION_METADATA_HASH_SECRET=<generated>
API_ACTIVITY_HASH_SECRET=<generated>
```

**Still needed before either new rail appears to customers:**
`FAMGATEWAY_API_KEY`, `FAMGATEWAY_UPI_VPA=aryanok@fam`,
`OXAPAY_MERCHANT_API_KEY`. The credential gate keeps both rails hidden until
those exist — a method without working credentials must never be shown.

### 12.4 Live verification (2026-11-09, after the provider keys landed)

Both keys were validated against the provider APIs before the deploy:

| Check | Result |
|---|---|
| OxaPay `GET /v1/common/fiats` | 200 — **INR and USD both invoiceable** on this merchant account |
| OxaPay sandbox $1 invoice | `track_id` issued, `payment_url` on `pay.oxapay.com` over https |
| FamGateway `GET /api/verify-order.php` | `not_found` for a bogus id (auth passed); a wrong key returns `unauthorized` |
| FamGateway real ₹10 order | `fg_QMG3SG7M` — `upi_id = aryanok@fam` ✅, `payable_amount = 10` ✅ (exact, no fee), `upi_intent` and `checkout_url` present |

Live method state reported by the signed internal channel:

| Method | State | Range |
|---|---|---|
| UPI Automatic (FamGateway) | **LIVE** | INR 10 – 100,000 |
| Crypto (OxaPay) | **LIVE** | USD 1 – 500, rate 98, fee payer = customer |
| Direct UPI | OFF (toggle) | — |
| Razorpay | OFF + no credentials | — |

Because **INR is invoiceable**, `OXAPAY_INVOICE_CURRENCY=INR` would remove the FX
step entirely. USD stays the default so the $1 – $500 quote the owner asked
for is what the customer sees.

### 12.5 Crons

```
/api/cron/status-sync        0 4 * * *
/api/cron/payment-reconcile   0 5 * * *
```
