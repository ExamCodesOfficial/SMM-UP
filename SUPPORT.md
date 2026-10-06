# Support Policy

## Customer support

Use the official SMM UP support route:

- `https://smmup.co.in/support`

GitHub issues are not an account-support or payment-reconciliation channel.

## Repository support

Authorized collaborators may use repository issues for reproducible code, documentation, build or deployment defects that contain no secrets or unnecessary personal data.

Do not post:

- passwords, API keys, session cookies or authorization headers;
- provider, database, bot, email or deployment credentials;
- email verification/recovery/Support Access codes;
- UPI PIN, OTP, CVV or banking password;
- complete receipts or mailbox messages;
- full user account/payment details or social-media targets;
- private pricing values.

For a vulnerability, follow [`SECURITY.md`](SECURITY.md) and report privately.

## Operational evidence

When reporting a non-security operational defect, prefer:

- source commit and deployment ID;
- environment name without values;
- timestamp and bounded internal/public record IDs;
- expected versus observed state;
- redacted error category;
- whether any financial mutation committed.

A browser success screen or Telegram message is not authoritative financial evidence. Use transaction, ledger, provider and audit state during reconciliation.

## Customer triage

| Issue | Ask for | Never ask for |
|---|---|---|
| Sign-in | username/email, timestamp, displayed error | password, session cookie, email token |
| Order | internal order ID, service ID, approximate time | social password or private account access |
| Direct UPI | pending transaction ID, memo, UTR/reference, amount/time | UPI PIN, OTP, bank password, full statement |
| Razorpay | internal transaction ID and provider order/payment ID | CVV, OTP, card number |
| API | named key ID/hint, action, HTTP status, request timestamp | raw API secret or Authorization header |
| Support Access | code status and owner reason | customer password or reusable session token |

Support must distinguish “request accepted,” “provider accepted,” “wallet settled,” and “reconciled final state.” Do not promise a refund, credit or cancellation before authoritative ledger/provider evidence is reviewed.

## Escalation

- Authentication-wide `500`/`503`: verify deployment environment and `JWT_SECRET` length, then deployment logs.
- Unknown supplier submission after wallet debit: do not reorder; escalate the internal order for owner reconciliation.
- Duplicate/uncertain payment evidence: place or preserve holds and compare exact pending/provider/ledger identities.
- Suspected security issue or credential exposure: stop normal support handling and follow `SECURITY.md` plus the incident runbook.

No public response-time, 24/7 availability or instant-resolution guarantee is made.

## Full-audit support handling additions

### Cancellation requests

Describe cancellation precisely: the website submits a request to the supplier when the service/order state allows it. A request is not a guarantee of cancellation, refund or timing. Record the local order ID and latest supplier status; do not tell the user to duplicate the order while submission/state is uncertain.

### Safe reorder and templates

Reorder, favourites and templates restore only a current service selection and possibly a saved quantity. They intentionally never restore target links, usernames or comments. Ask the user to enter the current public target again and to review the live min/max/rate before submitting.

### Profile and deletion

Profile editing and self-service deletion require the current permanent password. Support Access cannot perform either mutation. Deletion is blocked for wallet funds, active orders or pending deposits; direct the user through settlement first without asking for OTP, PIN, CVV or banking credentials. Explain that public identity/targets are erased or pseudonymized while necessary financial/operational evidence may be retained. Deletion cannot recover old API secrets or passwords.

### Payment-range issues

Ask which payment method and amount was selected. Compare only with the server-returned range shown in Add Funds. Never invent a maximum from documentation or request sensitive bank credentials. If configuration cannot load, collect timestamp/browser and escalate the availability issue; do not tell the user to bypass the disabled method.
