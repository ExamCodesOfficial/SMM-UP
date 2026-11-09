# FamGateway merchant setup — exact values to paste

Fill this in at **https://famgateway.in** (Merchant / API Keys / Settings).
Everything here is one-time; the limits and order lifetime live on our side
and are adjustable live from the owner Telegram bot.

---

## 1. What to put where

| Setting | Value |
|---|---|
| **API key** | Generated at `https://famgateway.in/api-keys.php` → put it in Vercel as `FAMGATEWAY_API_KEY` |
| **Connected UPI VPA** | `aryanok@fam` (must already be linked to your FamPay account) |
| **Merchant display name** | `SMM UP` |
| **Webhook URL** | Leave blank — we send a per-order webhook URL on every order, which carries our transaction id |

The API key is sent as the `X-Api-Key` header on every call. It never appears
in a URL and never reaches the browser.

---

## 2. What FamGateway needs from you

FamGateway watches **your connected Gmail** for the bank credit alert and
extracts the NPCI UTR, then calls our webhook. So the merchant side needs:

1. A Gmail account that receives the UPI credit alerts for `aryanok@fam`.
2. That Gmail account connected to FamGateway (IMAP enabled).
3. A Gmail **App Password** — 16 characters, generated in
   Google Account → Security → 2-Step Verification → App passwords.
   FamGateway asks for the Gmail address and that app password.

We keep the same Gmail details on our side so the website can independently
verify receipts (`FAMPAY_EMAIL`, `FAMPAY_APP_PASSWORD`, `FAMPAY_SENDER_FILTER`).

---

## 3. How a UPI Automatic payment actually works

1. The customer picks **UPI Automatic** on `/add-funds` and an amount.
2. We ask FamGateway to create an order and immediately send back the
   `upi_intent`.
3. We render the QR **in the customer's browser** from that intent. The
   provider key is never exposed, and no QR proxy route exists.
4. The customer scans the QR (or opens the hosted checkout page, or uses the
   UPI-app deep link) and pays exactly the quoted amount.
5. FamGateway sees the bank credit in your Gmail, extracts the UTR, and calls
   `https://smmup.co.in/api/famgateway/webhook?tx=<transaction-id>` with an
   HMAC-SHA256 signature.
6. We re-fetch the authoritative order from FamGateway, confirm the amount,
   and credit the wallet inside one MongoDB transaction.

**The amount is exact.** FamGateway charges `payable_amount` equal to the
amount we asked for, so there is no unique-paise trick and no note to strip.
The customer pays exactly ₹500 and receives exactly ₹500.

---

## 4. Order lifetime

Default **5 minutes** (`FAMGATEWAY_ORDER_LIFETIME_MINUTES`, adjustable 5–30
and live-editable from the bot). The customer sees a live countdown on the
payment screen, and a "wrong amount? cancel this request" link.

If a customer's webhook is ever lost, the reconciliation sweep (the bot,
every 5 minutes, plus a Vercel cron every 30 minutes) re-checks the order
against FamGateway and settles it through exactly the same code path.

---

## 5. After you fill this in

1. Add `FAMGATEWAY_API_KEY` to Vercel (Production + Preview).
2. Add `FAMGATEWAY_UPI_VPA=aryanok@fam` — we use it as a guard: if FamGateway
   ever returns an order for a different UPI ID, the request is refused
   instead of crediting the wrong account.
3. Redeploy the site.
4. The UPI Automatic method appears on `/add-funds` automatically — the toggle
   is already `PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED=true`.
