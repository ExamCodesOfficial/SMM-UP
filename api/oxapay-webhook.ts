import type { VercelRequest, VercelResponse } from "../server/lib/http.js";
import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { ensurePaymentProviderIndexes, getDb } from "../server/lib/db.js";
import {
  OxaPayApiError,
  fetchOxaPayPayment,
  isOxaPayTrackId,
  normalizeOxaPayStatus,
  verifyOxaPayWebhookSignature,
} from "../server/lib/oxapay.js";
import { recordProviderEvent } from "../server/lib/wallet.js";
import { flagCryptoPaymentForReview, settleCryptoDeposit } from "../server/lib/cryptoSettlement.js";
import { sendPaymentSuccessAlert } from "../server/lib/telegram.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * OxaPay payment notification.
 *
 * The HMAC-SHA512 signature is computed over the RAW request body, so the body
 * is never parsed before verification.
 *
 * Provider quirks handled here:
 *   1. The webhook reports `status` capitalised ("Paid"). Every comparison goes
 *      through `normalizeOxaPayStatus`, because a strict lowercase check would
 *      silently never settle a payment.
 *   2. `underpaid` is a real status and is never auto-credited; the account is
 *      held and the owner reviews it.
 *   3. The authoritative invoice state is re-read from OxaPay before any money
 *      moves — the webhook body is only a trigger.
 */

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Webhook body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function header(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

function cleanText(value: unknown, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const signature = header(req, "hmac");
  if (!signature) return res.status(400).json({ error: "Missing OxaPay signature." });
  if (!verifyOxaPayWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid OxaPay webhook signature." });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook JSON." });
  }

  const trackId = cleanText(event?.track_id, 64);
  if (!trackId || !isOxaPayTrackId(trackId)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  // OxaPay provides no event identifier and may re-deliver the same logical
  // event with a different body, so the raw-body fingerprint is the event id.
  const eventId = `oxapay:${createHash("sha256").update(rawBody).digest("hex")}`;
  const providerStatus = normalizeOxaPayStatus(event?.status);

  try {
    await ensurePaymentProviderIndexes();
    const db = await getDb();

    const tx: any = await db.collection("transactions").findOne({ oxapay_track_id: trackId });
    if (!tx) {
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${providerStatus}`,
        providerOrderId: trackId,
        payload: { outcome: "orphan" },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    if (tx.status === "paid" || tx.status === "test_paid") {
      return res.status(200).json({ received: true, settled: true, duplicate: true });
    }

    // Authoritative provider state — the body above is never trusted.
    const payment = await fetchOxaPayPayment(trackId);
    const status = payment.status;

    if (status === "underpaid") {
      const observedAmountPaise = payment.amount !== null ? Math.round(payment.amount * 100) : null;
      await flagCryptoPaymentForReview({
        trackId,
        providerStatus: status,
        observedAmountPaise,
        reason: `OxaPay reported an underpaid invoice (${observedAmountPaise ?? "unknown"} of ${Math.round(Number(tx.amount_paise))} paise expected).`,
      });
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: "invoice.underpaid",
        providerOrderId: trackId,
        payload: { outcome: "underpaid", observed_amount_paise: observedAmountPaise },
      });
      return res.status(200).json({ received: true, settled: false, reviewRequired: true });
    }

    if (status === "refunding" || status === "refunded") {
      await flagCryptoPaymentForReview({
        trackId,
        providerStatus: status,
        reason: `OxaPay reported a ${status} crypto invoice. Wallet reconciliation is required.`,
      });
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${status}`,
        providerOrderId: trackId,
        payload: { outcome: status },
      });
      return res.status(200).json({ received: true, settled: false, reviewRequired: true });
    }

    if (status !== "paid" && status !== "manual_accept") {
      if (status === "expired" && tx.status === "pending") {
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), oxapay_status: status, updated_at: new Date() } },
        );
      }
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${status}`,
        providerOrderId: trackId,
        payload: { outcome: "not_paid", provider_status: status },
      });
      return res.status(200).json({ received: true, settled: false, providerStatus: status });
    }

    const result = await settleCryptoDeposit({
      internalTransactionId: tx._id.toString(),
      trackId,
      expectedUserId: tx.user_id?.toString(),
      expectedAmountPaise: Math.round(Number(tx.amount_paise)),
      payment,
      eventId,
      eventType: `invoice.${status}`,
      sandbox: tx.environment === "sandbox",
      allowSandboxCredit: String(process.env.OXAPAY_ALLOW_SANDBOX_CREDIT || "false").trim() === "true",
    });

    // The customer cancelled this invoice but the money still arrived. It is
    // credited (never dropped) and flagged so the owner can reconcile.
    if (tx.status === "cancelled" && !result.alreadySettled && result.walletCredited) {
      await db.collection("transactions").updateOne(
        { _id: tx._id },
        {
          $set: {
            payment_review_required: true,
            payment_review_reason: "A cancelled crypto invoice was paid after cancellation.",
            updated_at: new Date(),
          },
        },
      );
    }

    if (!result.alreadySettled && result.walletCredited) {
      const settledUser = await db.collection("users").findOne(
        { _id: new ObjectId(result.userId) },
        { projection: { email: 1 } },
      );
      sendPaymentSuccessAlert({
        userEmail: String(settledUser?.email || tx.user_email || "unknown"),
        amount: result.amount,
        method: "Crypto (OxaPay)",
        transactionId: trackId,
        memo: trackId,
        newBalance: result.newBalance,
      }).catch((error) => console.error("OxaPay webhook alert error:", error));
    }

    return res.status(200).json({ received: true, settled: true, duplicate: result.alreadySettled });
  } catch (error: any) {
    const known = error instanceof OxaPayApiError;
    console.error("OxaPay webhook error:", error?.message || error);
    // Acknowledge so OxaPay does not retry-storm; the reconciliation sweep
    // re-checks this invoice shortly.
    return res.status(200).json({ received: true, settled: false, deferred: true, error: known ? error.message : "Deferred to reconciliation." });
  }
}
