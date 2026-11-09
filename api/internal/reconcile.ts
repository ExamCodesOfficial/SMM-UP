import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import crypto from "crypto";
import { ensurePaymentProviderIndexes, getDb } from "../../server/lib/db.js";
import { reconcilePendingDeposits, type ReconciliationProvider } from "../../server/lib/paymentReconciliation.js";
import { getPaymentMethodStates } from "../../server/lib/paymentMethods.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Internal bot -> website channel.
 *
 * The Telegram bot never holds a provider API key. It can only ASK the website
 * to re-check a payment that is already pending. This endpoint therefore has
 * no path to create a credit that the provider has not already authorised: it
 * re-reads the authoritative provider state and runs the same settlement
 * function the signed webhooks use.
 *
 * Security controls:
 *   - HMAC-SHA256 over `${timestamp}.${nonce}.${rawBody}` using a shared secret
 *   - +/- 300 second timestamp window
 *   - single-use nonce enforced by a unique index (replay protection)
 *   - timing-safe signature comparison
 *   - fixed action allow-list (least privilege)
 *   - counts-only responses (no data leak / no oracle)
 *   - rate limiting and a hard row cap
 *   - fail closed when the secret is missing or too short
 */

const ALLOWED_ACTIONS = new Set(["reconcile_pending", "payment_methods_status"]);
const TIMESTAMP_WINDOW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function header(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!expectedHex || !receivedHex) return false;
  if (expectedHex.length !== receivedHex.length) return false;
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function activeSecrets(): string[] {
  const secrets: string[] = [];
  for (const name of ["INTERNAL_API_SECRET", "INTERNAL_API_SECRET_PREVIOUS"]) {
    const value = String(process.env[name] || "").trim();
    if (value.length >= MIN_SECRET_LENGTH) secrets.push(value);
  }
  return secrets;
}

/** Consumes a nonce. A duplicate means the request was replayed. */
async function consumeNonce(db: any, nonce: string, expiresAt: Date): Promise<boolean> {
  try {
    await db.collection("internal_request_nonces").insertOne({
      nonce,
      expires_at: expiresAt,
      created_at: new Date(),
    });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secrets = activeSecrets();
  if (secrets.length === 0) {
    console.error("internal/reconcile refused: INTERNAL_API_SECRET is missing or too short");
    return res.status(503).json({ error: "Internal authentication is not configured" });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const timestamp = String(header(req, "x-internal-timestamp") || "").trim();
  const nonce = String(header(req, "x-internal-nonce") || "").trim();
  const signature = String(header(req, "x-internal-signature") || "").trim();

  if (!timestamp || !nonce || !signature) {
    return res.status(400).json({ error: "Missing authentication headers." });
  }
  if (!/^\d{10}$/.test(timestamp)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }
  if (!/^[a-f0-9]{32,64}$/i.test(nonce)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }

  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime) || Math.abs(Math.floor(Date.now() / 1000) - requestTime) > TIMESTAMP_WINDOW_SECONDS) {
    return res.status(401).json({ error: "Request timestamp outside the accepted window." });
  }

  const signedPayload = `${timestamp}.${nonce}.${rawBody.toString("utf8")}`;
  const signatureValid = secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    return timingSafeHexEqual(expected, signature);
  });
  if (!signatureValid) {
    return res.status(401).json({ error: "Invalid request signature." });
  }

  let body: any = {};
  try {
    body = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const action = String(body?.action || "");
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: "Unsupported action." });
  }

  try {
    const db = await getDb();
    await ensurePaymentProviderIndexes();

    // Replay protection: the nonce is single use.
    const nonceAccepted = await consumeNonce(
      db,
      nonce,
      new Date(requestTime * 1000 + TIMESTAMP_WINDOW_SECONDS * 2000),
    );
    if (!nonceAccepted) {
      return res.status(401).json({ error: "Request replay detected." });
    }

    // Read-only: the effective on/off state of every payment method, with the
    // credential gate applied. The bot holds no provider key, so this is how
    // it learns whether a method is genuinely live.
    if (action === "payment_methods_status") {
      const states = await getPaymentMethodStates(db);
      return res.status(200).json({
        methods: states.map((state) => ({
          id: state.id,
          label: state.label,
          enabled: state.enabled,
          toggleEnabled: state.toggleEnabled,
          configured: state.configured,
          reason: state.reason,
          source: state.source,
          minAmount: state.minAmount,
          maxAmount: state.maxAmount,
          currency: state.currency,
          inrRate: state.inrRate,
          feePayer: state.feePayer,
        })),
      });
    }

    const provider = String(body?.provider || "famgateway") as ReconciliationProvider;
    if (provider !== "famgateway" && provider !== "oxapay") {
      return res.status(400).json({ error: "Unsupported provider." });
    }

    const limit = Number.parseInt(String(body?.limit ?? "25"), 10);
    const minAgeSeconds = Number.parseInt(String(body?.minAgeSeconds ?? "30"), 10);

    const summary = await reconcilePendingDeposits({
      provider,
      limit: Number.isFinite(limit) ? limit : 25,
      minAgeSeconds: Number.isFinite(minAgeSeconds) ? minAgeSeconds : 30,
    });

    await db.collection("security_events").insertOne({
      type: "internal_reconcile",
      action,
      provider,
      scanned: summary.scanned,
      settled: summary.settled,
      created_at: new Date(),
    });

    // Counts only. No amounts, references, identifiers or provider payloads.
    return res.status(200).json({ reconciled: summary.scanned, settled: summary.settled, stillPending: summary.stillPending });
  } catch (error: any) {
    console.error("internal/reconcile error:", error?.message || error);
    return res.status(500).json({ error: "Reconciliation failed." });
  }
}
