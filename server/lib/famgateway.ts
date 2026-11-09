import crypto from "crypto";

/**
 * FamGateway — automated (non-custodial) UPI gateway client.
 *
 * FamGateway watches the merchant's own connected Gmail for bank credit alerts,
 * extracts the 12-digit NPCI UTR, and calls our webhook within seconds. Funds
 * settle directly into the merchant's UPI VPA; FamGateway never custodies.
 *
 * The Merchant API Key doubles as the HMAC-SHA256 secret for the
 * `X-FamGateway-Signature` webhook header, so it is treated as a single
 * high-value secret and is never sent to the browser or placed in a URL.
 */

const FAMGATEWAY_BASE = "https://famgateway.in";

export type FamGatewayOrderStatus = "success" | "pending" | "expired";

export interface FamGatewayOrder {
  orderId: string;
  qrUrl: string;
  checkoutUrl: string;
  upiId: string;
  upiIntent: string;
  amount: number;
  payableAmount: number;
}

export interface FamGatewayVerification {
  status: FamGatewayOrderStatus;
  orderId: string;
  amount: number | null;
  payableAmount: number | null;
  utr: string | null;
  transactionId: string | null;
  senderName: string | null;
  paidAt: string | null;
}

export class FamGatewayApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "FamGatewayApiError";
    this.status = status;
  }
}

export function hasFamGatewayConfig(): boolean {
  return Boolean(String(process.env.FAMGATEWAY_API_KEY || "").trim());
}

export function getFamGatewayConfig(): { apiKey: string } {
  const apiKey = String(process.env.FAMGATEWAY_API_KEY || "").trim();
  if (!apiKey) {
    throw new FamGatewayApiError("UPI Automatic is not configured.", 503);
  }
  if (apiKey.length < 16) {
    throw new FamGatewayApiError("UPI Automatic configuration is invalid.", 503);
  }
  return { apiKey };
}

function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!expectedHex || !receivedHex) return false;
  if (expectedHex.length !== receivedHex.length) return false;
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/** FamGateway order identifiers look like `fg_A1B2C3D4`. */
export function isFamGatewayOrderId(value: unknown): boolean {
  return typeof value === "string" && /^fg_[A-Za-z0-9]{6,32}$/.test(value.trim());
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function cleanText(value: unknown, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

/**
 * Creates a 5-minute UPI order. `payable_amount` is guaranteed by FamGateway to
 * equal the requested base amount, so no unique-paise reservation is needed —
 * the customer pays exactly the amount they were quoted.
 */
export async function createFamGatewayOrder(input: {
  amountInr: number;
  customerName?: string;
  customerEmail?: string;
  redirectUrl: string;
  webhookUrl: string;
}): Promise<FamGatewayOrder> {
  const { apiKey } = getFamGatewayConfig();

  const body: Record<string, unknown> = {
    amount: input.amountInr,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
  };
  if (input.customerName) body.customer_name = input.customerName;
  if (input.customerEmail) body.customer_email = input.customerEmail;

  const response = await fetch(`${FAMGATEWAY_BASE}/api/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // FamGateway occasionally returns a non-JSON body on upstream failures.
  }

  if (!response.ok || payload?.status !== "success" || !payload?.data) {
    const message = cleanText(payload?.message, 240);
    throw new FamGatewayApiError(
      message || "UPI Automatic could not start the payment. Please try again.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  const data = payload.data;
  const orderId = cleanText(data.order_id, 64);
  if (!isFamGatewayOrderId(orderId)) {
    throw new FamGatewayApiError("UPI Automatic returned an invalid order reference.", 502);
  }

  const payableAmount = toFiniteNumber(data.payable_amount) ?? toFiniteNumber(data.amount);
  if (payableAmount === null || Math.round(payableAmount * 100) !== Math.round(input.amountInr * 100)) {
    throw new FamGatewayApiError("UPI Automatic altered the payable amount.", 502);
  }

  const checkoutUrl = cleanText(data.checkout_url, 500);
  const qrUrl = cleanText(data.qr_url, 500);
  const upiIntent = cleanText(data.upi_intent, 900);
  if (!checkoutUrl || !qrUrl || !upiIntent) {
    throw new FamGatewayApiError("UPI Automatic returned an incomplete order.", 502);
  }

  const upiId = cleanText(data.upi_id, 120) || "";

  // Guard against a merchant account pointing at the wrong VPA. If the
  // expected VPA is configured, the order MUST be raised against it.
  const expectedVpa = String(process.env.FAMGATEWAY_UPI_VPA || "").trim().toLowerCase();
  if (expectedVpa && upiId.toLowerCase() !== expectedVpa) {
    throw new FamGatewayApiError(
      "UPI Automatic is connected to a different UPI ID than this site expects.",
      502,
    );
  }

  return {
    orderId: orderId!,
    qrUrl,
    checkoutUrl,
    upiId,
    upiIntent,
    amount: toFiniteNumber(data.amount) ?? payableAmount,
    payableAmount,
  };
}

/**
 * Authoritative server-to-server verification. FamGateway answers 408 when the
 * order expired without payment and 404 when it is unknown; both are normal
 * states for us, not errors.
 */
export async function fetchFamGatewayOrder(orderId: string): Promise<FamGatewayVerification> {
  const { apiKey } = getFamGatewayConfig();
  if (!isFamGatewayOrderId(orderId)) {
    throw new FamGatewayApiError("Invalid UPI Automatic order reference.", 400);
  }

  const response = await fetch(
    `${FAMGATEWAY_BASE}/api/verify-order.php?order_id=${encodeURIComponent(orderId)}`,
    {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (response.status === 404) {
    return { status: "expired", orderId, amount: null, payableAmount: null, utr: null, transactionId: null, senderName: null, paidAt: null };
  }
  if (response.status === 408) {
    return { status: "expired", orderId, amount: null, payableAmount: null, utr: null, transactionId: null, senderName: null, paidAt: null };
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new FamGatewayApiError(
      cleanText(payload?.message, 240) || "UPI Automatic verification failed.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const rawStatus = cleanText(data?.status, 32)?.toLowerCase();
  const status: FamGatewayOrderStatus =
    rawStatus === "success" ? "success" : rawStatus === "expired" ? "expired" : "pending";

  return {
    status,
    orderId: cleanText(data?.order_id, 64) || orderId,
    amount: toFiniteNumber(data?.amount),
    payableAmount: toFiniteNumber(data?.payable_amount),
    utr: cleanText(data?.utr, 40),
    transactionId: cleanText(data?.transaction_id, 80),
    senderName: cleanText(data?.sender_name, 120),
    paidAt: cleanText(data?.payment_time_ist, 64) || cleanText(data?.payment_time, 64),
  };
}

/**
 * Verifies the `X-FamGateway-Signature` header: HMAC-SHA256 over the RAW
 * request body using the Merchant API Key as the secret.
 */
export function verifyFamGatewayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  let apiKey: string;
  try {
    apiKey = getFamGatewayConfig().apiKey;
  } catch {
    return false;
  }
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
  return timingSafeHexEqual(expected, signature);
}
