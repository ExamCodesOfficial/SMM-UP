# OxaPay merchant setup — exact values to paste

Everything below goes into **OxaPay → Dashboard → Merchant / Store settings**.
Fill it in once; nothing here needs changing when the limits or the rate move,
because those live on our side.

---

## 1. The seven dashboard fields

| Field | Exact value |
|---|---|
| **CALLBACK URL** | `https://smmup.co.in/api/oxapay/webhook` |
| **DESCRIPTION** | `SMM UP wallet top-up` |
| **THANKS MESSAGE** | `Payment received. Your SMM UP wallet has been credited automatically — you can close this page.` |
| **RETURN URL** | `https://smmup.co.in/add-funds?paid=1` |
| **LOGO URL FOR LIGHT MODE** | `https://smmup.co.in/logo-512x512.png` |
| **LOGO URL FOR DARK MODE** | `https://smmup.co.in/logo-512x512.png` |
| **DEFAULT THEME MODE** | `Dark` |

### Notes on each field

- **CALLBACK URL** — the single place OxaPay tells us a payment landed. It is
  the only URL that carries money-bearing information, so it must be exactly
  this and nothing else. Requests to it are authenticated with an
  HMAC-SHA512 signature over the raw request body; a request without a valid
  signature is rejected and never credited.
- **RETURN URL** — where the customer is sent after paying. We add
  `&tx=<transaction-id>` to it automatically per invoice, so the customer
  lands back on their own deposit and sees the confirmation.
- **DESCRIPTION / THANKS MESSAGE** — shown on OxaPay's hosted checkout. Keep
  them short; the customer is one step from leaving our site.
- **LOGO URLs** — `logo-512x512.png` is a light-background logo, so it reads
  correctly on both themes. Use `pwa-512x512.png` instead if the dashboard
  rejects it.
- **DEFAULT THEME MODE** — `Dark` matches the site. The customer's coin
  selection screen should feel like the same product.

---

## 2. Merchant API Key — the one thing that is NOT in the dashboard fields

Generate the key in OxaPay under **Merchant → API Keys**, then put it in
Vercel as `OXAPAY_MERCHANT_API_KEY` (Production + Preview).

We send it in the `merchant_api_key` header on every API call. It never
reaches the browser.

---

## 3. Two Advanced Options that MUST be switched on

These live in **Merchant → API Key → Advanced Options** (not in the field list
above), and they are what make the crypto rail behave correctly:

| Option | Value | Why |
|---|---|---|
| **Fee Paid by Payer** | `ON` | The customer pays the crypto network fee. Our wallet is credited the full amount they quoted, so we never eat the fee. |
| **Underpaid Coverage** | `2` | If the customer underpays by a tiny amount, OxaPay still completes the invoice instead of rejecting it. |

We also send `fee_paid_by_payer: 1` and `under_paid_coverage: 2` on every
invoice, so these settings are enforced per-invoice even if the dashboard
defaults are later changed.

**Under-paid is never auto-credited.** If an invoice comes back `underpaid`,
the customer is not credited automatically — the account is placed on hold and
the owner reviews it by hand.

---

## 4. Supported coins and fiat

- The customer's coin list is whatever OxaPay has enabled for the merchant
  account. `GET /v1/common/fiats` tells us which fiat currencies we may
  invoice in — run `GET /api/oxapay/fiats` on the site to see the live list.
- We invoice in **USD** by default (`OXAPAY_INVOICE_CURRENCY=USD`), with the
  customer picking **$1 – $500**, and the wallet credited the INR equivalent
  at the rate locked when the invoice was created.
- The rate is `OXAPAY_USD_TO_INR_RATE`, currently **98** (1 USD = ₹98). It is
  adjustable live from the owner Telegram bot (`/payments` → Crypto → Limits)
  with no redeploy and no code change.
- If the merchant account turns out to support **INR** invoices, set
  `OXAPAY_INVOICE_CURRENCY=INR` and there is no currency conversion at all —
  the customer pays ₹X worth of crypto and the wallet is credited exactly ₹X.

---

## 5. After you fill this in

1. Add `OXAPAY_MERCHANT_API_KEY` to Vercel (Production + Preview).
2. Redeploy the site (Vercel applies new environment variables on the next
   deployment).
3. The Crypto method appears on `/add-funds` automatically — the toggle is
   already `PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED=true`.

Until the API key exists, the method stays hidden by design: a method without
working credentials must never be shown to a customer.
