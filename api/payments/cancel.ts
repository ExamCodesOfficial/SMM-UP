import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";

/**
 * Cancels a pending deposit request.
 *
 * The customer opened a payment for the wrong amount and wants a fresh one.
 * Cancelling only closes OUR record — the provider order, if any, is left
 * alone, because the money may still arrive and must never be silently
 * dropped. If a payment later lands on a cancelled order the webhook still
 * settles it and flags it for owner review.
 *
 * A settled (already credited) deposit can never be cancelled.
 */

const CANCELLABLE_METHODS = ["FAMPAY_UPI", "FAMGATEWAY_UPI", "OXAPAY_CRYPTO"];

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOriginIfPresent(req)) return res.status(403).json({ error: "Invalid request origin." });

  try {
    const db = await getDb();
    const authUser = await getUserFromRequest(req, db);
    if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
    if (denySupportMutation(authUser, res, false)) return;

    const rate = await checkRateLimit(`payment_cancel_${authUser.userId}`, 20, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many cancellation attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    const tx: any = await db.collection("transactions").findOne({
      _id: new ObjectId(transactionId),
      user_id: new ObjectId(authUser.userId),
    });

    if (!tx) return res.status(404).json({ error: "Payment request not found." });

    if (tx.status === "paid" || tx.status === "test_paid") {
      return res.status(409).json({
        error: "This deposit is already credited, so it cannot be cancelled. If the amount is wrong, contact support.",
      });
    }
    if (tx.status === "cancelled") {
      return res.status(200).json({ success: true, alreadyCancelled: true, message: "This payment request was already cancelled." });
    }
    if (!CANCELLABLE_METHODS.includes(String(tx.method))) {
      return res.status(409).json({ error: "This payment request cannot be cancelled." });
    }
    if (!["pending", "creating", "expired"].includes(String(tx.status))) {
      return res.status(409).json({ error: "This payment request is not in a cancellable state." });
    }

    const updated = await db.collection("transactions").updateOne(
      { _id: tx._id, status: tx.status, wallet_credited: { $ne: true } },
      {
        $set: {
          status: "cancelled",
          cancelled_at: new Date(),
          cancelled_by: "customer",
          updated_at: new Date(),
        },
      },
    );

    if (updated.modifiedCount !== 1) {
      return res.status(409).json({ error: "This payment request changed while cancelling. Please refresh and try again." });
    }

    // Release the unique direct-UPI amount reservation so the money is free again.
    if (tx.method === "FAMPAY_UPI" && tx.memo) {
      await db.collection("direct_upi_amount_reservations").updateMany(
        { memo: tx.memo, status: "reserved" },
        { $set: { status: "released", released_at: new Date() } },
      ).catch(() => {});
    }

    await db.collection("payment_events").insertOne({
      provider: "site",
      event_id: `cancel:${transactionId}`,
      event_type: "payment.cancelled",
      transaction_id: tx._id,
      status: "cancelled",
      received_at: new Date(),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Payment request cancelled. You can create a new one with the correct amount.",
    });
  } catch (error: any) {
    console.error("Cancel payment error:", error?.message || error);
    return res.status(503).json({ error: "Unable to cancel this payment request. Please try again." });
  }
}
