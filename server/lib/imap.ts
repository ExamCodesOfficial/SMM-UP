import { ImapFlow } from "imapflow";

export interface ParsedFamPayPayment {
  amount: number;
  utr?: string;
  transactionId?: string;
  purpose?: string;
  sender?: string;
  date?: Date;
}

export class PaymentMailboxUnavailableError extends Error {
  readonly code = "PAYMENT_MAILBOX_UNAVAILABLE";

  constructor(message = "Payment mailbox verification is unavailable") {
    super(message);
    this.name = "PaymentMailboxUnavailableError";
  }
}

export function decodeQuotedPrintable(str: string): string {
  if (!str) return "";
  const joined = str.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i += 1) {
    if (joined[i] === "=" && i + 2 < joined.length && /[0-9A-Fa-f]{2}/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i));
    }
  }
  try {
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return joined;
  }
}

function decodeEntityCodePoint(value: string, radix: number): string {
  const codePoint = Number.parseInt(value, radix);
  return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : " ";
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_match, value) => decodeEntityCodePoint(value, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) => decodeEntityCodePoint(value, 16))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function decodeBase64MimeBodies(source: string): string[] {
  const decodedParts: string[] = [];
  const marker = /content-transfer-encoding:[ \t]*base64[ \t]*\r?\n/gi;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(source)) && decodedParts.length < 12) {
    const markerEnd = match.index + match[0].length;
    const crlfHeaderEnd = source.indexOf("\r\n\r\n", markerEnd);
    const lfHeaderEnd = source.indexOf("\n\n", markerEnd);
    let bodyStart = -1;
    if (source.startsWith("\r\n", markerEnd)) {
      bodyStart = markerEnd + 2;
    } else if (source.startsWith("\n", markerEnd)) {
      bodyStart = markerEnd + 1;
    } else if (crlfHeaderEnd >= 0 && (lfHeaderEnd < 0 || crlfHeaderEnd <= lfHeaderEnd)) {
      bodyStart = crlfHeaderEnd + 4;
    } else if (lfHeaderEnd >= 0) {
      bodyStart = lfHeaderEnd + 2;
    }
    if (bodyStart < 0) continue;

    const nextBoundary = source.indexOf("\n--", bodyStart);
    const bodyEnd = nextBoundary >= 0 ? nextBoundary : source.length;
    const encoded = source.slice(bodyStart, bodyEnd).replace(/\s+/g, "");
    if (encoded.length < 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) continue;

    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      if (decoded.trim()) decodedParts.push(decoded);
    } catch {
      // Ignore a malformed MIME part and continue inspecting the message.
    }
  }

  return decodedParts;
}

/**
 * Converts raw RFC-822/MIME source into searchable receipt text. FamApp and
 * bank notifications have used plain text, quoted-printable HTML and base64
 * HTML at different times, so verification must handle all three forms.
 */
