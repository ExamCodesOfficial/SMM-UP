import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { ensureRazorpayIndexes, getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  RazorpayApiError,
  createRazorpayOrder,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  getRazorpayConfig,
  hasRazorpayConfig,
  verifyRazorpayCheckoutSignature,
  type RazorpayPayment,
} from "../../server/lib/razorpay.js";
import {
  WalletSettlementError,
  settleRazorpayDeposit,
  type RazorpaySettlementResult,
} from "../../server/lib/wallet.js";
import { sendPaymentSuccessAlert } from "../../server/lib/telegram.js";

const MIN_DEPOSIT_INR = 10;
const DEFAULT_MAX_DEPOSIT_INR = 100_000;

function maxDepositInr(): number {
  const configured = Number(process.env.RAZORPAY_MAX_DEPOSIT_INR || DEFAULT_MAX_DEPOSIT_INR);
  return Number.isFinite(configured) && configured >= MIN_DEPOSIT_INR
    ? configured
    : DEFAULT_MAX_DEPOSIT_INR;
}

function parseAmountPaise(value: unknown): { amount: number; amountPaise: number } | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const amountPaise = Math.round(amount * 100);
  if (Math.abs(amount * 100 - amountPaise) > 0.0001) return null;
  if (amountPaise < MIN_DEPOSIT_INR * 100 || amountPaise > maxDepositInr() * 100) return null;
  return { amount: amountPaise / 100, amountPaise };
}

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validId(value: unknown, prefix: "order" | "pay"): string | null {
  const text = String(value || "").trim();
  return new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(text) ? text : null;
}

function settlementMessage(result: RazorpaySettlementResult): string {
  if (result.testMode && !result.walletCredited) {
    return "Razorpay Test Mode payment verified successfully. No live wallet balance was added.";
  }
  if (result.alreadySettled) return "Payment was already verified and credited to your wallet.";
  return `Payment verified! ₹${result.amount.toFixed(2)} added to your wallet balance.`;
}

