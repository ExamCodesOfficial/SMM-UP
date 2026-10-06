# SMM UP Security, Deployment, Rollback and Incident Runbook

> **Code checkpoint:** `2c60e657c5759f7a22cf9fbb872e1d1e051e7201`
> **Last documentation review:** 2026-10-06
> **Production state:** not verified by this document
> **Rule:** environment names and procedures belong here; credential values never do.

---

## 1. Release-state vocabulary

Use these labels exactly in release communication:

| State | Evidence |
|---|---|
| Implemented | Source contains the behavior |
| Locally validated | Named clean-install/test/build checks passed |
| Pushed | A specific commit is visible on the intended GitHub branch |
| Staging verified | Deployment/provider tests passed in isolated staging |
| Production deployed | Intended source commit is serving in production |
| Production validated | Controlled smoke checks and provider evidence passed |
| Search observed | Search Console/crawler results have actually updated |

Never claim a later state based on evidence from an earlier one.

---

## 2. Roles and separation

One person may currently perform several roles, but record which role they are acting as.

| Role | Responsibility |
|---|---|
| Release owner | scope, source commit, authorization, go/no-go and rollback |
| Security reviewer | credential hygiene, authentication, authorization and abuse controls |
| Database owner | backups, indexes, migrations, transactions and restore evidence |
| Payment owner | Direct UPI/Razorpay configuration and settlement reconciliation |
| Bot/worker owner | Railway, Telegram long polling, IMAP worker and owner alerts |
| Domain/email owner | Vercel domains, DNS, Resend and Search Console |
| Incident commander | timeline, containment, recovery and final incident status |

A release record should include source commit, target environments, reviewers, start/end time, test evidence, exceptions and rollback decision. It must not contain credentials.

---

## 3. Environment isolation

### Required boundaries

- Preview/staging and production use separate databases.
- Staging uses separate Razorpay Test credentials.
- Staging uses a separate Telegram bot token and staging owner ID.
- Staging email should use a controlled sender/audience.
- Do not point an untrusted pull-request preview at production MongoDB.
- Production secrets exist only in provider secret stores, not repository files.
- No secret uses the `VITE_` prefix; browser bundles expose all such variables.
- Keep Live payment credentials out of preview environments.
- Keep test wallet-credit override disabled against any production dataset.

### Data policy for staging

Prefer synthetic accounts, deposits and orders. If production-shaped records are required, remove or tokenize personal data and never copy raw authentication/session/API-key hashes, email tokens or financial credentials into a lower-trust environment.

---

## 4. Vercel environment catalog

### Core and cryptographic

| Variable | Requirement |
|---|---|
| `MONGODB_URI` | Atlas/replica-set URI; transactions required; separate staging DB |
| `DATABASE_NAME` | Explicit website database name |
| `JWT_SECRET` | High entropy; retained for intended token/cutover behavior |
| `SESSION_METADATA_HASH_SECRET` | High-entropy HMAC secret for safe metadata |
| `RATE_LIMIT_HASH_SECRET` | High-entropy HMAC secret for limiter keys |
| `API_ACTIVITY_HASH_SECRET` | High-entropy telemetry target hash secret when activity hashing is enabled |
| `CRON_SECRET` | At least 32 random characters; Vercel cron bearer value |
| `PUBLIC_SITE_URL` | `https://smmup.co.in` in production; controlled HTTPS staging origin in staging |

`SITE_URL` exists as a compatibility fallback in source; configure and document one canonical HTTPS origin through `PUBLIC_SITE_URL` for new deployments.

### Supplier/pricing

| Variable | Requirement |
|---|---|
| `PANEL_URL` | Server-only supplier API endpoint |
| `PANEL_KEY` | Server-only supplier credential |
| `TIER1_MARKUP`, `TIER2_MARKUP` | Private server-side pricing configuration; values must never be documented or exposed |

### Email and authentication

