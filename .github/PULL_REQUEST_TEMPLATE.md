## Summary

Describe the change and the problem it solves.

## Scope boundaries

- What changed:
- What deliberately did not change:
- User/admin behavior affected:

## Security and data

- [ ] Authentication/authorization impact reviewed
- [ ] Financial/idempotency/concurrency impact reviewed
- [ ] Secret, logging and Telegram-output boundaries reviewed
- [ ] Personal/payment-data minimization reviewed
- [ ] MongoDB collection/index/retention impact documented
- [ ] Environment-variable changes documented without values

## Validation

List exact commands and staging/provider checks run:

```text
commands/evidence here
```

- [ ] Relevant TypeScript/build checks passed
- [ ] Relevant replica-set tests passed sequentially
- [ ] Dependency audit reviewed
- [ ] `git diff --check` passed
- [ ] Current-tree/history credential-pattern checks passed

## Deployment and rollback

- Deployment order:
- Rollback target:
- Data/provider reconciliation required:
- Remaining staging/production gates:

## Documentation

- [ ] Root/admin README updated when setup or commands changed
- [ ] Specialized and full architecture registries updated
- [ ] Runbooks updated for environment/deployment/failure changes

## Sensitive-content confirmation

- [ ] This pull request contains no credentials, raw tokens, private pricing, complete receipts or unnecessary user/payment data

## API and retry contract

- [ ] Every changed endpoint has method, auth, ownership, input, output and error behavior documented
- [ ] Timeout/retry behavior is explicit; ambiguous supplier mutations are not blindly retried/refunded
- [ ] Browser/API response parsing is bounded and non-JSON-safe
- [ ] Customer `/api` docs and `API_REFERENCE.md` agree with source
- [ ] Public copy avoids unsupported timing, availability, support and refund promises

## Provider and environment evidence

- Vercel/Railway variable names added or removed:
- Provider dashboard/configuration change:
- Database migration/index precondition:
- Manual-only workflow policy preserved: [ ]
- Production evidence still pending:

## Full-audit regression gate

- [ ] Auth/reset/verification secrets are copied to memory and removed from the URL before any request
- [ ] Guarded routes wait for session resolution and accept only allowlisted `next` destinations
- [ ] Every known SPA path is explicit in `vercel.json`; an unknown path returns the static HTTP 404
- [ ] Mobile modal navigation traps/restores focus, closes on Escape and inerts the background
- [ ] Async errors use alert semantics; non-urgent success/progress uses polite status semantics
- [ ] Payment amount bounds come from authenticated server configuration; no environment-dependent browser maximum was added
- [ ] Reorder/templates preserve only safe service identity and optional quantity, never targets or comments
- [ ] Review-list reads perform no seed or moderation write; review moderation remains Telegram-only
- [ ] Account deletion requires reauthentication, exact-name confirmation, settlement checks and session/key revocation
- [ ] `public/404.html` remains `noindex,nofollow`, self-contained and present byte-for-byte in the production build
- [ ] Browser smoke covers public routes, guarded redirect metadata, token scrubbing, mobile dialog behavior and key authenticated pages
