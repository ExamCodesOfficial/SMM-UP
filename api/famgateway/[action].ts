import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { ensurePaymentProviderIndexes, getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  FamGatewayApiError,
  createFamGatewayOrder,
  fetchFamGatewayOrder,
  hasFamGatewayConfig,
  isFamGatewayOrderId,
} from "../../server/lib/famgateway.js";
import {
  getPaymentMethodSettings,
  getPaymentMethodStates,
  isPaymentMethodEnabled,
  type PaymentMethodState,
} from "../../server/lib/paymentMethods.js";
import { sendPaymentSuccessAlert } from "../../server/lib/telegram.js";
import { settleFamGatewayDeposit } from "../../server/lib/wallet.js";

/**
 * UPI Automatic (FamGateway).
 *
 * FamGateway watches the merchant's own connected Gmail for the bank credit
 * alert, extracts the NPCI UTR and calls our webhook within seconds. Unlike
 * the legacy Direct UPI flow there is no memo to strip, so no unique-paise
 * reservation is needed: the customer pays exactly the quoted amount.
 */

const METHOD_ID = "famgateway_upi" as const;

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function siteUrl(): string {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  if (!configured) return "https://smmup.co.in";
  return configured.replace(/\/+$/, "");
}

/**
 * The limits and lifetimes the customer was shown. They come from the shared
 * registry (Mongo override > env > default) so the amount the UI accepted is
 * always exactly the amount the API enforces.
 */
async function resolveLimits(db: any) {
  const settings = await getPaymentMethodSettings(db, "famgateway_upi");
  return {
    minAmount: settings.minAmount,
    maxAmount: settings.maxAmount,
    lifetimeMinutes: settings.orderLifetimeMinutes,
  };
}

function parseAmountPaise(
  value: unknown,
  limits: { minAmount: number; maxAmount: number },
): { amount: number; amountPaise: number } | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const amountPaise = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountPaise) > 0.0001) return null;
  if (amountPaise < limits.minAmount * 100 || amountPaise > limits.maxAmount * 100) return null;
  return { amount: amountPaise / 100, amountPaise };
}

async function resolveFamGatewayState(db: any): Promise<PaymentMethodState | undefined> {
  const states = await getPaymentMethodStates(db);
  return states.find((state) => state.id === METHOD_ID);
}

