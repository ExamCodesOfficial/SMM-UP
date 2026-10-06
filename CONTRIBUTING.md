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