| Variable | Requirement |
|---|---|
| `RESEND_API_KEY` | Server-only Resend key |
| `EMAIL_FROM` | Sender on a verified Resend domain |
| `EMAIL_TOKEN_TTL_MINUTES` | Optional bounded email-link lifetime |
| `TEMP_PASSWORD_TTL_MINUTES` | Optional; default 180 minutes, server bounded |
| `TEMP_PASSWORD_MAX_USES` | Optional; only 1 or 2, default 2 |
| `TEMP_PASSWORD_SESSION_TTL_MINUTES` | Optional restricted-session lifetime |

### API-key product

| Variable | Requirement |
|---|---|
| `API_KEY_CREATION_FEE_INR` | Optional; defaults to ₹29; use a reviewed non-negative value |
| `API_KEY_MAX_IDENTITIES` | Optional bounded per-user identity count |

### Direct UPI / receipt verification

| Variable | Requirement |
|---|---|
| `UPI_VPA` | Merchant VPA displayed in server responses |
| `UPI_MERCHANT_NAME` | Merchant display name |
| `DIRECT_UPI_PENDING_TTL_MINUTES` | Optional; defaults to 30, bounded 5–180 |
| `DIRECT_UPI_MAX_AMOUNT_INR` | Optional; defaults to ₹100,000 and is server bounded |
| `FAMPAY_EMAIL` | Mailbox identity when website-side receipt verification is used |
| `FAMPAY_APP_PASSWORD` | App password; never normal mailbox password |
| `FAMPAY_SENDER_FILTER` | Expected receipt sender filter |

### Razorpay

| Variable | Requirement |
|---|---|
| `RAZORPAY_KEY_ID` | Matching Test or Live key ID |
| `RAZORPAY_KEY_SECRET` | Server-only matching secret |
| `RAZORPAY_WEBHOOK_SECRET` | Separate high-entropy endpoint secret |
| `RAZORPAY_MODE` | `test` or `live`, matching key prefix |
| `RAZORPAY_ALLOW_TEST_WALLET_CREDIT` | `false` in production; true only in isolated staging |
| `RAZORPAY_MAX_DEPOSIT_INR` | Optional; reviewed maximum |

See [`RAZORPAY_SETUP.md`](RAZORPAY_SETUP.md).

### Telegram notifications

| Variable | Requirement |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token used by website-side owner alerts, if configured |
| `TELEGRAM_ADMIN_CHAT_ID` | Intended notification destination |

If the website and Railway bot share a bot token, understand the operational coupling. Only the Railway bot performs long polling; website APIs send outbound messages only.

---

## 5. Railway environment catalog

| Variable | Requirement |
|---|---|
| `MONGODB_URI` | Same environment database as the matching website deployment |
| `DATABASE_NAME` / `MONGODB_DB_NAME` | Bot accepts its documented database-name configuration; set one reviewed matching name |
| `TELEGRAM_BOT_TOKEN` | Dedicated Telegram bot token |
| `TELEGRAM_OWNER_ID` | Immutable numeric owner user ID, never username |
| `ADMIN_BOT_STATE_SECRET` | High-entropy AES-GCM secret for short custom-password confirmation state |
| `TEMP_PASSWORD_TTL_MINUTES` | Optional bounded lifetime; default 180 |
| `TEMP_PASSWORD_MAX_USES` | Only 1 or 2; default 2 |
| `ENABLE_IMAP_WORKER` | `true` only on the intended settlement worker service |
| `IMAP_USER` | Receipt mailbox user |
| `IMAP_PASSWORD` | App password, not normal mailbox password |
| `FAMPAY_SENDER_FILTER` | Expected receipt sender filter |

`ADMIN_BOT_DISABLE_AUTOSTART` is a test/controlled-import switch, not normal production configuration.

Keep Telegram transport on long polling. Do not configure a webhook for the same bot token. The MongoDB lease protects overlap, but do not intentionally operate duplicate worker services.

---

## 6. Pre-release repository gate

