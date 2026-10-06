import type { VercelRequest, VercelResponse } from "../server/lib/http.js";
import { ObjectId } from "mongodb";
import { getDb } from "../server/lib/db.js";
import { sendPaymentSuccessAlert, sendTelegramMessage } from "../server/lib/telegram.js";
import {
  RazorpayApiError,
  fetchRazorpayPayment,
  getRazorpayConfig,
  verifyRazorpayWebhookSignature,
  type RazorpayPayment,
} from "../server/lib/razorpay.js";
import {
  WalletSettlementError,
  flagRazorpayPaymentForReview,
  recordRazorpayEvent,
  settleRazorpayDeposit,
} from "../server/lib/wallet.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

function paymentFromPayload(payload: any): RazorpayPayment | null {
  const payment = payload?.payload?.payment?.entity;
  return payment && typeof payment === "object" ? payment as RazorpayPayment : null;
}

function safeTelegramText(value: unknown): string {
  return String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function notifyPaymentReview(input: {
  eventType: string;
  paymentId?: string;
  transactionFound: boolean;
}) {
  const text = [
    "⚠️ <b>Razorpay payment review</b>",
    `Event: <code>${safeTelegramText(input.eventType)}</code>`,
    `Payment: <code>${safeTelegramText(input.paymentId)}</code>`,
    `SMM UP transaction: ${input.transactionFound ? "matched" : "not found"}`,
    "Ordering has been held when an account match was found.",
  ].join("\n");
  sendTelegramMessage(text).catch((error) =>
    console.error("Razorpay review alert error:", error),
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const razorpayConfig = getRazorpayConfig(true);
    const rawBody = await readRawBody(req);
    const signature = header(req, "x-razorpay-signature");
    const eventId = header(req, "x-razorpay-event-id");

    if (!signature || !eventId) {
      return res.status(400).json({ error: "Missing Razorpay webhook headers." });
    }
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid Razorpay webhook signature." });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid webhook JSON." });
    }

    const eventType = String(event?.event || "");
    const payment = paymentFromPayload(event);
    const db = await getDb();

    if (eventType === "payment.captured") {
      if (!payment?.id || !payment.order_id) {
        return res.status(400).json({ error: "Captured payment payload is incomplete." });
      }

      // Fetch the provider record instead of relying only on payload fields.
      const authoritativePayment = await fetchRazorpayPayment(payment.id);
      const result = await settleRazorpayDeposit({
        razorpayOrderId: authoritativePayment.order_id,
        payment: authoritativePayment,
        mode: razorpayConfig.mode,
        allowTestWalletCredit: razorpayConfig.allowTestWalletCredit,
        eventId,
        eventType,
      });

      if (!result.alreadySettled && result.walletCredited && ObjectId.isValid(result.userId)) {
        const settledUser = await db.collection("users").findOne(
          { _id: new ObjectId(result.userId) },
          { projection: { email: 1 } },
        );
        sendPaymentSuccessAlert({
          userEmail: String(settledUser?.email || "unknown"),
          amount: result.amount,
          method: `Razorpay ${authoritativePayment.method || "Checkout"} (webhook)`,
          transactionId: authoritativePayment.id,
          memo: authoritativePayment.order_id,
          newBalance: result.newBalance,
        }).catch((notifyError) => console.error("Razorpay webhook alert error:", notifyError));
      }

      return res.status(200).json({
        received: true,
        duplicate: result.duplicateEvent,
        settled: true,
      });
    }

    if (eventType === "payment.failed") {
      const recorded = await recordRazorpayEvent({
        eventId,
        eventType,
        payment: payment || undefined,
        payload: {
          error_code: payment?.error_code || null,
          error_description: payment?.error_description || null,
        },
      });
      if (!recorded.duplicate && payment?.order_id) {
        // A later retry on the same order may still be captured, so keep it pending.
        await db.collection("transactions").updateOne(
          { method: "RAZORPAY", razorpay_order_id: payment.order_id, status: { $nin: ["paid", "test_paid"] } },
          {
            $set: {
              last_payment_failure: {
                payment_id: payment.id,
                code: payment.error_code || null,
                description: payment.error_description || null,
                at: new Date(),
              },
              updated_at: new Date(),
            },
          },
        );
      }
      return res.status(200).json({ received: true, duplicate: recorded.duplicate });
    }

    if (["refund.created", "refund.processed", "refund.failed"].includes(eventType)) {
      const refund = event?.payload?.refund?.entity;
      const review = await flagRazorpayPaymentForReview({
        eventId,
        eventType,
        razorpayOrderId: payment?.order_id,
        razorpayPaymentId: payment?.id || refund?.payment_id,
        reason: `Razorpay ${eventType.replace(".", " ")}; wallet reconciliation required.`,
        refundedAmountPaise: Number(refund?.amount || 0),
      });
      if (!review.duplicate) {
        notifyPaymentReview({
          eventType,
          paymentId: payment?.id || refund?.payment_id,
          transactionFound: review.transactionFound,
        });
      }
      return res.status(200).json({ received: true, duplicate: review.duplicate });
    }

    if (eventType.startsWith("payment.dispute.")) {
      const dispute = event?.payload?.dispute?.entity;
      const review = await flagRazorpayPaymentForReview({
        eventId,
        eventType,
        razorpayOrderId: payment?.order_id,
        razorpayPaymentId: payment?.id || dispute?.payment_id,
        reason: `Razorpay dispute requires review${dispute?.id ? ` (${dispute.id})` : ""}.`,
      });
      if (!review.duplicate) {
        notifyPaymentReview({
          eventType,
          paymentId: payment?.id || dispute?.payment_id,
          transactionFound: review.transactionFound,
        });
      }
      return res.status(200).json({ received: true, duplicate: review.duplicate });
    }

    const recorded = await recordRazorpayEvent({
      eventId,
      eventType: eventType || "unknown",
      payment: payment || undefined,
    });
    return res.status(200).json({ received: true, ignored: true, duplicate: recorded.duplicate });
  } catch (error: any) {
    const known = error instanceof RazorpayApiError || error instanceof WalletSettlementError;
    console.error("Razorpay webhook error:", error?.message || error);
    return res.status(known ? error.status : 500).json({
      error: known ? error.message : "Webhook processing failed.",
    });
  }
}