export function extractReceiptText(source: string): string {
  if (!source) return "";
  const decodedSegments = [source, decodeQuotedPrintable(source), ...decodeBase64MimeBodies(source)];
  return decodeHtmlEntities(decodedSegments.join("\n"))
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/tr|\/td|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(input: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function parseFamAppEmailBody(bodyText: string): ParsedFamPayPayment | null {
  const normalized = extractReceiptText(bodyText);
  if (!normalized) return null;
  const lowerBody = normalized.toLowerCase();

  // Reject outbound/debit-only notices. Receipt evidence must explicitly say
  // that money was received, credited, deposited or added.
  if (!/(?:received|credited|deposited|money\s+added|added\s+to)/i.test(lowerBody)) {
    return null;
  }

  const amountText = firstMatch(normalized, [
    /(?:received|credited|deposited|money\s+added|added\s+to)[^₹\d]{0,100}(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)[^₹\d]{0,100}(?:received|credited|deposited|added)/i,
    /(?:amount|payment\s+amount)\s*[:#-]?\s*(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  if (!amountText) return null;
  const amount = Number.parseFloat(amountText.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const utr = firstMatch(normalized, [
    /(?:UTR(?:\s*(?:No\.?|Number))?|RRN|UPI\s*(?:Ref(?:erence)?)(?:\s*(?:No\.?|Number))?|Bank\s*(?:Ref(?:erence)?)(?:\s*(?:No\.?|Number))?)\s*[:#-]?\s*(\d{12})\b/i,
    /(?:UPI|bank)\s+transaction\s+(?:reference|number)\s*[:#-]?\s*(\d{12})\b/i,
  ]);

  let transactionId = firstMatch(normalized, [
    /(?:transaction|txn)\s*(?:id|reference|ref(?:erence)?\s*(?:no\.?|number)?)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{7,39})\b/i,
    /\b(FMPIB[0-9A-Za-z]+)\b/i,
  ]);
  if (transactionId) transactionId = transactionId.replace(/[^A-Za-z0-9]/g, "");

  let purpose = firstMatch(normalized, [
    /\b(SUP[0-9A-Z]{5})\b/i,
    /(?:purpose|note|remark|remarks|message)\s*[:#-]?\s*([A-Za-z0-9_-]{3,40})\b/i,
  ]);
  if (purpose) purpose = purpose.toUpperCase();

  const sender = firstMatch(normalized, [
    /from\s+([A-Za-z][A-Za-z\s.]{1,80}?)(?:\s+(?:at|with|via|on|UTR|transaction|purpose)\b|[,.]|$)/i,
    /(?:sender|from\s+account)\s*[:#-]?\s*([A-Za-z][A-Za-z\s.]{1,80})/i,
  ]);

  return {
    amount,
    utr: utr || transactionId,
    transactionId,
    purpose,
    sender,
  };
}

function boundedScanLimit(): number {
  const configured = Number.parseInt(String(process.env.DIRECT_UPI_IMAP_SCAN_LIMIT || "40"), 10);
  return Number.isFinite(configured) ? Math.max(10, Math.min(configured, 100)) : 40;
}

/**
 * Website-side receipt verification. This executes inside the Vercel payment
 * API and never depends on the Railway Telegram bot or its worker process.
 */
export async function searchFamPayPayment(options: {
  identifier?: string;
  memo?: string;
  expectedAmount?: number;
  minDate?: Date;
  requireMemo?: boolean;
}): Promise<ParsedFamPayPayment | null> {
  const cleanIdentifier = String(options.identifier || "").replace(/[^A-Za-z0-9]/g, "");
  const cleanMemo = String(options.memo || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const primarySearch = cleanIdentifier || cleanMemo;
  if (!primarySearch || primarySearch.length < 5) return null;

  // Vercel uses the FAMPAY_* names. The IMAP_* fallback makes the website
  // resilient when the same mailbox naming is used across both deployments.
  const user = String(process.env.FAMPAY_EMAIL || process.env.IMAP_USER || "").trim();
  const pass = String(process.env.FAMPAY_APP_PASSWORD || process.env.IMAP_PASSWORD || "").replace(/\s+/g, "");
  const trustedSender = String(process.env.FAMPAY_SENDER_FILTER || "no-reply@famapp.in").trim().toLowerCase();
  if (!user || !pass) throw new PaymentMailboxUnavailableError("Payment mailbox credentials are not configured");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trustedSender)) {
    throw new PaymentMailboxUnavailableError("Payment sender filter is invalid");
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 14_000,
    clientInfo: { name: "SMMUP-Website-Settlement", version: "3.0.0" },
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new PaymentMailboxUnavailableError("Payment mailbox lookup timed out")),
      16_000,
    );
  });

  const searchExecution = async (): Promise<ParsedFamPayPayment | null> => {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const freshnessFloor = options.minDate
        ? new Date(options.minDate.getTime() - 5 * 60_000)
        : new Date(Date.now() - 6 * 60 * 60_000);

      // Fast path: ask Gmail for the exact UTR/transaction ID. Fallback: fetch
      // recent trusted-sender receipts because Gmail BODY search may not match a
      // value inside a base64 MIME part immediately.
      const exactCandidateIds: number[] = [];
      const exactTerms = [...new Set([cleanIdentifier, cleanMemo].filter((value) => value.length >= 5))];
      for (const term of exactTerms) {
        const exact = await client.search({ body: term, from: trustedSender, since: freshnessFloor });
        if (Array.isArray(exact)) exactCandidateIds.push(...exact.slice(-10));
      }
      const recent = await client.search({ from: trustedSender, since: freshnessFloor });
      const recentCandidateIds = Array.isArray(recent) ? recent.slice(-boundedScanLimit()) : [];

      // Preserve exact-search hits even when a high-volume mailbox has more
      // recent messages than the fallback scan limit.
      const uniqueIds = [...new Set([...exactCandidateIds, ...recentCandidateIds])].sort((left, right) => left - right);
      if (uniqueIds.length === 0) return null;

      const messages: any[] = [];
      for await (const message of client.fetch(uniqueIds, { source: true, envelope: true, internalDate: true })) {
        messages.push(message);
      }
      messages.sort((left, right) => {
        const rightDate = new Date(right.internalDate || right.envelope?.date || 0).getTime();
        const leftDate = new Date(left.internalDate || left.envelope?.date || 0).getTime();
        return rightDate - leftDate;
      });

      for (const message of messages) {
        if (!message?.source) continue;
        const envelopeSenders = (message.envelope?.from || [])
          .map((entry: any) => String(entry.address || "").trim().toLowerCase())
          .filter(Boolean);
        if (envelopeSenders.length !== 1 || envelopeSenders[0] !== trustedSender) continue;

        const emailDate = new Date(message.internalDate || message.envelope?.date || 0);
        const emailTime = emailDate.getTime();
        if (!Number.isFinite(emailTime) || emailTime > Date.now() + 5 * 60_000 || emailDate < freshnessFloor) continue;

        const rawContent = message.source.toString("utf8");
        const parsed = parseFamAppEmailBody(rawContent);
        if (!parsed) continue;
        parsed.date = emailDate;

        if (options.expectedAmount !== undefined && options.expectedAmount > 0) {
          if (Math.round(parsed.amount * 100) !== Math.round(options.expectedAmount * 100)) continue;
        }

        const cleanTarget = cleanIdentifier.toUpperCase();
        const matchesIdentifier = !cleanTarget || [parsed.utr, parsed.transactionId]
          .filter(Boolean)
          .some((value) => String(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase() === cleanTarget);
        if (!matchesIdentifier) continue;

        if (options.requireMemo && cleanMemo && String(parsed.purpose || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() !== cleanMemo) {
          continue;
        }

        return parsed;
      }

      return null;
    } finally {
      lock.release();
    }
  };

  try {
    return await Promise.race([searchExecution(), timeoutPromise]);
  } catch (error: any) {
    console.error("Website payment mailbox lookup failed:", error?.message || error);
    if (error?.code === "PAYMENT_MAILBOX_UNAVAILABLE") throw error;
    throw new PaymentMailboxUnavailableError();
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await client.logout().catch(() => {});
  }
}

export async function searchFamPayEmailByUTR(utr: string): Promise<ParsedFamPayPayment | null> {
  return searchFamPayPayment({ identifier: utr });
}
