# SMM UP Admin Bot — Complete Development Specification

> **Status:** Planning document only. Bot implementation is intentionally deferred until the website is complete and its security-hardening work has been finished.
>
> **Last updated:** 2026-10-05
>
> **Hosting decision:** Railway always-on private worker. The website and normal HTTP APIs remain on Vercel.
>
> **Administration decision:** There will be no web-based admin panel. Administrative operations will be performed through the owner-only Telegram bot.

---

## 1. Purpose of this document

This document is the single source of truth for the future SMM UP administrative bot. It defines:

- what the bot will do;
- what the bot will not do;
- how the inline-button interface will work;
- which actions require text input;
- how financial actions will be confirmed and made idempotent;
- how authentication and authorization will work;
- how MongoDB access will be restricted;
- how the payment-settlement worker will operate;
- how every action will be audited;
- how the bot will be tested, deployed, monitored and rolled back;
- which website-security tasks must be completed before bot expansion begins.

No feature should be added to the bot merely because it is convenient. Every feature must have a clear operational purpose, a defined authorization rule, an audit trail and a safe failure mode.

---

## 2. Project timing and scope freeze

### 2.1 Current decision

The full bot redesign is **not being implemented now**. Website completion and security hardening come first.

The existing bot may continue to perform its currently implemented owner-only commands and payment worker duties, but large bot-interface changes must wait until the website phase is declared complete.

### 2.2 Conditions for starting bot development

Bot development starts only after all of the following are true:

1. The website deploys successfully on the chosen Vercel plan.
2. The API-key plaintext migration is complete.
3. Payment verification is bound to an exact user transaction and memo.
4. Distributed rate limiting protects sensitive website endpoints.
5. Cron and catalog-refresh endpoints fail closed.
6. Website authentication/session decisions are finalized.
7. MongoDB backup and restore procedures are verified.
8. Production and staging environment variables are documented.
9. There are no known critical or high-severity production dependency vulnerabilities.
10. The owner explicitly gives a new green light for bot implementation.

### 2.3 What may happen before the green light

- Documentation may be improved.
- Threat models may be updated.
- Menu wording may be discussed.
- Database schemas may be reviewed.
- No production bot behavior should be changed solely from this planning document.

---

## 3. Core product decisions

### 3.1 No website admin panel

SMM UP will not expose:

- `/admin`;
- `/dashboard/admin`;
- browser-based balance controls;
- browser-based refunds;
- browser-based review moderation;
- browser-based provider credentials;
- public or secret-looking `api/admin/*` management routes.

This reduces the number of public administration surfaces. It does **not** make the system automatically secure: the Telegram bot itself becomes a high-value administrative surface and must be hardened accordingly.

### 3.2 Railway, not Vercel, for the complete bot

The bot will run as one always-on Railway service because it requires:

- Telegram long polling;
- callback-query processing;
- an always-running IMAP settlement loop;
- continuous health and heartbeat checks;
- predictable in-memory wizard state backed by MongoDB;
- graceful shutdown handling;
- restart-on-failure behavior.

Vercel may host request/response APIs and webhooks, but the complete SMM UP bot will not be split between Vercel and Railway unless a future technical requirement makes that unavoidable.

### 3.3 Telegram transport terminology

The planned Telegraf implementation uses the **Telegram Bot API** with long polling. It does not use a user account and should not be described as an MTProto user client.

### 3.4 Inline-first, not inline-only

Every menu, navigation choice and confirmation should use inline buttons where practical.

Some information cannot sensibly be selected from buttons:

- user email or username;
- wallet amount;
- refund reason;
- order ID;
- transaction memo or UTR;
- a free-form support/internal note.

For those values, the bot will use a guided input wizard:

1. Owner taps an inline action.
2. Bot requests one specific value.
3. Owner sends that value as text.
4. Bot validates it without changing data.
5. Bot shows a complete confirmation screen.
6. Owner taps **Confirm** or **Cancel**.
7. Only Confirm performs the operation.

---

## 4. Current implementation inventory

The existing bot currently contains these commands:

| Current command | Current purpose | Future disposition |
|---|---|---|
| `/start`, `/help` | Text command list | Replace primary experience with Main Menu; retain as fallback |
| `/stats` | Platform totals | Move into Overview screen |
| `/user <email>` | User lookup | Move into guided Users search |
| `/credit` | Wallet credit | Replace with confirmed inline wizard |
| `/debit` | Wallet debit | Replace with confirmed inline wizard |
| `/pending` | Pending deposits | Move into Payments screen |
| `/orders [limit]` | Recent orders | Move into paginated Orders screen |
| `/failed` | Failed order review | Move into Failed Orders queue |
| `/refund` | Direct refund | Replace with atomic, confirmed refund workflow |
| `/checkmemo` | Payment memo lookup | Move into guided Payment Search |
| `/scan` | Manual IMAP scan | Move into System/Payments controls |
| `/reviews` | Review list and moderation | Retain behavior, redesign into inline Reviews screen |

The existing worker also scans payment emails and settles matching pending deposits. This functionality will remain, but its idempotency, locking, observability and failure recovery must be strengthened.

---

## 5. Proposed architecture

```text
Telegram owner account
        |
        | Telegram Bot API (long polling + callback queries)
        v
Railway: SMM UP Admin Bot / Worker
        |
        |-- Owner authorization middleware
        |-- Inline menu router
        |-- Wizard-state manager
        |-- One-time action-token validator
        |-- Admin audit logger
        |-- Payment IMAP settlement worker
        |-- Health and alert dispatcher
        |
        +---------------------> MongoDB Atlas
        |                       - users
        |                       - orders
        |                       - transactions
        |                       - processed_transactions
        |                       - reviews
        |                       - admin_action_tokens
        |                       - admin_audit_logs
        |                       - bot_runtime_state
        |                       - security_events
        |                       - service_overrides (future)
        |
        +---------------------> Telegram Bot API
        |
        +---------------------> Gmail/FamApp IMAP (worker only)
        |
        +---------------------> SMM provider API (only where required)

Vercel website/API remains a separate runtime.
No browser-based admin UI is introduced.
```

---

## 6. Trust boundaries

### 6.1 Trusted components

- The configured Telegram owner account.
- The Telegram bot token stored in Railway secrets.
- The Railway runtime.
- The scoped MongoDB bot user.
- The configured IMAP account and app password.
- The expected payment-alert sender configuration.

### 6.2 Untrusted inputs

Even though the bot is owner-only, all of these remain untrusted:

- callback data;
- typed email addresses;
- amounts;
- order IDs;
- reasons and notes;
- usernames and profile data from MongoDB;
- provider API responses;
- IMAP email content;
- payment identifiers;
- stored review text;
- Telegram message metadata.

Every untrusted value must be validated and HTML-escaped before being included in a Telegram HTML message.

### 6.3 Never trust the client

An inline button does not authorize an action by itself. Every callback must re-check:

1. Telegram sender ID;
2. action-token validity;
3. token expiry;
4. intended action type;
5. intended target document;
6. current database state;
7. whether the action was already consumed.

---

## 7. Authentication and authorization model

### 7.1 Owner-only authorization

Every update must pass a global middleware check:

```text
ctx.from.id === TELEGRAM_OWNER_ID
```

Additional requirements:

- Compare normalized numeric IDs, not usernames.
- Reject channel posts and anonymous-admin actions.
- Reject updates without a sender ID.
- Do not authorize by Telegram username because usernames can change.
- Do not authorize by chat ID alone.

### 7.2 Owner Telegram account requirements

Before bot production launch:

- Telegram two-step verification must be enabled.
- Recovery email must be controlled by the owner.
- Other active Telegram sessions must be reviewed.
- Device passcode/biometric lock must be enabled.
- Bot token must never be pasted into messages or screenshots.

### 7.3 Future multi-admin support

Multi-admin support is not part of version 1.

If it is added later, it requires explicit roles:

- `owner`: all actions;
- `finance`: payment investigation and approved refunds;
- `support`: read-only user/order lookup and review moderation;
- `observer`: read-only metrics.

It must not be implemented as a comma-separated list with equal powers.

---

## 8. Main menu

The default screen will be a single edited Telegram message, not a stream of new messages.

```text
SMM UP — ADMIN CONTROL

System: Operational
Worker: Connected
Last settlement scan: 12 seconds ago

[ 📊 Overview ]  [ 👥 Users ]
[ 📦 Orders   ]  [ 💳 Payments ]
[ ⭐ Reviews  ]  [ 🧰 Services ]
[ 🛡 Security ]  [ ⚙️ System ]

[ 🔄 Refresh ]   [ 🔒 Close ]
```

### 8.1 Universal navigation buttons

Where appropriate, every screen will include:

- `◀ Back`
- `🏠 Main Menu`
- `🔄 Refresh`
- `❌ Cancel`
- `🔒 Close`

### 8.2 Close behavior

Close will:

1. cancel the active wizard;
2. invalidate unconsumed action tokens for that wizard;
3. clear temporary bot state;
4. edit the message to `Admin session closed`;
5. leave permanent audit logs untouched.

Close does not log the owner out of Telegram and does not revoke the bot token.

---

## 9. Overview module

### 9.1 Metrics

The Overview screen will show:

- registered users;
- users created today;
- total wallet liability;
- gross deposits today;
- gross order volume today;
- estimated gross profit today;
- order count today;
- active orders;
- completed orders;
- failed orders requiring review;
- pending deposits;
- delayed deposits;
- approved/hidden community reviews;
- provider connectivity;
- MongoDB connectivity;
- IMAP worker health;
- bot uptime;
- deployed bot version/commit.

### 9.2 Rules

- All financial values must state their currency.
- Profit must never be confused with turnover.
- Metrics must specify the time window.
- The screen must never expose provider credentials or wholesale formulas.
- Expensive aggregations should be cached briefly or precomputed.

### 9.3 Buttons

```text
[ Today ] [ 7 Days ] [ 30 Days ]
[ Failed Orders ] [ Pending Deposits ]
[ 🔄 Refresh ] [ 🏠 Main Menu ]
```

---

## 10. Users module

### 10.1 Search

Search will accept:

- exact email;
- exact username;
- MongoDB user ID;
- optionally a safely escaped prefix search with a strict result limit.

### 10.2 User detail screen

Show only operationally necessary data:

- username;
- partially masked email where possible;
- user ID;
- current balance;
- total spent;
- total orders;
- registration date;
- account state;
- whether an API key exists;
- API-key last-used time;
- recent orders count;
- recent transactions count;
- review state.

Never show:

- password hash;
- raw API key;
- JWT token;
- full session token;
- database connection string;
- payment mailbox credentials.

### 10.3 User buttons