### Repository state

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
git diff --check
git diff --stat
git diff --name-status
```

Review every changed file. Confirm generated dependencies, build output and local environment files are not staged.

### Clean validation

Run sequentially in constrained environments:

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

Do not run bare `npx tsc` when dependencies are absent; it may fetch an unrelated package. Install first and run the repository’s TypeScript tool.

### Documentation and secret hygiene

- Validate Markdown fences, details tags, links and required architecture IDs.
- Confirm no markup multiplier values or private operational data entered docs.
- Search current tracked content and Git history for credential patterns.
- Inspect suspicious matches manually; variable names and examples are expected, values are not.
- Check the staged patch again immediately before commit.
- Do not print full environment values as a diagnostic.

### Push credential handling

A push requires explicit authorization. For the authorized operation:

1. use the least privilege and shortest practical lifetime;
2. avoid command-line URL credentials;
3. use an ephemeral credential transport;
4. do not write it to workspace files, Git configuration, remotes or persisted shell history;
5. remove temporary helpers/environment immediately;
6. verify local and remote commit hashes;
7. revoke the credential immediately;
8. record revocation confirmation without recording the credential.

An explicitly declared emergency exception can authorize a specific push, but does not authorize reuse for another push.

---

## 7. Database readiness gate

### Capabilities

- MongoDB must support multi-document transactions.
- Connection role must create/use the required collections and indexes.
- Network rules must allow only intended Vercel/Railway/provider paths.
- Production index creation failures are release-blocking.

### Critical index behavior

The application awaits critical index creation. Before deployment:

1. run the integration index gate;
2. inspect production-shaped data for conflicts;
3. resolve duplicate session hashes, tokens, provider IDs, settlement keys, pending memos or equivalent keys;
4. never drop uniqueness only to make startup pass;
5. retain a redacted migration/reconciliation record.

### Backup and restore

Before a high-risk deployment:

- confirm Atlas backup/PITR status and last successful snapshot;
- record backup timestamp and retention window;
- identify who can restore and where restoration will occur;
- define the latest acceptable restore point;
- rehearse restore into an isolated database periodically;
- validate collection counts, indexes and a sample of financial ledger/transaction relations after restore;
- never test restoration by overwriting production.

A code rollback does not reverse a schema/data mutation or a financial settlement.

---

## 8. Vercel staging gate

Deploy the candidate commit against an isolated database.

### Authentication and email

1. Register with valid data.
2. Confirm no normal session before required verification.
3. Receive the verification message from the intended sender/origin.
4. Use its token once; replay must fail.
5. Resend verification; the superseded token must fail.
6. Request recovery without relying on account enumeration.
7. Reset once; old token and old sessions must fail.
8. Change email using current password and new-mailbox proof.
9. Confirm prior sessions are revoked after email change.
10. Confirm lock state blocks normal login.
11. Confirm temporary-password use creates only a restricted password-change session.
12. Confirm permanent-password completion revokes restricted and old sessions.

### Sessions and Support Access

1. Create multiple normal sessions and inspect safe metadata.
2. Revoke one and verify it stops authorizing.
3. Revoke all other sessions and verify the current intended session remains/behaves as designed.
4. Issue Support Access through the staging owner bot.
5. Exchange the one-time code once inside five minutes.
6. Confirm replay/expiry/wrong-account attempts fail.
7. Confirm separate support cookie, banner, actor and subject.
8. Confirm all mutations fail, including direct API calls.
9. Confirm session expires by 15 minutes and exit revokes it.
10. Confirm no API secret/raw session token is visible.

### API keys

1. Create a named identity and verify one fee debit/ledger entry.
2. Replay idempotency request and race concurrent creation.
3. Verify the secret is shown once and stored hash-only.
4. Test each scope and missing-scope denial.
5. Test daily/monthly limit boundaries and concurrency.
6. Test optional expiration.
7. Pause and resume without changing secret.
8. Rotate and verify old secret permanently fails.
9. Archive using exact-name confirmation and verify no refund.
10. Force reissue through Telegram and verify it cannot resume until website rotation.
11. Confirm activity excludes secrets, headers, cookies and passwords.

### Direct UPI

Create exact pending deposits and test:

- wrong/expired transaction ID;
- wrong user;
- wrong method/state;
- wrong amount;
- missing/wrong memo;
- duplicate UTR/transaction/memo;
- concurrent website/worker settlement;
- account payment hold;
- transaction rollback on induced failure;
- reconciliation when evidence is incomplete.

No screenshot or amount-only match may credit a wallet.

### Razorpay

Complete [`RAZORPAY_SETUP.md`](RAZORPAY_SETUP.md), including captured-only settlement, callback/webhook ordering, duplicate events, refund/dispute holds and safe Test Mode behavior.

### Supplier/orders/reviews

1. Public catalog list works without leaking provider credentials/private markup.
2. Catalog refresh rejects GET, anonymous and non-owner callers.
3. Normal owner POST refresh succeeds.
4. Order creation re-fetches authoritative service details.
5. Ordering hold blocks website and reseller order creation.
6. API key scopes/limits are enforced atomically.
7. Review submission requires an eligible purchase.
8. Moderation exists only in Telegram.

### Cron and rate limiting

1. `/api/cron/status-sync` returns 503 when server secret configuration is absent.
2. Missing/bad bearer token returns unauthorized.
3. Correct configured authorization succeeds.
4. Shared rate limits survive multiple function instances.
5. Stored limiter keys do not contain raw email/IP/credential data.
6. Expired buckets are TTL cleaned.

---

## 9. Railway staging gate

### Bot authorization

1. Startup bot identity matches expectation.
2. Non-owner commands, callbacks and text cannot disclose/mutate data.
3. Owner ID comparison uses numeric Telegram identity.
4. Bot is using long polling with intended update types.
5. Old queued updates are dropped at startup.

### Administrative actions

For credit, debit, refund, holds, locks, key controls and recovery:

- require a bounded reason;
- show safe preview;
- confirm with inline button;
- reject wrong actor;
- reject stale action after five minutes;
- reject duplicate/replayed callback;
- atomically claim then mutate;
- write audit/ledger records;
- verify failure rollback.

### Recovery and Support Access

- Generated and owner-selected temporary modes both work.
- Custom plaintext exists only in five-minute AES-GCM state, then is replaced by bcrypt hash.
- Usage messages edit with tick, timestamp, count and remaining uses.
- Failed Telegram edits enter retry and recover.
- Support code appears once and only hash persists.
- Status messages synchronize on exchange/exit/expiry.

### IMAP worker

1. Start two Railway staging replicas briefly.
2. Confirm one active `imap_settlement` lease.
3. Confirm healthy heartbeat and lease-owner fields.
4. Deliver one exact receipt and observe one wallet credit.
5. Replay the same receipt and observe no second credit.
6. Deliver mismatched/ambiguous evidence and observe reconciliation, not credit.
7. Force a payment hold/transaction failure and verify rollback.
8. Force consecutive mailbox errors and verify owner alert.
9. Restart the leader and verify safe lease takeover.
10. Confirm graceful shutdown releases/closes resources appropriately.

---

## 10. Production domain, headers and search gate

1. Attach `smmup.co.in` and `www.smmup.co.in` in Vercel.
2. Make apex the primary production domain.
3. Confirm `www` permanently redirects while preserving path/query behavior.
4. Confirm `/profile` permanently redirects to `/account`.
5. Confirm canonical, Open Graph, JSON-LD, sitemap and robots use apex consistently.
6. Confirm security headers on pages and API routes.
7. Confirm APIs use no-store/noindex behavior.
8. Confirm `/favicon.ico`, `/favicon-48x48.png`, `/apple-touch-icon.png`, `/logo-512x512.png`, `/robots.txt`, `/sitemap.xml` and manifest assets return intended content types rather than SPA HTML.
9. Confirm sitemap pages render meaningful content and correct status.
10. Verify appropriate properties in Google Search Console.
11. Submit the apex sitemap.
12. Inspect/request indexing of `https://smmup.co.in/` only after deployment is stable.

