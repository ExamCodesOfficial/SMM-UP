import type { VercelRequest, VercelResponse } from "../server/lib/http.js";
import { ObjectId } from "mongodb";
import { ensurePaymentProviderIndexes, getDb } from "../server/lib/db.js";
import {
  FamGatewayApiError,
  fetchFamGatewayOrder,
  isFamGatewayOrderId,
  verifyFamGatewayWebhookSignature,
} from "../server/lib/famgateway.js";
import { recordProviderEvent, settleFamGatewayDeposit } from "../server/lib/wallet.js";
import { sendPaymentSuccessAlert } from "../server/lib/telegram.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * FamGateway instant payment notification.
 *
 * The HMAC signature is computed over the RAW request body, so the body must
 * never be parsed before verification.
 *
 * The webhook is a TRIGGER, never a source of truth: after verifying the
 * signature we re-read the authoritative order state from FamGateway and settle
 * from that. A forged body cannot credit a wallet.
 *
 * FamGateway expects HTTP 200 within 10 seconds. We therefore always
 * acknowledge once the signature is valid and let the reconciliation sweep pick
 * up anything that could not be settled inline.
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

  const signature = header(req, "x-famgateway-signature");
  if (!signature) return res.status(400).json({ error: "Missing FamGateway signature." });
  if (!verifyFamGatewayWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid FamGateway webhook signature." });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook JSON." });
  }

  const orderId = cleanText(event?.order_id, 64);
  if (!orderId || !isFamGatewayOrderId(orderId)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    await ensurePaymentProviderIndexes();
    const db = await getDb();

    const tx: any = await db.collection("transactions").findOne({ famgateway_order_id: orderId });

    // The per-order webhook override carries our internal transaction id.
    // When present it must match the row we resolved, otherwise the delivery
    // is bound to a different order and is rejected.
    const expectedTx = cleanText(req.query?.tx, 64);
    if (expectedTx) {
      if (!tx || tx._id.toString() !== expectedTx) {
        await recordProviderEvent({
          provider: "famgateway",
          eventId: orderId,
          eventType: cleanText(event?.event, 64) || "payment.success",
          providerOrderId: orderId,
          payload: { outcome: "binding_mismatch" },
        });
        return res.status(200).json({ received: true, ignored: true });
      }
    }

    if (!tx) {
      // An order we do not know about: record it so the owner can see it, but
      // never create a transaction from a webhook alone.
      await recordProviderEvent({
        provider: "famgateway",
        eventId: orderId,
        eventType: cleanText(event?.event, 64) || "payment.success",
        providerOrderId: orderId,
        payload: { outcome: "orphan" },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    if (tx.status === "paid" || tx.status === "test_paid") {
      return res.status(200).json({ received: true, settled: true, duplicate: true });
    }

    // Authoritative provider state — the webhook body is never trusted for
    // the amount, the UTR or the payer.
    const order = await fetchFamGatewayOrder(orderId);

    if (order.status !== "success") {
      if (order.status === "expired" && tx.status === "pending") {
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), updated_at: new Date() } },
        );
      }
      await recordProviderEvent({
        provider: "famgateway",
        eventId: orderId,
        eventType: cleanText(event?.event, 64) || "payment.pending",
        providerOrderId: orderId,
        payload: { outcome: "not_paid", provider_status: order.status },
      });
      return res.status(200).json({ received: true, settled: false, providerStatus: order.status });
    }

    const expectedAmountPaise = Math.round(Number(tx.amount_paise));
    const settledAmountPaise = order.payableAmount !== null
      ? Math.round(order.payableAmount * 100)
      : order.amount !== null
        ? Math.round(order.amount * 100)
        : expectedAmountPaise;

    if (settledAmountPaise !== expectedAmountPaise) {
      // Never credit a mismatched amount. Flag it for the owner instead.
      await db.collection("transactions").updateOne(
        { _id: tx._id },
        {
          $set: {
            payment_review_required: true,
            payment_review_reason: `FamGateway settled ${settledAmountPaise} paise but ${expectedAmountPaise} paise was expected.`,
            updated_at: new Date(),
          },
        },
      );
      await recordProviderEvent({
        provider: "famgateway",
        eventId: orderId,
        eventType: cleanText(event?.event, 64) || "payment.success",
        providerOrderId: orderId,
        payload: { outcome: "amount_mismatch", expected_amount_paise: expectedAmountPaise, settled_amount_paise: settledAmountPaise },
      });
      return res.status(200).json({ received: true, settled: false, reviewRequired: true });
    }

    const result = await settleFamGatewayDeposit({
      internalTransactionId: tx._id.toString(),
      famgatewayOrderId: orderId,
      expectedUserId: tx.user_id?.toString(),
      expectedAmountPaise,
      utr: order.utr,
      transactionId: order.transactionId,
      senderName: order.senderName,
      eventId: orderId,
      eventType: cleanText(event?.event, 64) || "payment.success",
    });

    // The customer cancelled this request but the money still arrived. It is
    // credited (never dropped) and flagged so the owner can reconcile.
    if (tx.status === "cancelled" && !result.alreadySettled && result.walletCredited) {
      await db.collection("transactions").updateOne(
        { _id: tx._id },
        {
          $set: {
            payment_review_required: true,
            payment_review_reason: "A cancelled UPI Automatic order was paid after cancellation.",
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
        method: "UPI Automatic (FamGateway)",
        utr: order.utr || undefined,
        transactionId: order.transactionId || orderId,
        memo: orderId,
        newBalance: result.newBalance,
      }).catch((error) => console.error("FamGateway webhook alert error:", error));
    }

    return res.status(200).json({ received: true, settled: true, duplicate: result.alreadySettled });
  } catch (error: any) {
    const known = error instanceof FamGatewayApiError;
    console.error("FamGateway webhook error:", error?.message || error);
    // Acknowledge so FamGateway does not enter a retry storm; the
    // reconciliation sweep re-checks this order shortly.
    return res.status(200).json({ received: true, settled: false, deferred: true, error: known ? error.message : "Deferred to reconciliation." });
  }
}
