# 🤖 SMM UP — Sovereign Admin Bot & Auto-Settlement Node

A dedicated Telegram administrative bot and 24/7 background payment settlement worker for **SMM UP**, designed to run persistently on **Railway** (or any VPS/Docker container).

---

## 🛡️ Zero-Web-Surface Architecture

- **No Web Admin:** Web admin endpoints (`/admin`, `api/admin/*`) have been permanently deleted from the website.
- **Owner-only Telegram Bot API authentication:** The bot uses long polling and accepts commands only from your numeric `TELEGRAM_OWNER_ID`. It is not an MTProto user client.
- **Atomic MongoDB Operations:** Balance adjustments, debits, credits, password recovery and Support Access exchange use guarded atomic operations or replica-set transactions.
- **Revocable support:** Raw login/support tokens are never shown. Telegram exposes inline session inspection/revocation and only the one-time Support Access code, which is hidden when used, replaced or expired.
- **Decoupled IMAP Settlement:** Maintains a single persistent/periodic IMAP connection on Railway to match incoming FamPay payment emails against pending deposit memos. Vercel web functions **never** connect to Gmail repeatedly.

---

## ⚡ Bot Commands

The inline main menu is the preferred entry point. Sensitive mutations rebuild current state at confirmation time and require an actor-bound, one-time confirmation that expires after five minutes.

| Command | Description |
| :--- | :--- |
| `/stats` | View live platform metrics and worker health |
| `/user <email>` | Inspect full user/account state and open inline security controls |
| `/userorders <email> [limit]` | Inspect a user’s recent orders and targets |
| `/deposits <email> [limit]` | Inspect Direct UPI/Razorpay deposit records |
| `/wallet <email> [limit]` | Inspect wallet-ledger records |
| `/events <email> [limit]` | Inspect bounded security events |
| `/note <email> \| <reason>` | Add an owner-only administrative note |
| `/credit <email> <amount> \| <reason>` | Queue a transactional wallet credit |
| `/debit <email> <amount> \| <reason>` | Queue a transactional, non-negative wallet debit |
| `/refund <orderId> \| <reason>` | Queue an idempotent full order refund |
| `/lock`, `/unlock`, `/orderinghold`, `/orderingrelease` | Queue account/order controls with a mandatory reason |
| `/paymenthold`, `/paymentrelease` | Queue deposit controls with a mandatory reason |
| `/apikeys <email>` | Inspect key metadata; pause/resume/archive/reissue without revealing secrets |
| `/resetpassword <email> <auto-or-custom> \| <reason>` | Queue a five-minute protected temporary-credential reset and revoke sessions |
| `/supportaccess <email> \| <reason>` | Issue a hash-only five-minute Support Access exchange code |
| `/sessions <email>` | Inspect/revoke revocable website sessions |
| `/orders [limit]`, `/failed`, `/pending`, `/checkmemo <memo>` | Inspect platform operations |
| `/scan` | Trigger an owner-requested IMAP scan (the normal worker remains lease-protected) |
| `/reviews [limit]` | Moderate purchase-verified reviews with inline Hide/Show controls |

---

## 🚀 1-Click Railway Deployment

1. **Create New Project on Railway:**
   - Go to [railway.app](https://railway.app)
   - Click **New Project** → **Deploy from GitHub repo**
   - Select your `SMM-UP` repository
   - Set **Root Directory** in Railway Settings to: `/admin-bot`

2. **Add Environment Variables in Railway:**

```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_OWNER_ID="your_numeric_telegram_user_id"
ADMIN_BOT_STATE_SECRET="at_least_32_random_characters"
MONGODB_URI="your_mongodb_connection_string"
MONGODB_DB_NAME="smm_up_db"  # must match the website's DATABASE_NAME
IMAP_USER="your_email@gmail.com"
IMAP_PASSWORD="your_gmail_app_password"
FAMPAY_SENDER_FILTER="no-reply@famapp.in"
ENABLE_IMAP_WORKER="true"
TEMP_PASSWORD_TTL_MINUTES="180"
TEMP_PASSWORD_MAX_USES="2"
```

3. **Deploy:**
   - Railway will run `npm install` and `npm start` automatically.
   - You'll see: `🚀 SMM UP Sovereign Admin Bot launched successfully via Telegram Bot API long polling.`

---

## 🧪 Local Testing

```bash
cd admin-bot
npm install
# Set your .env variables
npm start
```
