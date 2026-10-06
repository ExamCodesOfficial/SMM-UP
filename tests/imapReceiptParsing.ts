import assert from "node:assert/strict";
import {
  classifyPaymentReceiptLookup,
  extractReceiptText,
  parseFamAppEmailBody,
  paymentReceiptMatchesIdentifier,
} from "../server/lib/imap.js";

function mimeBase64(html: string) {
  const encoded = Buffer.from(html, "utf8").toString("base64").match(/.{1,72}/g)?.join("\r\n") || "";
  return [
    "From: FamApp <no-reply@famapp.in>",
    "Subject: Payment received",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encoded,
  ].join("\r\n");
}

const quotedPrintableReceipt = [
  "From: FamApp <no-reply@famapp.in>",
  "Subject: Money received",
  "Content-Type: text/html; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "<html><body>You received =E2=82=B9100.00 from TEST PAYER<br>",
  "UTR : 627636256497<br>Transaction ID: FMPIB6718103285<br>",
  "Purpose : SUP7K9X2</body></html>",
].join("\r\n");

const quotedParsed = parseFamAppEmailBody(quotedPrintableReceipt);
assert.ok(quotedParsed);
assert.equal(quotedParsed.amount, 100);
assert.equal(quotedParsed.utr, "627636256497");
assert.equal(quotedParsed.transactionId, "FMPIB6718103285");
assert.equal(quotedParsed.purpose, "SUP7K9X2");
assert.match(quotedParsed.sender || "", /TEST PAYER/i);

const base64Receipt = mimeBase64(`
  <html><body>
    <h1>₹1,250.50 has been credited to your account</h1>
    <table>
      <tr><td>UPI Reference Number</td><td>654862319655</td></tr>
      <tr><td>Transaction ID</td><td>FMPIB6043122105</td></tr>
      <tr><td>Remarks</td><td>SUPA1B2C</td></tr>
      <tr><td>From</td><td>EXACT PAYER</td></tr>
    </table>
  </body></html>
`);
assert.match(extractReceiptText(base64Receipt), /654862319655/);
const base64Parsed = parseFamAppEmailBody(base64Receipt);
assert.ok(base64Parsed);
assert.equal(base64Parsed.amount, 1250.5);
assert.equal(base64Parsed.utr, "654862319655");
assert.equal(base64Parsed.transactionId, "FMPIB6043122105");
assert.equal(base64Parsed.purpose, "SUPA1B2C");

// Sanitized form of FamApp's current multipart receipt wording. The payer app
// can replace the QR note with "Paid via CRED"; that generic text must never be
// invented into the server-generated SUP binding.
const currentFamAppReceipt = [
  "From: FamApp <no-reply@famapp.in>",
  "Subject: =?UTF-8?Q?You_received_=E2=82=B91.07_in_your_FamX_account?=",
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "You have successfully received =E2=82=B91.07 from REDACTED PAYER at 06:29 PM IST",
  "with transaction id FMPIB6043122105. Your updated balance is =E2=82=B99.99.",
  "UTR: 999999999999. Purpose: Paid via CRED.",
].join("\r\n");
const currentParsed = parseFamAppEmailBody(currentFamAppReceipt);
assert.ok(currentParsed);
assert.equal(currentParsed.amount, 1.07);
assert.equal(currentParsed.utr, "999999999999");
assert.equal(currentParsed.transactionId, "FMPIB6043122105");
assert.equal(currentParsed.purpose, undefined, "generic payer-app text is not an order-binding SUP reference");
assert.equal(paymentReceiptMatchesIdentifier(currentParsed, "999999999999"), true);
assert.equal(paymentReceiptMatchesIdentifier(currentParsed, "FMPIB6043122105"), true);
assert.equal(paymentReceiptMatchesIdentifier(currentParsed, "999999999998"), false);

const alternateUtrLabels = [
  "You received INR 22.00. UPI Ref ID: 623456789012.",
  "Money credited: Rs. 22.00. UTR ID # 623456789013.",
  "Deposited ₹22.00. Reference Number: 623456789014.",
];
assert.equal(parseFamAppEmailBody(alternateUtrLabels[0])?.utr, "623456789012");
assert.equal(parseFamAppEmailBody(alternateUtrLabels[1])?.utr, "623456789013");
assert.equal(parseFamAppEmailBody(alternateUtrLabels[2])?.utr, "623456789014");

assert.equal(classifyPaymentReceiptLookup(0, 0), "no_trusted_receipts");
assert.equal(classifyPaymentReceiptLookup(2, 0), "trusted_receipts_unreadable");
assert.equal(classifyPaymentReceiptLookup(2, 2), "identifier_not_found");

const rrnReceipt = `Money credited. Amount: INR 75.00. RRN # 606839321030. Note: SUPZ9Y8X.`;
const rrnParsed = parseFamAppEmailBody(rrnReceipt);
assert.ok(rrnParsed);
assert.equal(rrnParsed.amount, 75);
assert.equal(rrnParsed.utr, "606839321030");
assert.equal(rrnParsed.purpose, "SUPZ9Y8X");

const noMemoReceipt = `You received Rs. 40 from A PAYER. UTR Number: 612906704759.`;
const noMemoParsed = parseFamAppEmailBody(noMemoReceipt);
assert.ok(noMemoParsed);
assert.equal(noMemoParsed.utr, "612906704759");
assert.equal(noMemoParsed.purpose, undefined, "missing memo must remain explicit for reconciliation instead of being invented");

assert.equal(
  parseFamAppEmailBody("You paid ₹100. UTR: 627636256497. Purpose: SUP7K9X2"),
  null,
  "outgoing/debit notices must never be treated as incoming receipt evidence",
);
assert.equal(
  parseFamAppEmailBody("Money received. UTR: 627636256497. Purpose: SUP7K9X2"),
  null,
  "receipt evidence without an amount must fail closed",
);

console.log("MIME, current FamApp wording, alternate-reference, identifier, and failure-class receipt checks passed.");