Search recrawl is asynchronous; do not promise a date or claim completion before observation.

---

## 11. Accessibility and performance release gate

Automated build success is not sufficient.

### Accessibility smoke

- Complete keyboard navigation without trap.
- Visible focus on all controls.
- Dialogs return focus and expose labels.
- Form errors are programmatically associated and understandable.
- Color contrast is readable in light/dark states.
- Reduced-motion preference does not force disruptive animation.
- Support, terms and navigation links are real interactive elements.
- Breadcrumbs do not imply nonexistent links.
- Test at least one screen reader flow for registration, order and Add Funds.

### Performance smoke

- Test mobile-width initial load and main workflows on a throttled profile.
- Record bundle/build advisory; current build has a non-failing large main-chunk warning.
- Check layout shift around fonts, logo, service lists and payment UI.
- Confirm catalog/activity pagination/bounds prevent unbounded rendering.
- Confirm API errors/timeouts yield recoverable UI states.
- Do not delay security fixes solely for performance score changes.

A formal WCAG 2.2 AA audit and automated performance budgets remain post-launch backlog unless separately completed.

---

## 12. Production deployment sequence

### Before change

- [ ] Explicit deploy authorization.
- [ ] Intended source commit identified.
- [ ] GitHub remote commit verified.
- [ ] Required credential revocations confirmed.
- [ ] Clean local gate passed.
- [ ] Staging gate passed.
- [ ] Atlas backup/PITR confirmed.
- [ ] Rollback owner and incident channel named.
- [ ] Vercel/Railway/provider dashboards accessible.
- [ ] Maintenance/customer communication decision made.

