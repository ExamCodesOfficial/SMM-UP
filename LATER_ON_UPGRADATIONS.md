# SMM UP — Completed Roadmap and Post-Launch Upgrades

> **Roadmap checkpoint:** 2026-10-06
> **Current pushed audit commit:** `32205672bd8a1c7ea4d243c72391248cf57fdd26`; historical bot-modularization checkpoint: `2c60e657c5759f7a22cf9fbb872e1d1e051e7201`
> **Meaning of “complete”:** code and local automated validation are complete; deployment-dependent items stay open until provider/staging evidence exists.
> **Detailed architecture:** [`architecture/full-architecture.md`](architecture/full-architecture.md)

---

## 1. Status legend

- `[x]` implemented in source and covered by the stated local gate.
- `[~]` code complete but provider/staging/production verification remains.
- `[ ]` approved future work or operational gate not yet completed.
- `[N/A]` deliberately excluded or not applicable.

Never translate a GitHub push into a production-complete claim. GitHub, Vercel, Railway, MongoDB Atlas, Resend, Razorpay and Google Search Console are separate operational checkpoints.

---

## 2. Completed implementation phases

### Phase 0 — permanent pages and payment foundations

- [x] Permanent account workspace at `/account`.
- [x] Permanent Add Funds workspace at `/add-funds`.
- [x] Permanent redirect from `/profile` to `/account`.
- [x] Real account, wallet, support, history and legal links.
- [x] Separate Direct UPI and Razorpay payment rails.
- [x] Server-created Razorpay Orders in integer paise.
- [x] Razorpay checkout signature verification.
- [x] Raw-body webhook HMAC verification.
- [x] Captured-payment-only wallet credit.
- [x] Unique provider event and settlement identities.
- [x] Transactional wallet settlement.
- [x] Test-mode payments do not create spendable production balance by default.
- [x] Refund/dispute account holds.
- [x] Order/deposit hold enforcement.
- [x] Narrow Razorpay CSP allowlist.
- [x] Updated payment/legal copy.

### Phase 1 — multiple named API keys

- [x] Dedicated `api_keys` identity collection.
- [x] Dedicated hash-only `api_key_versions` collection.
- [x] Multiple named identities per user.
- [x] Configurable maximum non-archived identities.
- [x] Case-insensitively unique active names.
- [x] Stable public key identity and safe hint.
- [x] One-time raw secret reveal.
- [x] Legacy-key lazy migration without fee.
- [x] Configurable identity creation fee, default ₹29.
- [x] Atomic creation fee debit and wallet ledger.
- [x] Idempotent creation request.
- [x] Explicit scopes.
- [x] Full Access synchronization with current scopes.
- [x] Optional daily limit.
- [x] Optional monthly limit.
- [x] Atomic IST spend buckets.
- [x] Concurrent limit enforcement.
- [x] Optional expiration.
- [x] Pause and resume.
- [x] Free rotate/reissue.
- [x] Permanent archive.
- [x] Exact-name archive confirmation.
- [x] No archive refund.
- [x] Version history and permanent old-secret revocation.
- [x] API-key/order/wallet/refund attribution.
- [N/A] IP allowlisting is intentionally excluded.
- [x] Replica-set integration gate.

### Phase 2 — API activity and reporting

- [x] Bounded `api_key_activity` collection.
- [x] Request timestamp, action, outcome, status and latency.
- [x] Order, version, service, target, quantity and charge attribution.
- [x] Refund and net-charge attribution.
- [x] Per-key totals and error-rate reporting.
- [x] Last-used metadata.
- [x] Ninety-day detailed telemetry retention.
- [x] Lifetime order/financial records outside TTL telemetry.
- [x] Date/action/outcome/service/order/amount filters.
- [x] Archived-key reporting.
- [x] Raw secret/header/password/cookie exclusion.
- [x] Owner refunds preserve key/version attribution.
- [x] Account activity/reporting UI.

### Phase 3 — owner temporary-password recovery

- [x] Permanent passwords remain bcrypt hashes.
- [x] Generated temporary credential mode.
- [x] Owner-selected temporary credential mode.
- [x] Five-minute AES-GCM-protected custom action state.
- [x] Only bcrypt temporary hash persists after confirmation.
- [x] Three-hour default temporary lifetime.
- [x] Bounded lifetime configuration.
- [x] Two-use default.
- [x] One-or-two use configuration.
- [x] Atomic use counting.
- [x] Concurrent one-use protection.
- [x] Restricted password-change session only.
- [x] Mandatory permanent-password creation.
- [x] Use exhaustion and expiry invalidation.
- [x] Session revocation on reset and completion.
- [x] Telegram usage timestamp/count/remaining-use edits.
- [x] Railway retry of failed message edits.
- [x] Identity checklist and mandatory reason audit.
- [x] Replica-set recovery test.