async function handleFamGatewayRequest(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "");
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
  if (denySupportMutation(authUser, res, action === "config" && req.method === "GET")) return;

  if (action === "config") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const state = await resolveFamGatewayState(db);
    const configured = hasFamGatewayConfig();
    const limits = await resolveLimits(db);
    return res.status(200).json({
      enabled: Boolean(state?.enabled && configured),
      configured,
      minAmount: limits.minAmount,
      maxAmount: limits.maxAmount,
      orderLifetimeMinutes: limits.lifetimeMinutes,
      message: !configured
        ? "UPI Automatic is awaiting activation."
        : state?.enabled
          ? undefined
          : "UPI Automatic is currently unavailable.",
    });
  }

  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!sameOriginIfPresent(req)) return res.status(403).json({ error: "Invalid request origin." });

    // The toggle gates CREATION only. Settlement of an already-created order
    // is never blocked, so an operational toggle can never orphan a customer.
    if (!(await isPaymentMethodEnabled(db, METHOD_ID))) {
      return res.status(403).json({ error: "UPI Automatic is currently unavailable. Please choose another payment method." });
    }

    const rate = await checkRateLimit(`famgateway_create_${authUser.userId}`, 8, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many payment attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const limits = await resolveLimits(db);
    const parsed = parseAmountPaise(req.body?.amount, limits);
    if (!parsed) {
      return res.status(400).json({
        error: `Enter an amount from ₹${limits.minAmount.toLocaleString("en-IN")} to ₹${limits.maxAmount.toLocaleString("en-IN")} with at most 2 decimal places.`,
      });
    }

    const hold = await db.collection("users").findOne(
      { _id: new ObjectId(authUser.userId) },
      { projection: { payment_hold: 1 } },
    );
    if (hold?.payment_hold) {
      return res.status(403).json({ error: "Deposits are temporarily paused on this account. Please contact support." });
    }

    let transactionId: ObjectId | null = null;
    try {
      await ensurePaymentProviderIndexes();
      const now = new Date();
      const insert = await db.collection("transactions").insertOne({
        user_id: new ObjectId(authUser.userId),
        user_email: authUser.email,
        amount: parsed.amount,
        amount_paise: parsed.amountPaise,
        currency: "INR",
        method: "FAMGATEWAY_UPI",
        provider: "famgateway",
        environment: "live",
        status: "creating",
        wallet_credited: false,
        created_at: now,
        updated_at: now,
        expires_at: new Date(now.getTime() + limits.lifetimeMinutes * 60_000),
      });
      transactionId = insert.insertedId;

      const order = await createFamGatewayOrder({
        amountInr: parsed.amount,
        customerName: authUser.username || authUser.email,
        customerEmail: authUser.email,
        redirectUrl: `${siteUrl()}/add-funds?paid=1`,
        // FamGateway has no order-metadata field, so our internal transaction
        // id travels with the per-order webhook override.
        webhookUrl: `${siteUrl()}/api/famgateway-webhook?tx=${transactionId.toString()}`,
      });

      await db.collection("transactions").updateOne(
        { _id: transactionId, status: "creating" },
        {
          $set: {
            status: "pending",
            famgateway_order_id: order.orderId,
            famgateway_checkout_url: order.checkoutUrl,
            famgateway_qr_url: order.qrUrl,
            famgateway_upi_intent: order.upiIntent,
            famgateway_upi_id: order.upiId,
            famgateway_payable_amount: order.payableAmount,
            famgateway_created_at: new Date(),
            updated_at: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        transactionId: transactionId.toString(),
        orderId: order.orderId,
        amount: parsed.amount,
        amountPaise: parsed.amountPaise,
        currency: "INR",
        upiId: order.upiId,
        upiIntent: order.upiIntent,
        checkoutUrl: order.checkoutUrl,
        expiresInSeconds: limits.lifetimeMinutes * 60,
        message: `Pay exactly ₹${parsed.amount.toFixed(2)}. This payment is verified automatically within a few seconds.`,
      });
    } catch (error: any) {
      if (transactionId) {
        await db.collection("transactions").updateOne(
          { _id: transactionId, status: "creating" },
          { $set: { status: "failed", failure_stage: "famgateway_order_creation", updated_at: new Date() } },
        ).catch(() => {});
      }
      const status = error instanceof FamGatewayApiError ? error.status : 502;
      console.error("FamGateway create-order error:", error?.message || error);
      return res.status(status).json({
        error: error instanceof FamGatewayApiError
          ? error.message
          : "Unable to start a UPI Automatic payment. Please try again.",
      });
    }
  }

  if (action === "status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const rate = await checkRateLimit(`famgateway_status_${authUser.userId}`, 90, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many status checks. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.query.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(transactionId),
        user_id: new ObjectId(authUser.userId),
        method: "FAMGATEWAY_UPI",
      });
      if (!tx) return res.status(404).json({ error: "Payment request not found." });

      if (tx.status === "paid" || tx.status === "test_paid") {
        const user = await db.collection("users").findOne({ _id: new ObjectId(authUser.userId) });
        return res.status(200).json({
          success: true,
          status: tx.status,
          amount: tx.amount,
          newBalance: Number(user?.balance || 0),
          walletCredited: tx.wallet_credited !== false,
          message: "Payment confirmed and credited to your wallet.",
        });
      }

      if (tx.status === "pending" && tx.expires_at && new Date(tx.expires_at) <= new Date()) {
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), updated_at: new Date() } },
        );
        return res.status(200).json({ success: true, status: "expired", message: "This payment request expired. Please generate a new QR." });
      }

      const createdAt = new Date(tx.created_at).getTime();
      const elapsedSeconds = Number.isFinite(createdAt) ? Math.max(0, Math.round((Date.now() - createdAt) / 1000)) : 0;
      return res.status(200).json({
        success: true,
        status: tx.status || "pending",
        elapsedSeconds,
        amount: tx.amount,
      });
    } catch (error: any) {
      console.error("FamGateway status error:", error?.message || error);
      return res.status(500).json({ error: "Unable to check payment status." });
    }
  }

  /**
   * Authoritative re-check. The browser never needs this — the webhook settles
   * the order — but it lets the UI recover if a webhook was lost.
   */
  if (action === "verify") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!sameOriginIfPresent(req)) return res.status(403).json({ error: "Invalid request origin." });

    const rate = await checkRateLimit(`famgateway_verify_${authUser.userId}`, 12, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many verification attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(transactionId),
        user_id: new ObjectId(authUser.userId),
        method: "FAMGATEWAY_UPI",
      });
      if (!tx) return res.status(404).json({ error: "Payment request not found." });
      if (!tx.famgateway_order_id || !isFamGatewayOrderId(tx.famgateway_order_id)) {
        return res.status(400).json({ error: "This payment request has no provider reference." });
      }

      const order = await fetchFamGatewayOrder(tx.famgateway_order_id);
      if (order.status !== "success") {
        return res.status(200).json({
          success: true,
          status: order.status,
          message: order.status === "expired" ? "This payment request expired. Please generate a new QR." : "Waiting for payment confirmation.",
        });
      }

      const settledAmountPaise = order.payableAmount !== null
        ? Math.round(order.payableAmount * 100)
        : Math.round(Number(tx.amount_paise));
      if (settledAmountPaise !== Math.round(Number(tx.amount_paise))) {
        return res.status(400).json({ error: "The settled amount does not match this request. Please contact support." });
      }

      const result = await settleFamGatewayDeposit({
        internalTransactionId: transactionId,
        famgatewayOrderId: tx.famgateway_order_id,
        expectedUserId: authUser.userId,
        expectedAmountPaise: Math.round(Number(tx.amount_paise)),
        utr: order.utr,
        transactionId: order.transactionId,
        senderName: order.senderName,
        eventId: `famgateway_verify:${tx.famgateway_order_id}`,
        eventType: "payment.verified",
      });

      if (!result.alreadySettled && result.walletCredited) {
        sendPaymentSuccessAlert({
          userEmail: authUser.email,
          amount: result.amount,
          method: "UPI Automatic (FamGateway)",
          utr: order.utr || undefined,
          transactionId: order.transactionId || tx.famgateway_order_id,
          memo: tx.famgateway_order_id,
          newBalance: result.newBalance,
        }).catch((error) => console.error("FamGateway Telegram log error:", error));
      }

      return res.status(200).json({
        success: true,
        status: result.walletCredited ? "paid" : "test_paid",
        newBalance: result.newBalance,
        walletCredited: result.walletCredited,
        message: result.alreadySettled
          ? "Payment was already verified and credited to your wallet."
          : `Payment verified! ₹${result.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (error: any) {
      const status = error instanceof FamGatewayApiError ? error.status : 500;
      console.error("FamGateway verify error:", error?.message || error);
      return res.status(status).json({
        error: error instanceof FamGatewayApiError
          ? error.message
          : "Unable to verify the payment. Your payment remains safe for reconciliation.",
      });
    }
  }

  return res.status(404).json({ error: "UPI Automatic action not found." });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleFamGatewayRequest(req, res);
  } catch (error: any) {
    console.error("handleFamGatewayRequest uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
}
