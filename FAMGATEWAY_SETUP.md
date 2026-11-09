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

## 2. What FamGateway needs from you — DO THIS FIRST

> **Without this, no payment will ever be detected.** FamGateway finds the
> money by reading the bank credit alert out of **your Gmail inbox**. If the
> Gmail link is missing or IMAP is switched off, the provider never sees the
> payment: the order stays `pending` forever, no webhook fires, and no code
> on our side can fix it. This is the single most common reason a UPI
> Automatic payment does not credit.

Do all three, in this order:

**Step 1 — turn IMAP on in Gmail (the one people miss).**
Open Gmail on a desktop → ⚙ Settings → *See all settings* → **Forwarding and
POP/IMAP** → tick **Enable IMAP** → **Save Changes**.
Direct link: `https://mail.google.com/mail/u/0/#settings/fwdandpop`
Google rejects IMAP logins when this is off, even with a perfectly valid
app password.

**Step 2 — make a 16-character App Password.**
Google Account → Security → 2-Step Verification → **App passwords** → make one
named "FamGateway". Copy it without the spaces.

**Step 3 — connect the Gmail to FamGateway.**
`https://famgateway.in/integrations.php` → *Connect FamPay Gmail* →
- Gmail address: the one that receives the `aryanok@fam` credit alerts
- App Password: the 16 characters from Step 2 (no spaces)
- FamPay UPI ID: `aryanok@fam`

→ **Save Settings**. FamGateway verifies the connection and activates the API
key immediately. If it does not verify, the order will never be confirmed.

**Step 4 — add a fallback webhook (recommended).**
`https://famgateway.in/webhooks.php` → add
`https://smmup.co.in/api/famgateway/webhook`.
We also send a per-order webhook URL on every order, so this is a belt-and-braces
second delivery route, not a replacement.

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

Default **10 minutes** (`FAMGATEWAY_ORDER_LIFETIME_MINUTES`, adjustable 5–30
and live-editable from the bot). The customer sees a live countdown on the
payment screen, and a "wrong amount? cancel this request" link.

Ten minutes, not five, because the provider itself keeps the order open for
ten minutes and a UPI payment is not instant — the customer has to open an
app, pick the bank and type a UPI PIN. Five minutes expired the QR while
they were still typing.

If a customer's webhook is ever lost, the reconciliation sweep (the bot,
every 5 minutes, plus a Vercel cron every 30 minutes) re-checks the order
against FamGateway and settles it through exactly the same code path. The
customer's own open page also polls the provider directly every few seconds,
so a payment is normally credited within a couple of seconds of the bank
confirming it.

---

## 5. After you fill this in

1. Add `FAMGATEWAY_API_KEY` to Vercel (Production + Preview).
2. Add `FAMGATEWAY_UPI_VPA=aryanok@fam` — we use it as a guard: if FamGateway
   ever returns an order for a different UPI ID, the request is refused
   instead of crediting the wrong account.
3. Redeploy the site.
4. The UPI Automatic method appears on `/add-funds` automatically — the toggle
   is already `PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED=true`.