### Phase 4 — revocable sessions and Support Access

- [x] Hash-only 30-day MongoDB normal sessions that survive Vercel process replacement/redeployment.
- [x] Browser retries for transient deployment/network/5xx auth checks without false logout.
- [x] Exhausted-retry session-unavailable state that preserves the cookie and offers retry.
- [x] Bounded legacy-JWT cutover.
- [x] Safe session device/activity/purpose metadata.
- [x] Account single-session revocation.
- [x] Account all-other-session revocation.
- [x] Telegram session inspection/revocation.
- [x] One-time hash-only Support Access code.
- [x] Five-minute code exchange.
- [x] Separate 15-minute support session.
- [x] Separate support cookie.
- [x] Actor/subject separation.
- [x] Persistent read-only banner and countdown.
- [x] Transactional exit and automatic expiry.
- [x] Owner normal session preserved.
- [x] Read account/orders/deposits/targets/key metadata/security state.
- [x] Server-side mutation blocking.
- [x] Page-view/request audit.
- [x] Support Access replica-set test.

### Phase 5 — Telegram owner control plane

- [x] Immutable numeric owner authorization for commands and callbacks.
- [N/A] Webhook-secret verification; transport is long polling.
- [x] Startup Telegram identity verification.
- [x] Restricted long-polling update types.
- [x] Stale pending-update drop.
- [x] Persistent inline main menu.
- [x] MongoDB-backed administrative action state.
- [x] Five-minute actor-bound confirmation.
- [x] Hash-only callback tokens.
- [x] Atomic claim and replay protection.
- [x] Mandatory bounded reasons.
- [x] Full user/account inspection.
- [x] Safe session controls.
- [x] Order/deposit/wallet/security/note inspection.
- [x] Account lock/unlock.
- [x] Ordering hold/release.
- [x] Payment hold/release.
- [x] Transactional credit/debit.
- [x] Idempotent transactional full refund.
- [x] API-key pause/resume/archive/reissue-required.
- [x] Secure website rotation required after owner reissue.
- [x] Review moderation and audit.
- [x] Temporary-password reset and usage synchronization.
- [x] Support Access code issuance/status synchronization.
- [x] Distributed IMAP worker lease.
- [x] Worker heartbeat and consecutive-error state.
- [x] Exact transactional IMAP settlement.
- [x] Payment reconciliation and owner alerts.
- [x] Multi-request settlement concurrency test.
- [x] No website admin panel.

### Phase 6 — platform hardening

- [x] Shared persistent MongoDB limiter.
- [x] HMACed limiter keys.
- [x] Atomic fixed-window counters.
- [x] Login throttling.
- [x] Registration throttling.
- [x] Verification/recovery throttling.
- [x] Key-management throttling.
- [x] Order/deposit/review/API throttling.
- [x] Fail-closed cron configuration.
- [x] Constant-time configured cron comparison.
- [x] Owner-only POST catalog refresh.
- [x] Persistent bounded security events.
- [x] Awaited critical MongoDB indexes.
- [x] Exact Direct UPI pending-ID binding.
- [x] Exact user/method/status/expiry checks.
- [x] Exact integer-paise amount check.
- [x] Exact receipt-memo check.
- [x] Website-side UTR/TxID mailbox verification independent of Railway bot/worker uptime.
- [x] Plain/quoted-printable/base64 MIME receipt decoding with bounded Gmail-search fallback.
- [x] Distinct mailbox-unavailable response and bounded recently-expired manual recovery.
- [x] UTR/transaction/memo replay prevention.
- [x] Transactional wallet settlement.
- [x] Reconciliation when evidence is incomplete.
- [x] Resend integration for requested password recovery and email changes only.
- [x] Hash-only reset/email-change tokens; new signup creates no email token.
- [x] Immediate username/email/password registration with normal session.
- [x] Signup-verification/resend UI and auth action retired.
- [x] Verified email recovery.
- [x] Current-password plus new-mailbox email change.
- [x] Session revocation after reset/email change.
- [x] Expanded `/api` lifecycle/scope/limit/security docs.
- [~] Apex canonical/`www` redirect configuration; production domain verification pending.

### Search appearance

- [x] ICO favicon.
- [x] Square PNG favicon sizes.
- [x] Apple touch icon.
- [x] Square organization logo.
- [x] PWA icon set.
- [x] Stable apex URLs in metadata/schema/sitemap.
- [~] Production deployment/content-type verification.
- [ ] Search Console sitemap submission/reconfirmation.
- [ ] Homepage URL inspection and indexing request.
- [ ] Google recrawl observation.

---

## 3. Local validation evidence

The post-implementation suite has passed locally:

