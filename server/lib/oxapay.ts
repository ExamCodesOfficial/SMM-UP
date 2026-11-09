import crypto from "crypto";

/**
 * OxaPay — crypto payment gateway client.
 *
 * The Merchant API Key doubles as the HMAC-SHA512 secret for the `HMAC`
 * webhook header. It is never sent to the browser and never placed in a URL.
 *
 * Two provider quirks are handled defensively here:
 *   1. The webhook reports `status` capitalised ("Paid", "Paying") while
 *      GET /payment/{track_id} reports it lower-case ("paid"). Every status
 *      comparison in this codebase goes through `normalizeOxaPayStatus`.
 *   2. The documented `payment_url` uses an http:// scheme. We force https and
 *      pin the host so a spoofed response cannot become an open redirect.
 */

const OXAPAY_BASE = "https://api.oxapay.com/v1";
const OXAPAY_ALLOWED_HOSTS = ["pay.oxapay.com", "oxapay.com"];

export type OxaPayStatus =
  | "new"
  | "waiting"
  | "paying"
  | "paid"
  | "manual_accept"
  | "underpaid"
  | "refunding"
  | "refunded"
  | "expired";

export interface OxaPayTransaction {
  txHash: string;
  status: string;
  currency: string | null;
  network: string | null;
  amount: number | null;
  sentAmount: number | null;
  receivedAmount: number | null;
  rate: number | null;
  confirmations: number | null;
  address: string | null;
}

export interface OxaPayInvoice {
  trackId: string;
  paymentUrl: string;
  expiresAt: number | null;
  date: number | null;
}

export interface OxaPayPaymentInfo {
  trackId: string;
  status: OxaPayStatus;
  amount: number | null;
  currency: string | null;
  orderId: string | null;
  email: string | null;
  expiredAt: number | null;
  transactions: OxaPayTransaction[];
}

export class OxaPayApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "OxaPayApiError";
    this.status = status;
  }
}

export function hasOxaPayConfig(): boolean {
  return Boolean(String(process.env.OXAPAY_MERCHANT_API_KEY || "").trim());
}

export function getOxaPayConfig(): { merchantApiKey: string; sandbox: boolean } {
  const merchantApiKey = String(process.env.OXAPAY_MERCHANT_API_KEY || "").trim();
  if (!merchantApiKey) {
    throw new OxaPayApiError("Crypto payments are not configured.", 503);
  }
  if (merchantApiKey.length < 16) {
    throw new OxaPayApiError("Crypto payment configuration is invalid.", 503);
  }
  const mode = String(process.env.OXAPAY_MODE || "live").trim().toLowerCase();
  return { merchantApiKey, sandbox: mode === "sandbox" || mode === "test" };
}

function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!expectedHex || !receivedHex) return false;
  if (expectedHex.length !== receivedHex.length) return false;
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/** Webhook statuses arrive capitalised; the REST endpoint returns them lower-case. */
export function normalizeOxaPayStatus(value: unknown): OxaPayStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  const known: OxaPayStatus[] = [
    "new", "waiting", "paying", "paid", "manual_accept",
    "underpaid", "refunding", "refunded", "expired",
  ];
  return (known as string[]).includes(raw) ? (raw as OxaPayStatus) : "new";
}

