import assert from "node:assert/strict";
import { extractReceiptText, parseFamAppEmailBody } from "../server/lib/imap.js";

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

console.log("Plain, quoted-printable, base64, alternate-reference, and fail-closed receipt parsing checks passed.");