```text
[ 📦 Orders ] [ 💳 Transactions ]
[ ➕ Credit ] [ ➖ Debit ]
[ 🔑 Revoke API Key ]
[ 🔒 Lock Account / 🔓 Unlock Account ]
[ 🚪 Revoke Sessions ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

### 10.4 Credit workflow

1. Select **Credit**.
2. Enter amount.
3. Validate finite number, currency precision and configured maximum.
4. Enter reason.
5. Display user, old balance, amount, projected balance and reason.
6. Create one-time action token.
7. Show Confirm/Cancel.
8. On Confirm, atomically increment balance.
9. Insert financial ledger record.
10. Insert admin audit record.
11. Mark action token consumed.
12. Display final balance.

### 10.5 Debit workflow

The debit workflow mirrors credit but adds:

- an atomic `balance >= amount` filter;
- a prohibition on negative balances;
- a higher-friction confirmation style;
- a warning when debit exceeds a configured threshold.

### 10.6 Account lock

A locked account should be unable to:

- authenticate with new sessions;
- use existing website sessions after revocation/version check;
- use the reseller API;
- place orders;
- initiate deposits.

Locking must not delete historical data.

---

## 11. Orders module

### 11.1 Order queues

- Latest
- Active
- Completed
- Partial
- Failed
- Refunded
- Cancelled
- Refill eligible
- Requires admin review

### 11.2 Order detail

Display:

- internal order ID;
- provider order ID;
- user identity;
- service name and ID;
- platform/category;
- quantity;
- retail charge;
- status;
- start count/remains where available;
- refill policy;
- cancellation eligibility;
- created/updated times;
- provider error in sanitized form;
- refund status;
- target link only when operationally required.

### 11.3 Order actions

```text
[ 🔄 Check Provider ]
[ ♻️ Request Refill ]
[ ✖️ Request Cancellation ]
[ ↩️ Refund ]
[ 👤 View User ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

Actions must be conditionally available. For example, do not show Refund after a completed refund, and do not show Refill for a non-refill service.

### 11.4 Failed-order workflow

For a failed provider submission:

1. Display complete sanitized context.
2. Allow **Retry Provider**, **Refund**, or **Keep Under Review** only when technically safe.
3. Never retry if it could duplicate an order whose provider result is uncertain.
4. Require confirmation for retry or refund.
5. Record every choice in the audit log.

### 11.5 Atomic refund design

A refund must not use a read-then-credit-then-update sequence.

Required design:

1. Atomically change eligible order from `requires_admin_review` to `refund_processing` using a conditional filter.
2. If no document changes, stop: another action already claimed it.
3. Credit the wallet exactly once.
4. Insert the refund ledger entry with a unique idempotency key.
5. Mark order `refunded`.
6. If an intermediate operation fails, leave a recoverable state and raise an urgent alert.
7. A reconciliation task must detect stuck `refund_processing` states.

---

## 12. Payments module

### 12.1 Payment queues

- Pending
- Delayed
- Paid
- Failed verification
- Anti-replay blocked
- Manual investigation
- Recently settled

### 12.2 Payment detail

Display:

- internal transaction ID;
- user;
- expected amount;
- memo;
- status;
- created time;
- elapsed time;
- UTR/transaction ID only where required;
- settlement source;
- whether processed identifier exists;
- whether ledger and wallet updates agree.

### 12.3 Payment actions

```text
[ 🔍 Recheck ]
[ 📬 Scan Mailbox ]
[ 👤 View User ]
[ ⚠️ Flag Investigation ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

A general-purpose **Credit Payment** button must not exist without strong binding and confirmation.

### 12.4 Settlement requirements

Every settlement must verify:

1. an exact pending transaction exists;
2. the transaction belongs to the intended user;
3. expected amount matches;
4. memo matches when present;
5. trusted sender filter matches;
6. payment indicates incoming/credited funds;
7. UTR/transaction ID has not been processed;
8. the transaction has not already been paid;
9. wallet credit and ledger state are idempotent.

### 12.5 IMAP scan button

Manual scan must:

- acquire the same global worker lock as automatic scans;
- refuse to overlap with another scan;
- show start and finish states;
- state messages checked and settlements completed;
- avoid dumping full email content into Telegram;
- time out safely.

---

## 13. Reviews module

### 13.1 Review queues

- Latest community submissions
- Approved
- Hidden
- Recently edited

The six permanent homepage reviews remain unchanged and outside community moderation.

### 13.2 Review detail

Display:

- review ID;
- username;
- rating;
- optional city;
- review body;
- creation/update time;
- verified order count;
- visibility status.

### 13.3 Review actions

```text
[ 🙈 Hide / 👁 Restore ]
[ 👤 View User ]
[ 📦 View Orders ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

### 13.4 Rules

- Hiding is reversible.
- Editing a hidden review must not republish it.
- The bot must escape all review text before HTML output.
- The owner may not rewrite a customer review through the bot.
- The website must not expose a web moderation endpoint.

---

## 14. Services module

### 14.1 Version 1 scope

- Provider connectivity status
- Catalog service count
- Platform/category counts
- Last successful catalog fetch
- Last provider error
- Safe catalog refresh
- Provider balance, if supported by provider API
- Low-provider-balance warning

### 14.2 Future service overrides

Possible future capabilities:

- disable one service locally;
- hide a category;
- maintenance flag;
- preferred-service pinning;
- service-quality notes;
- temporary order block.

These require a separate `service_overrides` collection. The bot must never edit supplier records directly.

### 14.3 Markup management

Markup management will not be added until pricing moves from deployment environment variables to a secure database configuration model.

If implemented later:

- values are stored in a private configuration collection;
- website functions cache them briefly;
- changes invalidate price caches;
- old/new values are written to audit logs;
- change requires confirmation;
- exact supplier cost is never displayed;
- rollback to the previous pricing version is supported;
- markup values are never printed in shared groups.

The bot will never manipulate Vercel environment variables using a long-lived Vercel owner token merely for convenience.

---

## 15. Security module

### 15.1 Security dashboard

- failed login events;
- registration spikes;
- rate-limit events;
- invalid API-key attempts;
- payment replay attempts;
- amount/memo mismatches;
- unusual order velocity;
- account locks;
- session revocations;
- worker failures;
- database connectivity failures.

### 15.2 Security actions

```text
[ 🔒 Lock User ]
[ 🚪 Revoke Sessions ]
[ 🔑 Revoke API Key ]
[ ✅ Acknowledge Alert ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

### 15.3 Prohibited security behavior

- Do not send passwords, hashes or raw tokens.
- Do not dump complete request bodies.
- Do not publish database URIs.
- Do not provide a button to disable all security controls.
- Do not permit account lookup by unconstrained regex.
- Do not treat a successful Telegram callback as proof the database action succeeded.

---

## 16. System module

### 16.1 Health indicators

- bot uptime;
- Railway deployment version;
- MongoDB ping;
- IMAP connectivity;
- last successful IMAP scan;
- provider API connectivity;
- last provider catalog refresh;
- pending worker lock;
- recent bot exceptions;
- website health endpoint;
- Vercel deployment version if exposed safely.

### 16.2 System controls

```text
[ 📬 Run IMAP Scan ]
[ 🧹 Clear Expired Wizard State ]
[ 🔄 Refresh Catalog ]
[ 🧪 Run Read-Only Health Check ]
[ ◀ Back ] [ 🏠 Main Menu ]
```

There will be no button that reveals environment variables.

### 16.3 Maintenance mode

Maintenance mode is a future feature and must be represented by a database flag read by the website API. It must not rely only on bot memory.

---

## 17. Inline callback design

### 17.1 Telegram constraint

Callback data must remain compact. It will carry opaque identifiers, not raw emails, review text or reasons.

Example patterns:

```text
nav:main
nav:users
users:search
orders:list:active:2
orders:view:<short-token>
reviews:toggle:<short-token>
action:confirm:<one-time-token>
action:cancel:<one-time-token>
```

### 17.2 Do not trust callback payloads

The callback should identify a server-side action token. MongoDB stores the real:

- action type;
- target collection;
- target document ID;
- actor Telegram ID;
- validated parameters;
- created time;
- expiry;
- consumed state.

### 17.3 One-time action tokens

Proposed document:

```json
{
  "token": "random-opaque-id",
  "actor_telegram_id": "123456789",
  "action": "refund_order",
  "target_id": "mongo-object-id",
  "parameters": {
    "amount": 100,
    "reason": "Provider rejected order"
  },
  "created_at": "date",
  "expires_at": "date",
  "consumed_at": null,
  "status": "pending"
}
```

Requirements:

- cryptographically random token;
- unique index;
- TTL index on `expires_at`;
- maximum lifetime of 5 minutes for financial actions, accommodating temporary owner connectivity issues without leaving confirmations valid indefinitely;
- conditional consume operation;
- owner ID binding;
- single use.

---

## 18. Wizard-state model

### 18.1 Why state is needed

Telegram buttons cannot collect arbitrary amounts or reasons. A state machine ensures the bot knows what the next owner message means.

### 18.2 Example states

```text
idle
awaiting_user_search
awaiting_credit_amount
awaiting_credit_reason
awaiting_debit_amount
awaiting_debit_reason
awaiting_refund_reason
awaiting_order_id
awaiting_memo
confirmation_pending
```

### 18.3 State storage

Important wizard state should be stored in MongoDB, not only process memory, so a Railway restart does not turn a later message into the wrong action.

State fields:

- owner Telegram ID;
- chat ID;
- state name;
- related target ID;
- validated partial inputs;
- created and expiry times;
- message ID associated with the wizard.

### 18.4 Cancellation

`Cancel`, `Close` and `/cancel` invalidate wizard state immediately.

Expired wizard state must never accept a late message.

---

## 19. Audit logging

### 19.1 Every administrative mutation is logged

Proposed `admin_audit_logs` fields:

```json
{
  "event_id": "uuid",
  "actor_type": "telegram_owner",
  "actor_telegram_id": "123456789",
  "action": "wallet_credit",
  "target_type": "user",
  "target_id": "mongo-object-id",
  "request_parameters": {
    "amount": 100,
    "reason": "Manual correction"
  },
  "before": {
    "balance": 50
  },
  "after": {
    "balance": 150
  },
  "result": "success",
  "error_code": null,
  "created_at": "date",
  "bot_version": "git-commit"
}
```

### 19.2 Sensitive-data exclusions

Audit logs must exclude:

- raw passwords;
- password hashes;
- raw JWTs;
- raw reseller API keys;
- bot token;
- IMAP password;
- MongoDB URI;
- provider API key;
- complete payment-email bodies.

### 19.3 Audit retention

Retention policy must be decided before launch. Financial mutation records should not be automatically deleted without a legal/business decision.

---

## 20. Atomicity and idempotency

### 20.1 General rule

A Telegram success message is sent only after the authoritative database change has succeeded.

### 20.2 Financial operations

- Use conditional atomic updates.
- Use unique idempotency keys.
- Prevent double confirmation.
- Detect incomplete multi-step operations.
- Prefer MongoDB transactions when the production cluster supports them and the operation spans several documents.
- When a transaction is not used, create an explicit recoverable state and reconciliation process.

### 20.3 Provider operations

Provider timeouts are ambiguous. A timeout does not prove an order was rejected. The bot must avoid blind retries that could duplicate fulfillment.

### 20.4 Message retries

Telegram delivery failure must not roll back a completed database mutation. The mutation remains logged; the bot should retry only the notification.

---

## 21. IMAP payment worker

### 21.1 Worker behavior

- One active scan at a time.
- Periodic interval with overlap guard.
- Strict trusted-sender filter.
- Decode and parse only necessary fields.
- Match exact pending transaction memo and amount.
- Enforce processed-identifier uniqueness.
- Perform idempotent wallet settlement.
- Record settlement source and time.
- Send owner notification.
- Update heartbeat after successful scan.

### 21.2 Failure handling

- Authentication failure: urgent alert, exponential retry.
- Network timeout: retry with backoff.
- Parse failure: log sanitized metadata and skip credit.
- Amount mismatch: investigation event, no credit.
- Memo mismatch: no credit.
- Duplicate identifier: no credit.
- Database failure: do not mark email/payment completed locally.
- Telegram notification failure: settlement remains valid; retry notification separately.

### 21.3 Worker lock

The lock must survive overlapping asynchronous triggers. In-memory locks protect only one process. A MongoDB lease is preferred if more than one Railway replica could ever run.

### 21.4 Worker heartbeat

`bot_runtime_state` should record:

- last scan start;
- last scan completion;
- last scan result;
- messages checked;
- settlements completed;
- current lock owner;
- lock expiry;
- consecutive failures.

---

## 22. Alerts

### 22.1 Immediate alerts

- provider order failure after wallet debit;
- delayed deposit;
- completed settlement;
- payment replay attempt;
- amount/memo mismatch;
- failed refund operation;
- worker authentication failure;
- repeated database failure;
- new or edited buyer review;
- provider balance below threshold;
- unusual login/API activity after security-events implementation.

### 22.2 Alert controls

Alerts should offer context-sensitive inline buttons, such as:

```text
[ View Order ] [ View User ]
[ Open Failed Queue ] [ Acknowledge ]
```

No alert button should perform a refund immediately.

### 22.3 Alert deduplication

Repeated failures must not flood Telegram. Use fingerprints and cooldowns while retaining counters.

---

## 23. Environment variables

### 23.1 Railway bot variables

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_ID=
MONGODB_URI=
MONGODB_DB_NAME=
IMAP_HOST=
IMAP_PORT=
IMAP_SECURE=
IMAP_USER=
IMAP_PASSWORD=
FAMPAY_SENDER_FILTER=
ENABLE_IMAP_WORKER=true
BOT_ENV=production
BOT_VERSION=
```

Additional variables should be added only when the related feature exists.

### 23.2 Secret-handling rules

- Railway secret variables only.
- Never commit `.env`.
- Never print secret values at startup.
- Never send secrets to Telegram.
- Rotate the bot token after suspected exposure.
- Use a Gmail/FamApp app password, never the primary account password.
- Use separate production and staging tokens.

---

## 24. MongoDB permissions

### 24.1 Bot database user

The bot should use a dedicated MongoDB credential, separate from the website where practical.

Minimum desired scope:

- read/write only on the SMM UP application database;
- no cluster-admin role;
- no access to unrelated databases;
- no ability to manage Atlas users/network rules;
- TLS required.

### 24.2 Network controls

- Prefer narrowly scoped Atlas networking where compatible with Railway networking.
- If broad IP access is unavoidable, compensate with strong credentials, least privilege, monitoring and rotation.
- Enable Atlas alerts for unusual connections.

### 24.3 Backups

Before financial mutation features are enabled:

- automated Atlas backups must be enabled where plan permits;
- restore procedure must be tested;
- recovery point and recovery time expectations must be written down.

---

## 25. Error handling and user experience

### 25.1 Error categories

The bot should distinguish:

- validation error;
- unauthorized update;
- stale button;
- expired confirmation;
- document not found;
- state changed since screen rendered;
- provider failure;
- database failure;
- Telegram API failure;
- IMAP failure;
- internal programming error.

### 25.2 Owner-facing messages

Messages should be actionable but not expose stack traces or credentials.

Example:

```text
Refund was not executed.
Reason: This order was already claimed by another action.
No wallet balance changed.
Audit ID: ADM-20261005-00124
```

### 25.3 Logging

Railway logs may include:

- event type;
- sanitized IDs;
- timing;
- success/failure;
- error class;
- audit event ID.

They must not include raw secrets or full payment email content.

---

## 26. Rate limiting

Even owner-only actions should have limits to protect against loops and compromised sessions.

Suggested controls:

- maximum callback actions per minute;
- maximum user searches per minute;
- maximum manual IMAP scans per interval;
- cooldown after financial action failures;
- one active financial confirmation per owner;
- alert flood suppression.

Limits must be stored in a shared store or database if more than one bot replica can run.

---

## 27. Pagination and message editing

### 27.1 Pagination

Lists should use stable pages and strict limits, for example 5–10 records per Telegram message.

```text
[ ◀ Previous ] [ 2 / 8 ] [ Next ▶ ]
```

### 27.2 Message editing

Prefer editing the active dashboard message to reduce clutter.

Send a new message only for:

- urgent alert;
- explicit exported report;
- required ForceReply input;
- operation receipt that should remain in history.

### 27.3 Stale screens

Before performing any action, reload the target from MongoDB. A screen is a snapshot, not authoritative state.

---

## 28. Data privacy

- Show the minimum personal data required.
- Mask emails in overview/list screens.
- Display full email only in a deliberate user-detail screen.
- Avoid showing complete social target links in alerts unless needed.
- Do not allow bulk user export to Telegram.
- Do not send transaction histories as unencrypted attachments by default.
- Follow the website privacy policy.

---

## 29. Features explicitly not planned

The bot will **not**:

- become a public customer-support bot;
- accept customer orders through Telegram;
- ask customers for social-media passwords;
- expose a web admin dashboard;
- reveal wholesale supplier prices publicly;
- reveal provider API credentials;
- reveal raw user API keys;
- show password hashes;
- store bot state only in volatile memory for critical workflows;
- automatically refund every provider error;
- retry ambiguous provider submissions blindly;
- disable security checks through a convenience button;
- manage GitHub or Vercel using broad owner tokens;
- edit customer review wording;
- perform destructive actions with one tap;
- support child panels/referrals unless separately approved later;
- use AI to make unsupervised financial decisions;
- run the full long-polling/IMAP worker as a Vercel Function.

---

## 30. Testing strategy

### 30.1 Unit tests

- input validators;
- amount parsing;
- HTML escaping;
- callback parser;
- one-time token expiry;
- wizard transitions;
- authorization middleware;
- idempotency helpers;
- status normalization;
- IMAP payment parser.

### 30.2 Database integration tests

- concurrent credit/debit attempts;
- concurrent refund confirmations;
- duplicate callback delivery;
- duplicate UTR/transaction IDs;
- stale order state;
- expired action token;
- hidden review edit;
- user lock/session revocation;
- worker lock acquisition and expiry.

### 30.3 Telegram interaction tests

- unauthorized sender rejection;
- Main Menu navigation;
- Back/Home/Close;
- list pagination;
- stale buttons;
- ForceReply cancellation;
- confirmation expiry;
- message-edit failure fallback;
- HTML special characters in user/review/provider content.

### 30.4 Failure tests

- MongoDB unavailable;
- provider unavailable;
- Telegram unavailable;
- IMAP unavailable;
- Railway restart during wizard;
- Railway restart during scan;
- process receives SIGTERM;
- notification fails after successful financial mutation.

### 30.5 Staging

Use a separate staging bot token, staging owner/chat, staging database and test payment mailbox. Never test destructive financial workflows against production users.

---

## 31. Deployment plan

### Phase 0 — prerequisites

Complete website security items and MongoDB backup verification.

### Phase 1 — foundation

- refactor current bot into modules;
- configuration validation;
- owner middleware;
- HTML escaping helper;
- callback router;
- Main Menu;
- wizard-state store;
- action-token store;
- audit logger;
- graceful shutdown;
- health heartbeat.

### Phase 2 — read-only screens

- Overview;
- Users lookup;
- Orders lists/details;
- Payments lists/details;
- Reviews lists/details;
- System health.

No mutations yet.

### Phase 3 — low-risk mutations

- review hide/restore;
- alert acknowledgement;
- safe catalog refresh;
- account lock/unlock after website support exists;
- API-key revocation after website migration exists.

### Phase 4 — financial actions

- credit wizard;
- debit wizard;
- atomic refund workflow;
- reconciliation;
- high-value thresholds;
- complete financial test suite.

### Phase 5 — worker hardening

- MongoDB lease;
- exact pending-transaction binding;
- idempotent settlement state machine;
- heartbeat and stale-lock recovery;
- alert deduplication.

### Phase 6 — production cutover

- deploy staging;
- test all flows;
- deploy Railway production service;
- verify only one long-polling instance;
- monitor for 24–48 hours;
- retire legacy direct commands only after inline replacements are proven.

---

## 32. Railway configuration

Recommended service configuration:

- Root directory: `admin-bot`
- Start command: `npm start`
- Restart policy: on failure
- One production replica during long-polling phase
- No public domain required
- Environment variables stored in Railway
- Deployment connected to the selected branch
- Logs and resource alerts enabled

The bot must exit non-zero when critical configuration is absent so Railway restarts it or marks deployment unhealthy.

---

## 33. Graceful shutdown

On `SIGTERM` or `SIGINT`:

1. stop accepting new wizard actions;
2. stop Telegram polling;
3. release/expire worker lease safely;
4. finish or checkpoint current non-financial work;
5. close IMAP connection;
6. close MongoDB client;
7. exit within Railway shutdown window.

A shutdown must never repeat a financial operation on restart.

---

## 34. Rollback and disaster recovery

### 34.1 Code rollback

- Every production bot release gets a version/commit identifier.
- Railway deployment history is retained.
- Previous known-good deployment can be restored.
- Database migrations must be backward-aware or have a rollback plan.

### 34.2 Bot token compromise

1. Revoke/regenerate token in BotFather.
2. Replace Railway secret.
3. Restart bot.
4. Review admin audit logs.
5. Rotate related credentials if exposure scope is uncertain.

### 34.3 Telegram owner-account compromise

1. Terminate unknown Telegram sessions.
2. Change Telegram two-step password.
3. Stop Railway bot immediately.
4. Rotate bot token.
5. Inspect all recent financial audit events.
6. Lock or reconcile affected accounts/orders.

### 34.4 Database credential compromise

1. Disable compromised Atlas user.
2. Create replacement least-privilege user.
3. update Railway secret;
4. inspect Atlas access logs;
5. rotate website credential if shared;
6. reconcile financial records.

---

## 35. Website prerequisites related to bot safety

The following website work must happen before full bot development:

1. Stop storing raw reseller API keys.
2. Bind manual payment verification to one exact pending transaction.
3. Add distributed/persistent rate limiting.
4. Make cron authentication fail closed.
5. Remove public supplier force-refresh control.
6. Add atomic refund claim/idempotency logic.
7. Decide and implement server-revocable sessions.
8. Add security-event recording that the bot can display.
9. Define account lock behavior across website and reseller API.
10. Verify MongoDB backups and restore.

---

## 36. Definition of done

The admin bot is complete only when:

- all planned menus are usable from inline buttons;
- unauthorized users cannot access any data or action;
- financial actions require expiring confirmation;
- double-tapping cannot duplicate a financial operation;
- every mutation has an audit record;
- every list is bounded and paginated;
- every stored/displayed untrusted string is escaped;
- no raw secrets are displayed or logged;
- Railway restarts do not corrupt wizard or worker state;
- the payment worker is idempotent;
- staging tests pass;
- production backup/restore is verified;
- operational runbooks exist;
- the owner has tested Back, Home, Cancel and Close behavior;
- the website remains fully functional without the bot online;
- documentation matches actual behavior.

---

## 37. Open decisions for the future bot-development session

These must be decided before implementation begins:

1. Should financial actions above a threshold require a second confirmation phrase?
2. What are the maximum manual credit and debit amounts?
3. Should a locked user be allowed to contact support or withdraw/refund balance?
4. How long should financial and security audit logs be retained?
5. Should full emails be visible only after a separate reveal button?
6. Should service/markup configuration be moved to MongoDB?
7. What provider-balance threshold triggers an alert?
8. What defines a suspicious login/order/payment event?
9. Is a read-only secondary admin role ever needed?
10. What staging database and payment mailbox will be used?

Until those decisions are made, defaults must favor safety over convenience.

---

## 38. Final operating principle

The bot is not merely a convenient remote control. It is a privileged financial administration system.

Therefore:

- read operations should be fast;
- write operations should be deliberate;
- financial operations should be atomic and idempotent;
- destructive actions should require confirmation;
- every mutation should be attributable;
- every failure should be recoverable;
- no secret should be exposed for convenience;
- the website must remain secure and operational even if the bot is offline.