async function sendSuccessLog(
  authEmail: string,
  payment: RazorpayPayment,
  result: RazorpaySettlementResult,
) {
  if (result.alreadySettled || !result.walletCredited) return;
  sendPaymentSuccessAlert({
    userEmail: authEmail,
    amount: result.amount,
    method: `Razorpay ${payment.method || "Checkout"}`,
    transactionId: payment.id,
    memo: payment.order_id,
    newBalance: result.newBalance,
  }).catch((error) => console.error("Razorpay Telegram log error:", error));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "");
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
  if (denySupportMutation(authUser, res, action === "config" && req.method === "GET")) return;

  if (["create-order", "verify"].includes(action) && !sameOriginIfPresent(req)) {
    return res.status(403).json({ error: "Invalid request origin." });
  }

  if (action === "config") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!hasRazorpayConfig()) {
      return res.status(200).json({
        enabled: false,
        mode: "test",
        minAmount: MIN_DEPOSIT_INR,
        maxAmount: maxDepositInr(),
        message: "Razorpay Checkout is awaiting activation.",
      });
    }
    try {
      const config = getRazorpayConfig();
      return res.status(200).json({
        enabled: true,
        mode: config.mode,
        minAmount: MIN_DEPOSIT_INR,
        maxAmount: maxDepositInr(),
        testWalletCreditEnabled: config.mode === "test" && config.allowTestWalletCredit,
      });
    } catch (error: any) {
      return res.status(503).json({ enabled: false, error: error.message });
    }
  }

  const userObjectId = new ObjectId(authUser.userId);

  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rate = checkRateLimit(`razorpay_create_${authUser.userId}`, 8, 300);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Too many payment attempts. Please wait ${rate.remainingSec} seconds.`,
      });
    }

    const parsed = parseAmountPaise(req.body?.amount);
    if (!parsed) {
      return res.status(400).json({
        error: `Enter an amount from ₹${MIN_DEPOSIT_INR} to ₹${maxDepositInr().toLocaleString("en-IN")} with at most 2 decimal places.`,
      });
    }

    let transactionId: ObjectId | null = null;
    try {
      await ensureRazorpayIndexes();
      const config = getRazorpayConfig();
      const now = new Date();
      const insert = await db.collection("transactions").insertOne({
        user_id: userObjectId,
        user_email: authUser.email,
        amount: parsed.amount,
        amount_paise: parsed.amountPaise,
        currency: "INR",
        method: "RAZORPAY",
        provider: "razorpay",
        environment: config.mode,
        status: "creating",
        wallet_credited: false,
        created_at: now,
        updated_at: now,
        expires_at: new Date(now.getTime() + 30 * 60 * 1000),
      });
      transactionId = insert.insertedId;

      const order = await createRazorpayOrder({
        amountPaise: parsed.amountPaise,
        receipt: `SUP-${transactionId.toString()}`,
        internalTransactionId: transactionId.toString(),
      });

      if (
        !/^order_[A-Za-z0-9]+$/.test(order.id) ||
        order.status !== "created" ||
        order.amount !== parsed.amountPaise ||
        order.currency !== "INR"
      ) {
        throw new RazorpayApiError("Razorpay returned an invalid order response.", 502);
      }

      await db.collection("transactions").updateOne(
        { _id: transactionId, status: "creating" },
        {
          $set: {
            status: "pending",
            razorpay_order_id: order.id,
            razorpay_order_status: order.status,
            updated_at: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        mode: config.mode,
        keyId: config.keyId,
        internalTransactionId: transactionId.toString(),
        orderId: order.id,
        amount: parsed.amount,
        amountPaise: parsed.amountPaise,
        currency: "INR",
        prefill: {
          name: authUser.username,
          email: authUser.email,
        },
      });
    } catch (error: any) {
      if (transactionId) {
        await db.collection("transactions").updateOne(
          { _id: transactionId, status: "creating" },
          {
            $set: {
              status: "failed",
              failure_stage: "razorpay_order_creation",
              updated_at: new Date(),
            },
          },
        ).catch(() => {});
      }
      const status = error instanceof RazorpayApiError ? error.status : 502;
      console.error("Razorpay create-order error:", error?.message || error);
      return res.status(status).json({
        error: error instanceof RazorpayApiError
          ? error.message
          : "Unable to start Razorpay Checkout. Please try Direct UPI or retry shortly.",
      });
    }
  }

  if (action === "verify") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rate = checkRateLimit(`razorpay_verify_${authUser.userId}`, 12, 300);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Too many verification attempts. Please wait ${rate.remainingSec} seconds.`,
      });
    }

    const internalTransactionId = String(req.body?.internalTransactionId || "").trim();
    const returnedOrderId = validId(req.body?.razorpay_order_id, "order");
    const paymentId = validId(req.body?.razorpay_payment_id, "pay");
    const signature = String(req.body?.razorpay_signature || "").trim();

    if (!ObjectId.isValid(internalTransactionId) || !returnedOrderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({ error: "Invalid Razorpay verification payload." });
    }

    try {
      const config = getRazorpayConfig();
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(internalTransactionId),
        user_id: userObjectId,
        method: "RAZORPAY",
      });
      if (!tx) return res.status(404).json({ error: "Razorpay deposit not found." });
      if (!tx.razorpay_order_id || tx.razorpay_order_id !== returnedOrderId) {
        return res.status(400).json({ error: "Razorpay order does not match this deposit." });
      }

      const signatureValid = verifyRazorpayCheckoutSignature({
        serverOrderId: tx.razorpay_order_id,
        paymentId,
        signature,
      });
      if (!signatureValid) {
        return res.status(400).json({ error: "Razorpay payment signature is invalid." });
      }

      await db.collection("transactions").updateOne(
        {
          _id: tx._id,
          $or: [
            { razorpay_payment_id: { $exists: false } },
            { razorpay_payment_id: paymentId },
          ],
        },
        {
          $set: {
            razorpay_payment_id: paymentId,
            checkout_signature_verified: true,
            status: tx.status === "pending" ? "processing" : tx.status,
            updated_at: new Date(),
          },
        },
      );

      const payment = await fetchRazorpayPayment(paymentId);
      if (payment.order_id !== tx.razorpay_order_id || payment.amount !== tx.amount_paise || payment.currency !== "INR") {
        return res.status(400).json({ error: "Razorpay payment details do not match this deposit." });
      }
      if (payment.status !== "captured" || !payment.captured) {
        await db.collection("transactions").updateOne(
          { _id: tx._id },
          { $set: { status: payment.status === "authorized" ? "authorized" : "processing", updated_at: new Date() } },
        );
        return res.status(202).json({
          success: true,
          status: payment.status,
          internalTransactionId,
          message: "Payment received. Waiting for Razorpay capture confirmation.",
        });
      }

      const result = await settleRazorpayDeposit({
        internalTransactionId,
        expectedUserId: authUser.userId,
        payment,
        mode: config.mode,
        allowTestWalletCredit: config.allowTestWalletCredit,
      });
      await sendSuccessLog(authUser.email, payment, result);

      return res.status(200).json({
        success: true,
        status: result.walletCredited ? "paid" : "test_paid",
        newBalance: result.newBalance,
        walletCredited: result.walletCredited,
        testMode: result.testMode,
        message: settlementMessage(result),
      });
    } catch (error: any) {
      const status = error instanceof RazorpayApiError || error instanceof WalletSettlementError
        ? error.status
        : 500;
      console.error("Razorpay verify error:", error?.message || error);
      return res.status(status).json({
        error: error instanceof RazorpayApiError || error instanceof WalletSettlementError
          ? error.message
          : "Razorpay verification could not be completed. Your payment remains safe for reconciliation.",
      });
    }
  }

  if (action === "status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const rate = checkRateLimit(`razorpay_status_${authUser.userId}`, 90, 300);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Too many status checks. Please wait ${rate.remainingSec} seconds.`,
      });
    }
    const transactionId = String(req.query.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    try {
      const config = getRazorpayConfig();
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(transactionId),
        user_id: userObjectId,
        method: "RAZORPAY",
      });
      if (!tx) return res.status(404).json({ error: "Razorpay deposit not found." });

      if (tx.status === "paid" || tx.status === "test_paid") {
        const user = await db.collection("users").findOne({ _id: userObjectId });
        return res.status(200).json({
          success: true,
          status: tx.status,
          newBalance: Number(user?.balance || 0),
          walletCredited: tx.wallet_credited !== false,
          testMode: tx.environment === "test",
          message: tx.wallet_credited === false
            ? "Razorpay Test Mode payment verified successfully. No live wallet balance was added."
            : "Payment confirmed and credited to your wallet.",
        });
      }

      if (!tx.razorpay_order_id) {
        return res.status(200).json({ success: true, status: tx.status || "pending" });
      }

      const payments = await fetchRazorpayOrderPayments(tx.razorpay_order_id);
      const captured = payments.find(
        (payment) => payment.status === "captured" && payment.captured === true,
      );
      if (!captured) {
        return res.status(200).json({
          success: true,
          status: payments.some((payment) => payment.status === "authorized")
            ? "authorized"
            : "pending",
          message: "Waiting for Razorpay payment confirmation.",
        });
      }

      const result = await settleRazorpayDeposit({
        internalTransactionId: transactionId,
        expectedUserId: authUser.userId,
        payment: captured,
        mode: config.mode,
        allowTestWalletCredit: config.allowTestWalletCredit,
      });
      await sendSuccessLog(authUser.email, captured, result);
      return res.status(200).json({
        success: true,
        status: result.walletCredited ? "paid" : "test_paid",
        newBalance: result.newBalance,
        walletCredited: result.walletCredited,
        testMode: result.testMode,
        message: settlementMessage(result),
      });
    } catch (error: any) {
      const status = error instanceof RazorpayApiError || error instanceof WalletSettlementError
        ? error.status
        : 500;
      return res.status(status).json({
        error: error instanceof RazorpayApiError || error instanceof WalletSettlementError
          ? error.message
          : "Unable to check Razorpay payment status.",
      });
    }
  }

  return res.status(404).json({ error: "Razorpay action not found." });
}
