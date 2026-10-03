import { ImapFlow } from "imapflow";

export interface ParsedFamPayPayment {
  amount: number;
  utr: string;
  transactionId?: string;
  purpose?: string;
  date?: Date;
}

export function parseFamAppEmailBody(bodyText: string): ParsedFamPayPayment | null {
  if (!bodyText) return null;

  // Normalize whitespace
  const normalized = bodyText.replace(/\xa0/g, " ").replace(/\r/g, "");
  const lowerBody = normalized.toLowerCase();

  // Guard: Must indicate incoming/received funds
  if (!lowerBody.includes("received") && !lowerBody.includes("credited") && !lowerBody.includes("added")) {
    return null;
  }

  // 1. Match Amount: "received ₹250.00" or "received 100" or "₹ 500"
  let amountMatch = normalized.match(/received\s*(?:₹|Rs\.|INR)?\s*([\d.]+)/i);
  if (!amountMatch) {
    amountMatch = normalized.match(/(?:₹|Rs\.|INR)\s*([\d.]+)/i);
  }
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // 2. Match 12-Digit UTR: "UTR: 423985123456"
  const utrMatch = normalized.match(/UTR\s*:\s*(\d{12})/i);
  const utr = utrMatch ? utrMatch[1].trim() : null;
  if (!utr) return null;

  // 3. Match Transaction ID: "transaction id FMPIB6455369749"
  const txMatch = normalized.match(/transaction\s+id\s*:?\s*([A-Za-z0-9]+)/i);
  const transactionId = txMatch ? txMatch[1].trim() : undefined;

  // 4. Match Purpose / Note
  const purposeMatch = normalized.match(/Purpose\s*:\s*(.*?)(?:\.\s*If this was not done|\.\s*If|\.\n|$)/is);
  const purpose = purposeMatch ? purposeMatch[1].trim() : undefined;

  return {
    amount,
    utr,
    transactionId,
    purpose,
  };
}

export async function searchFamPayEmailByUTR(utr: string): Promise<ParsedFamPayPayment | null> {
  const cleanUtr = String(utr).trim();
  if (!/^\d{12}$/.test(cleanUtr)) {
    return null;
  }

  const user = process.env.FAMPAY_EMAIL || "***REMOVED_SETTLEMENT_EMAIL***";
  const pass = (process.env.FAMPAY_APP_PASSWORD || "***REMOVED_APP_PASSWORD***").replace(/\s+/g, "");

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      let targetSeq: number | null = null;

      // 1. Direct search by UTR text in the body with sender filter
      const searchResults = await client.search({
        body: cleanUtr,
        from: process.env.FAMPAY_SENDER_FILTER || "no-reply@famapp.in",
      });

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        targetSeq = searchResults[searchResults.length - 1];
      } else {
        // Fallback: search just by body across any sender filter
        const fallbackResults = await client.search({ body: cleanUtr });
        if (Array.isArray(fallbackResults) && fallbackResults.length > 0) {
          targetSeq = fallbackResults[fallbackResults.length - 1];
        }
      }

      if (!targetSeq) return null;

      // Fetch the newest matching message
      const message = await client.fetchOne(targetSeq, {
        source: true,
        bodyStructure: true,
        envelope: true,
      });

      if (!message || !message.source) return null;

      const rawContent = message.source.toString("utf-8");
      const parsed = parseFamAppEmailBody(rawContent);

      if (parsed && parsed.utr === cleanUtr) {
        parsed.date = message.envelope?.date;
        return parsed;
      }

      return null;
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("IMAP search error:", err);
    return null;
  } finally {
    try {
      await client.logout();
    } catch (e) {}
  }
}
