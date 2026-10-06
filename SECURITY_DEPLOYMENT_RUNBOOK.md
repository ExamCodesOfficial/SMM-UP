# Security Deployment Runbook

This runbook is an operational gate. It contains variable names and checks only—never place real credentials in this repository.

## Required Vercel production and preview configuration

Set separate preview/staging values where the provider supports environment scoping.

- `MONGODB_URI` — replica-set/Atlas connection; staging must use a separate database.
- `DATABASE_NAME`
- `JWT_SECRET` — high-entropy secret.
- `SESSION_METADATA_HASH_SECRET` — high-entropy metadata HMAC secret.
- `RATE_LIMIT_HASH_SECRET` — high-entropy limiter-key HMAC secret.
- `CRON_SECRET` — at least 32 random characters; also configure it for the Vercel cron authorization header.
- `PUBLIC_SITE_URL` — `https://smmup.co.in` in production and the controlled staging origin in staging.
- `RESEND_API_KEY`
- `EMAIL_FROM` — a sender on a Resend-verified domain.
- `DIRECT_UPI_PENDING_TTL_MINUTES` — optional; defaults to 30 and is bounded to 5–180.
- `DIRECT_UPI_MAX_AMOUNT_INR` — optional; defaults to 100000 and is server-bounded.
- Existing supplier, Direct UPI, Razorpay, Telegram-alert and API-key secrets remain required as documented by their deployment owners.

Do not set `PUBLIC_SITE_URL` to an HTTP origin in production. Do not put any secret in a `VITE_` variable.

## Required Railway configuration

Use the website’s database and the variables in `admin-bot/README.md`. In particular:

- Set a high-entropy `ADMIN_BOT_STATE_SECRET` so five-minute owner-selected temporary-password action state survives restarts while remaining AES-GCM protected.
- Keep `ENABLE_IMAP_WORKER=true` on exactly the intended worker service. The MongoDB lease protects overlapping replicas, but duplicate deployments should not be intentional.
- Keep the bot on Telegram Bot API long polling. Do not configure a webhook for the same bot token.

## Staging gate

1. Deploy Vercel preview/staging against a separate staging database.
2. Deploy a separate Railway staging bot token and staging owner ID against that same staging database.
3. Confirm startup fails closed when any critical MongoDB index cannot be created.
4. Confirm `/api/cron/status-sync` returns 401 for a bad bearer token and 503 when server configuration is absent; then confirm the configured cron succeeds.
5. Confirm public `GET /api/services/list` works, while refresh requires an authenticated normal owner session and POST.
6. Create an account, receive the verification email, use the link once, and confirm replay fails.
7. Request password recovery, reset once, and confirm old sessions and token replay fail.
8. Request an email change, verify the new address, and confirm all previous sessions are revoked.
9. Create a Direct UPI pending deposit and verify that a different/expired transaction, wrong user, wrong amount, wrong memo and concurrent duplicate cannot credit a wallet.
10. Exercise Telegram credit/debit/refund/hold/API-key buttons; wait beyond five minutes on one action and confirm its stale button cannot mutate state.
11. Run at least two Railway staging replicas briefly and confirm one active `imap_settlement` lease, healthy heartbeats and exactly-once ledger settlement.
12. Confirm no API secret, password/hash, session token/cookie, authorization header, OTP, CVV, UPI PIN or banking password appears in Telegram, logs, API responses or MongoDB action/audit records.

## Production domain and search gate

1. In Vercel, attach both `smmup.co.in` and `www.smmup.co.in` and make the apex the primary production domain.
2. Confirm `https://www.smmup.co.in/<path>` permanently redirects to `https://smmup.co.in/<path>` while preserving the path.
3. Confirm apex canonical, Open Graph, JSON-LD, sitemap and robots URLs all agree.
4. Confirm `/favicon.ico`, `/favicon-48x48.png`, `/apple-touch-icon.png`, `/logo-512x512.png`, `/robots.txt` and `/sitemap.xml` return their intended content types—not SPA HTML.
5. Verify both host variants in Google Search Console as appropriate, submit the apex sitemap, inspect `https://smmup.co.in/`, and request homepage indexing after deployment.

## Final repository and production gate

Run sequentially on a clean dependency install:

```bash
npm ci
npm run typecheck
npm run build
npm run test:api-keys
npm run test:recovery
npm run test:support-access
npm run test:rate-limit
npm run test:direct-upi
npm run test:email-delivery
npm run test:email-auth
npm run test:core-indexes
npm run test:search-appearance
npm audit --omit=dev

cd admin-bot
npm ci
npx tsc --noEmit
npm run test:admin-actions
npm audit --omit=dev
```

Also run `git diff --check`, scan tracked files and history for credential patterns, and inspect the final diff before committing.

A production push requires a separate explicit authorization. Use only a freshly created minimum-scope GitHub credential for that one authorized push, never save it to a file or remote URL, and revoke it immediately afterward. Then perform production registration/login/email/Direct-UPI-safe smoke checks without making an uncontrolled real payment.
