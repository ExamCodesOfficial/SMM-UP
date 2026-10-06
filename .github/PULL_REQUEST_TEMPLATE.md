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
