import crypto from "crypto";

export type RazorpayMode = "test" | "live";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  mode: RazorpayMode;
  allowTestWalletCredit: boolean;
}

export interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes?: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string;
  captured: boolean;
  method?: string;
  email?: string;
  contact?: string;
  fee?: number | null;
  tax?: number | null;
  amount_refunded?: number;
  refund_status?: string | null;
  error_code?: string | null;
  error_description?: string | null;
}

export class RazorpayApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "RazorpayApiError";
    this.status = status;
  }
}

function configuredMode(keyId: string): RazorpayMode {
  if (keyId.startsWith("rzp_live_")) return "live";
  return "test";
}

export function hasRazorpayConfig(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayConfig(requireWebhook = false): RazorpayConfig {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();

  if (!keyId || !keySecret) {
    throw new RazorpayApiError("Razorpay is awaiting activation. Please use Direct UPI for now.", 503);
  }
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new RazorpayApiError("Razorpay configuration is invalid.", 503);
  }
  if (requireWebhook && !webhookSecret) {
    throw new RazorpayApiError("Razorpay webhook is not configured.", 503);
  }

  const inferredMode = configuredMode(keyId);
  const requestedMode = String(process.env.RAZORPAY_MODE || inferredMode).toLowerCase();
  if (requestedMode !== inferredMode) {
    throw new RazorpayApiError("Razorpay key mode does not match RAZORPAY_MODE.", 503);
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
    mode: inferredMode,
    allowTestWalletCredit: process.env.RAZORPAY_ALLOW_TEST_WALLET_CREDIT === "true",
  };
}

async function razorpayRequest<T>(
  config: RazorpayConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const authorization = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Razorpay occasionally returns an empty/non-JSON body for upstream failures.
  }

  if (!response.ok) {
    const description = payload?.error?.description;
    throw new RazorpayApiError(
      typeof description === "string" && description.length < 240
        ? description
        : "Razorpay could not process the request. Please try again.",
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }

  return payload as T;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  internalTransactionId: string;
}): Promise<RazorpayOrder> {
  const config = getRazorpayConfig();
  return razorpayRequest<RazorpayOrder>(config, "/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: {
        smmup_transaction_id: input.internalTransactionId,
        source: "smmup_wallet",
      },
      payment: {
        capture: "automatic",
        capture_options: {
          automatic_expiry_period: 12,
          refund_speed: "normal",
        },
      },
    }),
  });
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new RazorpayApiError("Invalid Razorpay payment identifier.", 400);
  }
  const config = getRazorpayConfig();
  return razorpayRequest<RazorpayPayment>(
    config,
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}

export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    throw new RazorpayApiError("Invalid Razorpay order identifier.", 400);
  }
  const config = getRazorpayConfig();
  const result = await razorpayRequest<{ items?: RazorpayPayment[] }>(
    config,
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
  return Array.isArray(result.items) ? result.items : [];
}

function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (expectedHex.length !== receivedHex.length) return false;
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function verifyRazorpayCheckoutSignature(input: {
  serverOrderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const config = getRazorpayConfig();
  const expected = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${input.serverOrderId}|${input.paymentId}`, "utf8")
    .digest("hex");
  return timingSafeHexEqual(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const config = getRazorpayConfig(true);
  const expected = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeHexEqual(expected, signature);
}