export function isOxaPayTrackId(value: unknown): boolean {
  return typeof value === "string" && /^\d{1,32}$/.test(value.trim());
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function cleanText(value: unknown, maxLength = 300): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

/**
 * Validates a provider-supplied payment URL before we redirect a customer to
 * it. Only https and only an OxaPay-owned host are accepted.
 */
export function normalizeOxaPayPaymentUrl(value: unknown): string | null {
  const raw = cleanText(value, 500);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.startsWith("http://") ? `https://${raw.slice("http://".length)}` : raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed = OXAPAY_ALLOWED_HOSTS.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  if (!allowed) return null;
  return url.toString();
}

export async function createOxaPayInvoice(input: {
  amount: number;
  currency: string;
  orderId: string;
  callbackUrl: string;
  returnUrl: string;
  email?: string;
  lifetimeMinutes: number;
  feePaidByPayer: 0 | 1;
  underPaidCoverage: number;
  sandbox: boolean;
}): Promise<OxaPayInvoice> {
  const { merchantApiKey } = getOxaPayConfig();

  const response = await fetch(`${OXAPAY_BASE}/payment/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      merchant_api_key: merchantApiKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      lifetime: input.lifetimeMinutes,
      fee_paid_by_payer: input.feePaidByPayer,
      under_paid_coverage: input.underPaidCoverage,
      to_currency: String(process.env.OXAPAY_SETTLE_CURRENCY || "USDT"),
      auto_withdrawal: false,
      mixed_payment: true,
      callback_url: input.callbackUrl,
      return_url: input.returnUrl,
      order_id: input.orderId,
      description: `SMM UP wallet top-up ${input.orderId}`,
      thanks_message: "Thank you. Your SMM UP wallet is credited automatically.",
      ...(input.email ? { email: input.email } : {}),
      sandbox: input.sandbox,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.status !== 200 || !payload?.data) {
    const message = cleanText(payload?.error?.message, 240) || cleanText(payload?.message, 240);
    throw new OxaPayApiError(
      message || "Crypto payment could not be started. Please try again.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  const trackId = cleanText(payload.data.track_id, 64);
  const paymentUrl = normalizeOxaPayPaymentUrl(payload.data.payment_url);
  if (!trackId || !isOxaPayTrackId(trackId) || !paymentUrl) {
    throw new OxaPayApiError("Crypto payment returned an invalid invoice.", 502);
  }

  return {
    trackId,
    paymentUrl,
    expiresAt: toFiniteNumber(payload.data.expired_at),
    date: toFiniteNumber(payload.data.date),
  };
}

export async function fetchOxaPayPayment(trackId: string): Promise<OxaPayPaymentInfo> {
  const { merchantApiKey } = getOxaPayConfig();
  if (!isOxaPayTrackId(trackId)) {
    throw new OxaPayApiError("Invalid crypto invoice reference.", 400);
  }

  const response = await fetch(`${OXAPAY_BASE}/payment/${encodeURIComponent(trackId)}`, {
    headers: { "Content-Type": "application/json", merchant_api_key: merchantApiKey },
    signal: AbortSignal.timeout(12_000),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.data) {
    const message = cleanText(payload?.error?.message, 240);
    throw new OxaPayApiError(
      message || "Crypto payment verification failed.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  const data = payload.data;
  const rawTxs = Array.isArray(data.txs) ? data.txs : [];
  const transactions: OxaPayTransaction[] = rawTxs.map((tx: any) => ({
    txHash: cleanText(tx?.tx_hash, 200) || "",
    status: cleanText(tx?.status, 40) || "unknown",
    currency: cleanText(tx?.currency, 20),
    network: cleanText(tx?.network, 80),
    amount: toFiniteNumber(tx?.amount ?? tx?.value),
    sentAmount: toFiniteNumber(tx?.sent_amount),
    receivedAmount: toFiniteNumber(tx?.received_amount),
    rate: toFiniteNumber(tx?.rate),
    confirmations: toFiniteNumber(tx?.confirmations),
    address: cleanText(tx?.address, 200),
  })).filter((tx: OxaPayTransaction) => Boolean(tx.txHash));

  return {
    trackId: cleanText(data.track_id, 64) || trackId,
    status: normalizeOxaPayStatus(data.status),
    amount: toFiniteNumber(data.amount),
    currency: cleanText(data.currency, 20),
    orderId: cleanText(data.order_id, 120),
    email: cleanText(data.email, 200),
    expiredAt: toFiniteNumber(data.expired_at),
    transactions,
  };
}

/** Fiat currencies OxaPay can invoice in — this decides whether we can bill in INR. */
export async function fetchOxaPaySupportedFiats(): Promise<string[]> {
  const { merchantApiKey } = getOxaPayConfig();
  const response = await fetch(`${OXAPAY_BASE}/common/fiats`, {
    headers: { "Content-Type": "application/json", merchant_api_key: merchantApiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new OxaPayApiError("Could not read the supported fiat currencies.", 502);
  }
  const payload: any = await response.json().catch(() => null);
  const data = payload?.data;
  if (!data || typeof data !== "object") return [];
  return Object.keys(data).map((key) => key.toUpperCase());
}

/**
 * Verifies the `HMAC` header: HMAC-SHA512 over the RAW request body using the
 * Merchant API Key as the secret.
 */
export function verifyOxaPayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  let merchantApiKey: string;
  try {
    merchantApiKey = getOxaPayConfig().merchantApiKey;
  } catch {
    return false;
  }
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha512", merchantApiKey).update(rawBody).digest("hex");
  return timingSafeHexEqual(expected, signature);
}
