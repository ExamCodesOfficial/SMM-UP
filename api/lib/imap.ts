import { ImapFlow } from "imapflow";

export interface ParsedFamPayPayment {
  amount: number;
  utr?: string;
  transactionId?: string;
  purpose?: string;
  sender?: string;
  date?: Date;
  rawSnippet?: string;
}

export function decodeQuotedPrintable(str: string): string {
  if (!str) return "";
  const joined = str.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && i + 2 < joined.length && /[0-9A-Fa-f]{2}/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i));
    }
  }
  try {
    return Buffer.from(bytes).toString("utf-8");
  } catch {
    return joined;
  }
}

export function parseFamAppEmailBody(bodyText: string): ParsedFamPayPayment | null {
  if (!bodyText) return null;

  // 1. Decode quoted-printable and normalize whitespace
  const decoded = decodeQuotedPrintable(bodyText);
  const normalized = decoded.replace(/\xa0/g, " ").replace(/\r/g, "");
  const lowerBody = normalized.toLowerCase();

  // Guard: Must indicate incoming/received funds
  if (!lowerBody.includes("received") && !lowerBody.includes("credited") && !lowerBody.includes("added")) {
    return null;
  }

  // 2. Match Amount: "received ₹45.0" or "received 100" or "₹ 500" or "₹45.0"
  let amountMatch = normalized.match(/received\s*(?:₹|Rs\.?|INR)?\s*([\d.]+)/i);
  if (!amountMatch) {
    amountMatch = normalized.match(/(?:₹|Rs\.?|INR)\s*([\d.]+)/i);
  }
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // 3. Match 12-Digit Numeric UTR (e.g. "UTR: 627636256497" or "UTR :</td><td>627636256497")
  let utr: string | undefined = undefined;
  const utrMatch = normalized.match(/UTR\s*[:\s<>\/a-zA-Z="'-]*?(\d{12})/i);
  if (utrMatch) {
    utr = utrMatch[1].trim();
  }

  // 4. Match FamPay Transaction ID (e.g. "transaction id FMPIB6718103285" or "Transaction ID :</td><td>FMPIB...")
  let transactionId: string | undefined = undefined;
  const txMatch = normalized.match(/transaction\s+id\s*[:\s<>\/a-zA-Z="'-]*?([A-Za-z0-9]{8,30})/i);
  if (txMatch) {
    transactionId = txMatch[1].trim();
  } else {
    // Direct match for FMPIB prefix
    const fmpMatch = normalized.match(/\b(FMPIB[0-9A-Za-z]+)\b/i);
    if (fmpMatch) {
      transactionId = fmpMatch[1].trim();
    }
  }

  // 5. Match Dynamic Purpose / Memo (e.g. "Purpose : SUP7K9X2" or embedded memo "SUP[0-9A-Z]{5}")
  let purpose: string | undefined = undefined;
  const memoMatch = normalized.match(/\b(SUP[0-9A-Z]{5})\b/i);
  if (memoMatch) {
    purpose = memoMatch[1].trim().toUpperCase();
  } else {
    const purposeTextMatch = normalized.match(/Purpose\s*[:\s<>\/a-zA-Z="'-]*?([A-Za-z0-9_-]+)/i);
    if (purposeTextMatch) {
      purpose = purposeTextMatch[1].trim().toUpperCase();
    }
  }

  // 6. Match Sender Name: "from Mr AMAN KUMAR SHARMA at" or "from <span>Mr AMAN..."
  let sender: string | undefined = undefined;
  const senderMatch = normalized.match(/from\s*(?:<[^>]+>)?\s*([A-Za-z\s.]+?)(?:<|\s+at|\s+with|\s+via|\.|$)/i);
  if (senderMatch) {
    sender = senderMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // Fallback: If no banking UTR but transaction ID is present, we use transaction ID as reference
  if (!utr && transactionId) {
    utr = transactionId;
  }

  return {
    amount,
    utr,
    transactionId,
    purpose,
    sender,
    rawSnippet: normalized.replace(/\s+/g, " ").slice(0, 300),
  };
}

/**
 * Universal FamPay / Bank IMAP search:
 * Finds incoming payment by:
 * - 12-digit UTR
 * - FamPay Transaction ID (FMPIB...)
 * - Dynamic QR Memo (SUP...)
 * - Any bank reference ID
 */
export async function searchFamPayPayment(options: {
  identifier?: string;
  memo?: string;
  expectedAmount?: number;
  minDate?: Date;
}): Promise<ParsedFamPayPayment | null> {
  const searchTerm = (options.memo || options.identifier || "").trim();
  if (!searchTerm) return null;

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
      let matchingSeqNumbers: number[] = [];

      // 1. Search with sender filter first (faster and cleaner)
      const senderFilter = process.env.FAMPAY_SENDER_FILTER || "no-reply@famapp.in";
      const primaryResults = await client.search({
        body: searchTerm,
        from: senderFilter,
      });

      if (Array.isArray(primaryResults) && primaryResults.length > 0) {
        matchingSeqNumbers = primaryResults;
      } else {
        // Fallback: search across all incoming bank emails
        const fallbackResults = await client.search({ body: searchTerm });
        if (Array.isArray(fallbackResults) && fallbackResults.length > 0) {
          matchingSeqNumbers = fallbackResults;
        }
      }

      if (matchingSeqNumbers.length === 0) {
        return null;
      }

      // Check newest matching messages first (reverse order)
      const recentSeq = matchingSeqNumbers.slice(-3).reverse();

      for (const seq of recentSeq) {
        const message = await client.fetchOne(seq, {
          source: true,
          envelope: true,
        });

        if (!message || !message.source) continue;

        const rawContent = message.source.toString("utf-8");
        const parsed = parseFamAppEmailBody(rawContent);

        if (!parsed) continue;

        const emailDate = message.envelope?.date ? new Date(message.envelope.date) : new Date();
        parsed.date = emailDate;

        // Date Freshness Validation:
        // If minDate is provided, email must have arrived after minDate (with 2 min clock drift buffer)
        // and cannot be older than 3 hours
        if (options.minDate) {
          const bufferMin = new Date(options.minDate.getTime() - 2 * 60 * 1000);
          if (emailDate < bufferMin) {
            continue;
          }
        } else {
          // Default guard: must be within last 3 hours
          const maxAgeMs = 3 * 60 * 60 * 1000;
          if (Date.now() - emailDate.getTime() > maxAgeMs) {
            continue;
          }
        }

        // Amount Validation:
        if (options.expectedAmount !== undefined && options.expectedAmount > 0) {
          if (Math.abs(parsed.amount - options.expectedAmount) > 0.05) {
            // Amount mismatch
            continue;
          }
        }

        // Identifier Match Validation:
        const cleanTarget = searchTerm.toUpperCase();
        const matchesUtr = parsed.utr && parsed.utr.toUpperCase() === cleanTarget;
        const matchesTx = parsed.transactionId && parsed.transactionId.toUpperCase() === cleanTarget;
        const matchesMemo = parsed.purpose && parsed.purpose.toUpperCase() === cleanTarget;
        const matchesRaw = rawContent.toUpperCase().includes(cleanTarget);

        if (matchesUtr || matchesTx || matchesMemo || matchesRaw) {
          return parsed;
        }
      }

      return null;
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("IMAP universal search error:", err);
    return null;
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

/**
 * Backward compatibility wrapper for searchFamPayEmailByUTR
 */
export async function searchFamPayEmailByUTR(utr: string): Promise<ParsedFamPayPayment | null> {
  return searchFamPayPayment({ identifier: utr });
}