### Deploy

1. Deploy Vercel candidate source commit.
2. Wait for build/function readiness.
3. Verify migrations/index startup behavior.
4. Verify public homepage and health-critical reads.
5. Deploy/restart Railway bot/worker candidate.
6. Confirm bot identity, long polling, indexes, lease and heartbeat.
7. Verify Resend/Razorpay/supplier configuration safely.
8. Run controlled smoke checks below.
9. Monitor elevated error/reconciliation signals.
10. Declare success only after evidence review.

### Controlled production smoke

- homepage, approved platform pages and legal pages;
- registration + email verification using a controlled address;
- normal login/logout and account page;
- recovery flow without retaining plaintext credentials;
- service listing and one low-risk order only if authorized;
- Direct UPI creation without uncontrolled payment;
- one small payment only when the payment owner explicitly authorizes it;
- API-key create/rotate/archive with accounted wallet impact only if authorized;
- owner Telegram menu/read operation and one safe confirmation-cancel path;
- cron authentication/status sync;
- domain redirects, icons, robots and sitemap.

Do not test destructive/high-value operations casually in production.

---

## 13. Rollback decision matrix

| Symptom | Immediate action | Rollback? |
|---|---|---|
| Static/UI regression, APIs healthy | halt promotion; restore prior Vercel deployment | usually |
| Authentication bypass/data exposure | contain access, rotate affected secrets, rollback/fix | immediately |
| Index startup failure | stop rollout; inspect data conflict | do not bypass index |
| Duplicate/incorrect wallet credit | pause relevant payment/order path; preserve evidence | code rollback may be insufficient |
| Razorpay outage | disable rail/credentials safely; keep independent UPI if healthy | rail-level rollback |
| Supplier outage/wrong rates | pause ordering/refresh; preserve account reads | feature/ordering hold |
| Bot wrong authorization behavior | stop Railway bot; revoke/rotate token if needed | immediately |
| IMAP duplicate settlement risk | stop worker/disable flag; reconcile | immediately |
| Email outage | pause affected new-account/change flow or communicate; avoid bypassing verification | situational |
| Canonical/icon/search error | restore corrected static/config deployment | low-risk but prompt |

### Rollback procedure

