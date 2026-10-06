# Internal Contribution Guide

This is a private proprietary project. Contributions are accepted only from explicitly authorized collaborators. No source-use license is granted to outside viewers.

## Before changing code

1. Confirm the issue/scope and security owner.
2. Work on a dedicated branch; do not develop directly on protected `master`.
3. Read `HANDOVER.md` and the relevant architecture document.
4. Identify authentication, authorization, financial, provider, schema and retention impact.
5. Never copy production credentials or personal/payment data into local fixtures.

## Change rules

- Keep changes focused and reviewable.
- Preserve product invariants unless an explicit decision reverses them.
- Do not disclose private pricing configuration.
- Do not add a website admin panel.
- Do not retrieve/read permanent passwords or old API secrets.
- Do not weaken unique indexes, idempotency or transactions to make a test pass.
- Do not add dependency packages without explaining need, maintenance and security impact.
- Update source, tests, architecture registry and runbook together when behavior changes.
- Separate mechanical refactors from behavior changes wherever possible.

## Commit and pull-request structure

Prefer small commits with clear categories such as:

```text
refactor(bot): isolate settlement worker
fix(auth): reject expired support session
feat(api-keys): add reviewed capability
security(payments): harden replay boundary
docs: update deployment evidence
```

A pull request must state:

- what changed and what deliberately did not;
- trust boundaries affected;
- database/index/environment changes;
- tests and provider checks run;
- rollback and reconciliation impact;
- documentation updated;
- any remaining staging/production gates.

## Validation

For root changes:

```bash
npm ci
npm run typecheck
npm run build
npm run test:search-appearance
# Run every relevant replica-set suite sequentially.
npm audit --omit=dev
```

For bot changes:

```bash
cd admin-bot
npm ci
npx tsc --noEmit
npm run test:admin-actions
npm audit --omit=dev
```

Always run:

```bash
git diff --check
git status --short
```

Inspect the final staged diff and run current-tree/history credential-pattern checks before commit or authorized push.

## Sensitive changes

Authentication, session, recovery, Support Access, API-key, wallet, order, payment, Telegram authorization, worker lease and index changes require:

- negative authorization tests;
- replay/concurrency tests where applicable;
- rollback/reconciliation analysis;
- secret/logging review;
- staging evidence before production.

## Documentation

Update the relevant files:

- `architecture/website-architecture.md` for website/API/data changes;
- `architecture/bot-architecture.md` for Telegram/Railway changes;
- `architecture/full-architecture.md` for cross-system changes;
- operational runbooks for deployment, environment, rollback or incident changes;
- root/admin README for setup or command changes.

Do not pad capability registries with duplicates or speculative behavior.

## Pushes and deployments

A push or deployment requires separate explicit authorization. Use an ephemeral least-privilege credential, never persist it in Git configuration/URLs/files/history, verify the target commit, and revoke it immediately afterward.

## API and order-safety review

For any `/api` or supplier-order change, reviewers must answer:

1. Which authentication model and ownership boundary applies?
2. Can a timeout occur after a durable mutation?
3. Is caller retry safe, unsafe or conditionally idempotent?
4. Which local/provider identifiers must be retained for reconciliation?
5. Are response and provider-error bodies bounded and sanitized?
6. Does the browser parse non-JSON and oversized responses safely?
7. Did `API_REFERENCE.md`, customer-facing `/api`, architecture and tests change together?

Never convert an ambiguous supplier outcome into an automatic refund or blind resubmission. The provider call is outside MongoDB; preserve the local order and escalate reconciliation.

## GitHub Actions policy

Workflows must use explicit `workflow_dispatch` only. Do not add `push`, `pull_request`, schedules or other automatic triggers without a new owner decision. If a credential lacks workflow scope, do not weaken, delete or bypass the intended manual-only workflow to force a push. Keep the workflow change isolated and report the scope limitation.

## Complete release command set

Run the relevant commands sequentially in constrained environments, including `npm run test:order-reservations`. A green build does not replace provider staging, and an audit result is time-bound to the resolved lockfile.

## Audit-remediation regression checklist

When changing routing, authentication, account, review, payment or order-history code, include all applicable evidence below:

1. compare `TAB_PATHS` with explicit Vercel rewrites and prove there is no universal SPA catch-all;
2. test a real unknown deployment path separately from the in-app not-found component;
3. prove guarded pages do not render protected metadata/content before `/api/auth/me` resolves;
4. prove URL credentials are scrubbed before reset/email-change network activity;
5. exercise keyboard-only open, focus trap, Escape close and opener-focus restoration for modal navigation;
6. validate loading, first-use empty, filter miss and API failure as different UI states;
7. verify payment methods are disabled outside their server-returned bounds;
8. prove reorder/templates do not retain targets, usernames or comments;
9. run account-erasure tests against a MongoDB replica set, including session/key revocation and target removal;
10. preserve the supplied static 404 unchanged unless the owner explicitly requests design changes.

The manual browser suite is intentionally separate from TypeScript and integration tests. Start Vite on port 3000, install the Playwright Chromium runtime, then run `node tests/manualBrowserAudit.mjs`. A moving/animated control may require programmatic activation in the test; do not disable production motion merely to satisfy Playwright's stationary-element heuristic.