- [x] clean root dependency install;
- [x] root TypeScript;
- [x] production Vite build;
- [x] search appearance test;
- [x] API-key replica-set test;
- [x] recovery replica-set test;
- [x] Support Access replica-set test;
- [x] persistent limiter test;
- [x] exact Direct UPI and bounded late-manual recovery test;
- [x] receipt MIME parsing test;
- [x] email-delivery test;
- [x] email-auth lifecycle test;
- [x] deployment-resilient browser session-bootstrap test;
- [x] opaque-session cross-instance/redeploy persistence test;
- [x] critical-index test;
- [x] clean admin dependency install;
- [x] admin TypeScript;
- [x] admin/worker replica-set test;
- [x] root production audit with zero known vulnerabilities;
- [x] admin production audit with zero known vulnerabilities;
- [x] `git diff --check`;
- [x] current-tree credential-pattern scan;
- [x] Git-history credential-pattern scan;
- [x] Markdown fence/details/logo/count structural checks.

The Vite build currently emits a non-failing large-chunk advisory.

---

## 4. Operational gates not yet proven

### Vercel staging

- [ ] Separate staging database.
- [ ] Preview environment variables.
- [ ] Critical indexes on production-shaped data.
- [ ] Immediate signup/session with zero signup delivery, legacy pending login, reset and email change.
- [ ] Normal/recovery/support cookie behavior.
- [ ] Cron missing/bad/good-secret behavior.
- [ ] Public catalog and owner refresh.
- [ ] Direct UPI failure matrix.
- [ ] Razorpay test matrix.
- [ ] CSP console verification.

### Railway staging

- [ ] Separate staging bot token and owner ID.
- [ ] Startup identity and index success.
- [ ] Wrong-user rejection.
- [ ] Stale/replayed confirmation rejection.
- [ ] Credit/debit/refund rollback behavior.
- [ ] Lock/hold/key controls.
- [ ] Recovery/Support Access status edits.
- [ ] Two-replica lease test.
- [ ] Exact one-credit settlement.
- [ ] Reconciliation retries and alerts.
- [ ] Graceful restart/shutdown.

### Production

- [ ] Vercel production build/deployment success.
- [ ] Railway production restart/health.
- [ ] Resend production sender/domain.
- [ ] Razorpay dashboard/webhook configuration.
- [ ] Apex primary domain.
- [ ] `www` permanent redirect.
- [ ] Icon/sitemap/robots content types.
- [ ] Controlled registration/login/email smoke.
- [ ] Controlled order and safe payment smoke.
- [ ] Telegram owner smoke.
- [ ] Credential revocation evidence.
- [ ] Search Console indexing request.

---

## 5. Approved post-launch backlog

These items are not silently approved for implementation. Each requires a separate design/security checkpoint.

### Identity and account security

- [ ] Optional customer TOTP/WebAuthn two-factor authentication.
- [ ] Recent-authentication challenge for especially sensitive account mutations.
- [ ] User-facing security-event history and new-login email notification.
- [ ] Privacy export/deletion workflow with financial-retention exceptions.
- [ ] Formal inactive-account retention policy.

### Owner operations

- [ ] Multi-admin Telegram roles.
- [ ] Separation of duties for financial versus support operators.
- [ ] Two-person approval for high-value wallet corrections.
- [ ] Maintenance-mode database flag enforced by website APIs.
- [ ] Owner-facing reconciliation resolution workflow.
- [ ] Structured incident declaration/resolution controls.

### Reliability and observability

- [ ] External uptime checks.
- [ ] Metrics dashboard for API latency, provider failures and worker health.
- [ ] Alert routing beyond Telegram for critical outages.
- [ ] Encrypted backup policy.
- [ ] Restore drills and evidence.
- [ ] Defined RTO/RPO.
- [ ] Supplier outage circuit breaker.
- [ ] Provider failover only after service-ID/rate/refund semantics are solved.

### Frontend and performance

- [ ] Route/component code splitting to reduce Vite’s chunk warning.
- [ ] Automated Lighthouse budgets.
- [ ] WCAG 2.2 AA accessibility audit.
- [ ] Keyboard/screen-reader regression tests.
- [ ] Reduced-motion audit.
- [ ] Image/font loading performance audit.

### API ecosystem

- [ ] Formal machine-readable OpenAPI description where compatible with SMM v2 form semantics.
- [ ] SDK examples/packages only after endpoint behavior is stable in production.
- [ ] Customer-configurable webhook callbacks with signed delivery and replay protection.
- [ ] API key recent-auth challenge or TOTP integration if later approved.
- [ ] No IP allowlisting unless the product decision is explicitly reversed.

---

## 6. Ideas deliberately rejected or excluded