1. Name incident commander and timestamp the decision.
2. Stop or isolate the unsafe mutation path.
3. Preserve redacted logs, IDs and deployment metadata.
4. Roll Vercel back to the last known-good deployment where appropriate.
5. Roll Railway back or stop the service where appropriate.
6. Disable affected provider integration if old code cannot process current events safely.
7. Do not delete newly written financial/audit records.
8. Reconcile in-flight transactions/orders/tokens/sessions.
9. Rotate credentials if exposure or boundary failure is possible.
10. Re-run smoke tests on restored state.
11. Communicate status and remaining manual work.

---

## 14. Incident response playbooks

### Severity

- **SEV-1:** active auth bypass, secret exposure, unauthorized financial mutation, widespread data disclosure or destructive corruption.
- **SEV-2:** major payment/order outage, broken verification/login for many users, duplicate-risk worker failure or critical provider compromise without proven abuse.
- **SEV-3:** limited functional regression, isolated reconciliation, SEO/static asset problem or non-sensitive observability gap.

### Universal sequence

1. Detect and timestamp.
2. Assign incident commander.
3. Contain before diagnosing deeply.
4. Preserve evidence; avoid secret/PII copying.
5. Determine affected environments, users, time range and data classes.
6. Eradicate cause and rotate/revoke as needed.
7. Recover through reviewed deployment/reconciliation.
8. Monitor for recurrence.
9. Notify affected parties/providers when legally or contractually required.
10. Write a blameless review with preventive actions and owners.

### Suspected credential exposure

- Revoke/rotate the exact credential first.
- Determine where it appeared: source, history, logs, chat, dashboard or browser bundle.
- Invalidate dependent sessions/tokens if trust was compromised.
- Audit provider access and deployment changes.
- Remove the value from current surfaces; consider history rewrite only with coordinated impact analysis.
- Secret deletion alone is not remediation without revocation.

### Session/token compromise

- Revoke affected MongoDB sessions by hash/identity.
- Revoke all sessions for affected users when scope is unclear.
- Rotate signing/HMAC secrets only with a planned system-wide invalidation.
- Review Support Access, email-token and temporary-password events separately.
- Confirm raw tokens were never stored.

### Financial inconsistency

- Pause the relevant payment/ordering path.
- Identify exact transaction, provider event, settlement key, ledger entry and user.
- Compare provider truth and internal state.
- Determine spend downstream before reversing funds.
- Use audited transactional adjustment/refund tools.
- Keep holds until reconciliation is reviewed.

### Supplier compromise

- Pause new ordering and catalog refresh.
- Rotate supplier credentials.
- Compare recently created orders/rates/status mutations.
- Do not expose provider error bodies/secrets to customers.
- Resume after safe catalog/order verification.

### Telegram bot compromise

- Stop Railway.
- Revoke bot token through BotFather/provider controls.
- Rotate `ADMIN_BOT_STATE_SECRET` if short-lived protected state might be exposed.
- Review `admin_actions`, wallet ledger, key controls, recovery and support events.
- Reissue bot token/config and verify numeric owner identity before restart.

---

## 15. Observability and evidence

### Monitor

- Vercel function error/latency rates;
- authentication and rate-limit security events;
- email provider failures;
- Razorpay webhook delivery/failure/dispute/refund events;
- Direct UPI reconciliation queue;
- supplier failures and stale status sync;
- Railway process restarts;
- Telegram polling errors;
- worker lease owner/expiry/heartbeat and consecutive mailbox errors;
- payment/order holds and failed admin actions.

### Logging rules

Allowed identifiers should be bounded and necessary: internal record IDs, provider public IDs, action/outcome, safe error category, deployment ID and timestamps.

Never log:

- passwords or password hashes;
- temporary credentials;
- API secrets or token values;
- session cookies/raw session tokens;
- authorization headers;
- email verification/recovery/change tokens;
- UPI PIN, OTP, CVV or banking password;
- mailbox/merchant/provider secrets;
- private markup values.

Owner Telegram may display full user email and operational order/deposit details, but still cannot display the forbidden secret classes above.

### Release evidence retention

