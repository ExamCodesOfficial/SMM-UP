# 🤖 SMM UP — Sovereign Admin Bot & Auto-Settlement Node

A dedicated Telegram administrative bot and 24/7 background payment settlement worker for **SMM UP**, designed to run persistently on **Railway** (or any VPS/Docker container).

---

## 🛡️ Zero-Web-Surface Architecture

- **No Web Admin:** Web admin endpoints (`/admin`, `api/admin/*`) have been permanently deleted from the website.
- **Pure MTProto Authentication:** Only commands from your unique numeric Telegram User ID (`TELEGRAM_OWNER_ID`) are accepted. All other interactions are rejected.
- **Atomic MongoDB Operations:** Balance adjustments, debits, and credits are executed using atomic `$inc` operations with strict filters.
- **Decoupled IMAP Settlement:** Maintains a single persistent/periodic IMAP connection on Railway to match incoming FamPay payment emails against pending deposit memos. Vercel web functions **never** connect to Gmail repeatedly.

---

## ⚡ Bot Commands

| Command | Description |
| :--- | :--- |
| `/stats` | View live platform metrics: registered users, balances, order count, revenue |
| `/user <email>` | Inspect any user's profile, balance, spent, and registered date |
| `/credit <email> <amount> [reason]` | Atomically credit a user's wallet balance with an audit log |
| `/debit <email> <amount> [reason]` | Atomically debit balance (safeguarded against negative balances) |
| `/pending` | List the last 10 pending deposits awaiting settlement |
| `/orders [limit]` | View recent provider orders and their live execution status |
| `/checkmemo <memo>` | Inspect the database record of any specific payment memo |
| `/scan` | Trigger an immediate manual IMAP scan across Gmail inbox |

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
MONGODB_DB_NAME="smm_up"
IMAP_USER="your_email@gmail.com"
IMAP_PASSWORD="your_gmail_app_password"
FAMPAY_SENDER_FILTER="no-reply@famapp.in"
ENABLE_IMAP_WORKER="true"
```

3. **Deploy:**
   - Railway will run `npm install` and `npm start` automatically.
   - You'll see: `🚀 SMM UP Sovereign Admin Bot launched successfully via Telegram MTProto.`

---

## 🧪 Local Testing

```bash
cd admin-bot
npm install
# Set your .env variables
npm start
```