- [N/A] Rate calculator.
- [N/A] Website admin panel.
- [N/A] Telegram webhook migration without a demonstrated need.
- [N/A] Raw password retrieval.
- [N/A] Raw API-secret recovery.
- [N/A] Raw session impersonation.
- [N/A] UPI PIN/OTP/CVV/banking-password collection.
- [N/A] Public disclosure of markup multipliers.
- [N/A] Fake breadcrumb/support links.
- [N/A] Additional platform SEO pages outside the approved six.
- [N/A] API-key IP allowlisting in the completed roadmap.

---

## 7. Change-control rules

1. Update architecture and operational documentation in the same change as behavior.
2. Add a test for every new transactional, authentication or replay condition.
3. Never weaken a unique index/idempotency rule merely to make a failing deployment pass.
4. Resolve production-data conflicts through an explicit migration/reconciliation plan.
5. Keep secrets out of source, docs, logs, Telegram and analytics.
6. Treat a pasted credential as exposed.
7. Separate implementation, push, staging, production and recrawl claims.
8. Preserve backward compatibility unless a migration/cutover is documented.
9. Run root/admin suites sequentially in constrained environments.
10. Require explicit approval before pushing or deploying a new change set.

---

## 8. Next recommended sequence

1. Review and commit the post-push documentation refresh separately.
2. Confirm exposed PAT revocation.
3. Deploy isolated staging.
4. Execute the full runbook and retain evidence.
5. Resolve any production-shaped index conflicts before launch.
6. Deploy production with rollback points.
7. Run controlled smoke tests.
8. Confirm Vercel/Railway/provider health.
9. Submit Search Console sitemap/homepage.
10. Open a separate post-launch backlog item only after production stabilizes.

## 9. Phase 7 — emergency reliability and documentation reconciliation

- [x] Diagnose the production sign-in family as a Vercel function/configuration failure rather than a frontend password-validation issue.
- [x] Fail closed on missing/short `JWT_SECRET` and `CRON_SECRET`.
- [x] Move database/configuration failure behind controlled handler boundaries.
- [x] Add bounded frontend response parsing for JSON, text and oversized bodies.
- [x] Generate Direct UPI QR locally.
- [x] Reserve website wallet debit, ledger and local order in one transaction before supplier execution.
- [x] Reserve API-key limits, wallet, ledger and local order in one transaction before supplier execution.
- [x] Preserve ambiguous supplier outcomes for owner review; no blind retry or automatic refund.
- [x] Validate order-reservation concurrency/rollback in a replica set.
- [x] Add exhaustive Vercel and Railway environment templates.
- [x] Push audited application/bot work to the feature branch at `2c60e65`.
- [x] Upgrade every Markdown file and the customer `/api` reference; retain the result in a separate local commit.
- [~] Keep Actions manual-only; workflow commit is local because the emergency PAT lacks workflow scope.
- [ ] Configure strong Vercel Production secrets and redeploy.
- [ ] Prove repaired authentication and cron behavior on the resulting deployment.

### Updated release evidence

The complete release run now also includes `npm run test:order-reservations`, environment-template completeness checks, manual-workflow trigger parsing and working-tree/history credential scans. The latest local run passed root/bot TypeScript, Vite build, search checks, every root integration suite, bot administrative integration, production dependency audits with zero reported vulnerabilities, and `git diff --check`.

## 10. Phase 8 — full audit remediation (source complete, deployment pending)

### Completed and pushed

- [x] Immediate reset/email-change-token URL scrubbing.
- [x] Explicit session-check state, neutral guarded loading and allowlisted `next` redirects.
- [x] Explicit deployment rewrites plus a real static 404 fallback.
- [x] Keyboard-operable mobile modal navigation with focus restoration.
- [x] Responsive Order History states, supplier cancellation requests, safe reorder and refill/status feedback.
- [x] Read-only public review feed with persistent limiting; homepage review preservation and Telegram-only moderation.
- [x] Server-owned Direct UPI limits and per-method Add Funds eligibility.
- [x] Reauthenticated profile editing and settlement-gated account erasure.
- [x] Service favourites and templates that never store targets/comments.
- [x] Browser regression coverage for public, guarded, authenticated and 404 workflows.
- [x] Feature branch pushed at `32205672bd8a1c7ea4d243c72391248cf57fdd26`.

### Still operational

- [ ] Review and merge through the normal protected process.
- [ ] Deploy a Vercel Preview and verify unknown routes return HTTP 404 rather than the SPA shell.
- [ ] Prove Direct UPI and Razorpay configured bounds in the deployed environment.
- [ ] Test account deletion only with a disposable staging identity and redacted retained records.
- [ ] Confirm review Telegram moderation against the same database used by the website.
- [ ] Capture accessibility smoke evidence on iOS/Android and desktop keyboard navigation.
- [ ] Revoke the one-push PAT used for this branch.

Local success does not change the deployment state. Keep status claims conservative until external telemetry exists and Preview/Production evidence is recorded.
