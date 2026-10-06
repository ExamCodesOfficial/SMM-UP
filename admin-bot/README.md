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

| Command | Description |
| :--- | :--- |
| `/stats` | View live platform metrics: registered users, balances, order count, revenue |
| `/user <email>` | Inspect a full user profile and open inline active-session, revoke-all and Support Access controls |
| `/resetpassword <email> <auto-or-custom> \| <reason>` | Create a five-minute confirmed, hash-only temporary credential and revoke sessions |
| `/supportaccess <email> \| <reason>` | Issue an 80-bit hash-only code: five-minute one-time exchange, then 15-minute read-only website access |
| `/credit <email> <amount> [reason]` | Atomically credit a user's wallet balance with an audit log |
| `/debit <email> <amount> [reason]` | Atomically debit balance (safeguarded against negative balances) |
| `/failed` | View failed orders requiring manual administrative review |
| `/refund <orderId> [reason]` | Manually refund debited order funds directly to user's wallet |
| `/pending` | List the last 10 pending deposits awaiting settlement |
| `/orders [limit]` | View recent provider orders and their live execution status |
| `/checkmemo <memo>` | Inspect the database record of any specific payment memo |
| `/scan` | Trigger an immediate manual IMAP scan across Gmail inbox |
| `/reviews [limit]` | List buyer-submitted reviews with owner-only inline **Hide / Show** controls |

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