Store evidence in an access-controlled operational system, not in public repository docs. Retain only what policy/legal requirements justify. Redact secrets and minimize personal data. Detailed API telemetry currently has a 90-day bounded retention; lifetime order/financial records are separate and must follow the eventual formal retention policy.

---

## 16. Post-deploy observation

### First hour

- Watch Vercel/Railway exceptions and restart loops.
- Confirm bot heartbeat/lease.
- Review new reconciliation and payment events.
- Confirm registration email and login remain healthy.
- Confirm supplier list/status calls.
- Check canonical redirect and critical assets.

### First day

- Reconcile provider captures against internal settlements.
- Review security/rate-limit anomalies.
- Review email bounces/failures.
- Confirm cron execution.
- Review account/order/payment holds.
- Confirm no unintended test-mode wallet credit.

### First week

- Review error/latency trend and dependency/provider issues.
- Verify backup completion.
- Close or assign every reconciliation record.
- Review access to provider dashboards and stale credentials.
- Schedule post-launch accessibility/performance and restore work.

---

## 17. Final sign-off template

```text
Release commit:
Vercel deployment:
Railway deployment:
Database/environment:
Staging gate reviewed by:
Production smoke reviewed by:
Payment owner approval:
Backup/PITR evidence timestamp:
Credential revocations confirmed:
Open exceptions and owners:
Rollback target:
Decision: GO / NO-GO / ROLLED BACK
Timestamp:
```

Do not add credential values, raw tokens, private pricing or unnecessary personal information to this record.

## 18. Emergency authentication/configuration recovery

Use this path when multiple database-backed account APIs fail at function invocation while a provider-independent endpoint still responds:

1. record deployment ID, source commit, environment and bounded request IDs;
2. inspect Vercel function initialization logs without copying secret values;
3. compare Production variable names against `vercel.env.example`;
4. set a new unique 32+ character `JWT_SECRET` and independent 32+ character `CRON_SECRET`;
5. confirm MongoDB URI/database and HMAC-specific secrets are present in the correct Vercel environment;
6. redeploy explicitly;
7. verify controlled JSON from `login`, `me`, reviews and Razorpay config;
8. test login success/failure, cookie creation/revocation and session listing;
9. test cron missing/bad/good bearer behavior;
10. monitor errors and security events before declaring recovery.

Do not derive a secret from MongoDB URI, provider key, email or repository data. Do not weaken the minimum length to restore availability.

## 19. Supplier-order ambiguity gate

Release evidence must prove for website and reseller orders:

- service and charge are recalculated server-side;
- holds and balance are checked in the reservation transaction;
- debit, ledger and local `Submitting` order commit together;
- provider execution starts only after reservation;
- malformed/rejected provider output produces a durable review-required order;
- accepted provider ID is persisted or a `Submission uncertain` record is escalated;
- no blind retry or automatic refund occurs where duplicate fulfillment is possible;
- activity/audit failure does not turn a completed provider operation into a retryable response;
- concurrent insufficient-balance and key-limit attempts have one consistent winner.

## 20. Repository automation governance

GitHub Actions may run only through explicit `workflow_dispatch`. The emergency credential used for the feature-branch push lacked workflow-write scope, so the manual-only workflow remains an isolated local commit. The remote feature branch contains no workflow and therefore introduces no push/PR automation.

Before any future workflow push:

1. obtain a separately authorized credential with workflow-write permission;
2. parse the YAML and verify `on` contains only `workflow_dispatch`;
3. verify no reusable caller, schedule, push or pull-request trigger was added;
4. retain the workflow change as a reviewable commit;
5. revoke the credential immediately after the authorized push.

## 21. Provider template ownership

- `vercel.env.example` is the exhaustive website/API inventory.
- `railway.env.example` is the exhaustive Telegram bot/IMAP worker inventory.
- `.env.example` and `admin-bot/.env.example` are synchronized convenience copies.
- A release must compare source `process.env` references to the correct template and fail review on missing names.
- Templates document names and safe placeholders only; production values remain in provider secret stores.
