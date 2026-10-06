import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb, getMongoClient } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { settleDirectUpiPayment } from "../../server/lib/directUpiSettlement.js";
import { searchFamPayPayment } from "../../server/lib/imap.js";
import { sendPaymentSuccessAlert, sendPaymentDelayAlert } from "../../server/lib/telegram.js";

/**
 * Generates SUP + 5-character uppercase alphanumeric memo
 * Total combinations: 36^5 = 60,466,176
 */
function generateDynamicMemo(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    const idx = crypto.randomInt(0, chars.length);
    suffix += chars[idx];
  }
  return "SUP" + suffix;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (denySupportMutation(authUser, res, action === "history" && req.method === "GET")) return;
  const userObjectId = new ObjectId(authUser.userId);
  if (["create-order", "verify-identifier", "verify-utr"].includes(String(action))) {
    const hold = await db.collection("users").findOne(
      { _id: userObjectId },
      { projection: { payment_hold: 1 } },
    );
    if (hold?.payment_hold) {
      return res.status(403).json({ error: "Deposits are temporarily paused on this account. Please contact support." });
    }
  }

  // ── 1. CREATE PAYMENT ORDER (DYNAMIC QR WITH SUP + 5-CHAR ALPHANUMERIC MEMO) ──
  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const createRate = await checkRateLimit(`payment_create_${authUser.userId}`, 8, 300, db);
    if (!createRate.allowed) return res.status(429).json({ error: `Too many payment requests. Try again in ${createRate.remainingSec}s.` });
    const { amount } = req.body || {};
    const numAmount = parseFloat(amount);

    const maxDirectUpiAmount = Math.max(10, Math.min(Number(process.env.DIRECT_UPI_MAX_AMOUNT_INR || 100_000), 1_000_000));
    if (!Number.isFinite(numAmount) || numAmount < 10 || numAmount > maxDirectUpiAmount || Math.abs(numAmount - Math.round(numAmount * 100) / 100) > 0.000001) {
      return res.status(400).json({ error: `Deposit amount must be between ₹10 and ₹${maxDirectUpiAmount.toLocaleString("en-IN")} with at most two decimals.` });
    }

    const upiVpa = process.env.UPI_VPA;
    const merchantName = process.env.UPI_MERCHANT_NAME || "SMM UP";
    if (!upiVpa) return res.status(500).json({ error: "Payment configuration missing. Contact support." });
    const memo = generateDynamicMemo();

    const upiQuery = new URLSearchParams({
      pa: upiVpa,
      pn: merchantName,
      am: numAmount.toFixed(2),
      tn: memo,
      tr: memo,
      cu: "INR",
    });

    const upiUrl = `upi://pay?${upiQuery.toString()}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(upiUrl)}`;

    try {
      const pendingTtlMinutes = Math.max(5, Math.min(Number.parseInt(String(process.env.DIRECT_UPI_PENDING_TTL_MINUTES || "30"), 10) || 30, 180));
      const createdAt = new Date();
      const newTx = {
        user_id: userObjectId,
        user_email: authUser.email,
        amount: numAmount,
        method: "FAMPAY_UPI",
        upi_id: upiVpa,
        memo: memo,
        status: "pending",
        delay_alert_sent: false,
        created_at: createdAt,
        expires_at: new Date(createdAt.getTime() + pendingTtlMinutes * 60_000),
      };

      const insertRes = await db.collection("transactions").insertOne(newTx);

      return res.status(200).json({
        success: true,
        transactionId: insertRes.insertedId.toString(),
        amount: numAmount,
        memo: memo,
        upiVpa: upiVpa,
        upiUrl: upiUrl,
        qrUrl: qrUrl,
      });
    } catch (err: any) {
      console.error("Create deposit order error:", err);
      return res.status(500).json({ error: "Failed to generate payment QR" });
    }
  }

  // ── 2. CHECK STATUS / LIVE POLLING (ZERO-CLICK AUTO-CREDIT VIA MEMO) ──
  if (action === "check-status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const memo = String(req.query.memo || req.body?.memo || "").trim().toUpperCase();
    const txnId = String(req.query.transactionId || req.body?.transactionId || "").trim();

    if (!memo && !txnId) {
      return res.status(400).json({ error: "memo or transactionId is required" });
    }
    if (!memo && !ObjectId.isValid(txnId)) {
      return res.status(400).json({ error: "Invalid Direct UPI transaction ID" });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        user_id: userObjectId,
        method: "FAMPAY_UPI",
        ...(memo ? { memo } : { _id: new ObjectId(txnId) }),
      });

      if (!tx) {
        return res.status(404).json({ error: "Deposit order not found" });
      }

      // Case 1: Already paid and credited
      if (tx.status === "paid") {
        const currentUser = await db.collection("users").findOne({ _id: userObjectId });
        return res.status(200).json({
          status: "paid",
          amount: tx.amount,
          utr: tx.utr,
          transactionId: tx.transaction_id,
          newBalance: currentUser?.balance || 0,
          alreadyCredited: true,
          message: "Payment confirmed and credited to wallet.",
        });
      }

      if (tx.status === "expired" || (tx.expires_at && new Date(tx.expires_at) <= new Date())) {
        if (tx.status === "pending") {
          await db.collection("transactions").updateOne(
            { _id: tx._id, status: "pending" },
            { $set: { status: "expired", expired_at: new Date() } },
          );
        }
        return res.status(200).json({ status: "expired", message: "This payment request expired. Generate a fresh QR." });
      }

      // Calculate elapsed waiting time
      const createdAt = new Date(tx.created_at).getTime();
      const elapsedSeconds = Math.max(0, (Date.now() - createdAt) / 1000);

      // Trigger Delayed Payment Alert to Telegram Admin Group (between 60-90s, sent once)
      if (elapsedSeconds >= 75 && !tx.delay_alert_sent) {
        await db.collection("transactions").updateOne(
          { _id: tx._id },
          { $set: { delay_alert_sent: true, delay_alert_at: new Date() } }
        );

        sendPaymentDelayAlert({
          userEmail: authUser.email,
          amount: tx.amount,
          memo: tx.memo,
          elapsedSeconds: elapsedSeconds,
          upiVpa: tx.upi_id,
        }).catch((e) => console.error("Delay alert send error:", e));
      }

      // MongoDB poll only: instant 1ms response, 0 Gmail IMAP connections
      return res.status(200).json({
        status: "pending",
        elapsedSeconds: Math.round(elapsedSeconds),
        memo: tx.memo,
      });
    } catch (err: any) {
      console.error("Check status error:", err);
      return res.status(500).json({ error: "Failed to check payment status" });
    }
  }

  // ── 3. MANUAL VERIFICATION: ACCEPTS 12-DIGIT UTR, FAMPAY TX ID, OR REF ──────
  if (action === "verify-identifier" || action === "verify-utr") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Rate limit: max 5 verification attempts per 3 minutes (cooldown guard)
    const rateLimitKey = `payment_verify_${authUser.userId}`;
    const { allowed, remainingSec } = await checkRateLimit(rateLimitKey, 5, 180, db);
    if (!allowed) {
      return res.status(429).json({
        error: `Too many verification requests. Please wait ${remainingSec} seconds before submitting again.`,
      });
    }

    const { identifier, utr, amount, transactionId, memo } = req.body || {};
    const pendingTransactionId = String(transactionId || "").trim();
    const expectedMemo = String(memo || "").trim().toUpperCase();
    const rawInput = String(identifier || utr || "").trim();
    // Sanitize strictly to alphanumeric characters
    const cleanInput = rawInput.replace(/[^A-Za-z0-9]/g, "");
    const requestedAmount = parseFloat(amount);

    if (!cleanInput || cleanInput.length < 6 || cleanInput.length > 40) {
      return res.status(400).json({
        error: "Please enter a valid 12-digit UTR, FamPay Transaction ID, or Bank Reference number.",
      });
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount specified." });
    }

    if (!ObjectId.isValid(pendingTransactionId)) {
      return res.status(400).json({ error: "The pending deposit reference is missing or invalid. Please create a fresh payment request." });
    }

    try {
      const pendingId = new ObjectId(pendingTransactionId);
      const pendingDeposit = await db.collection("transactions").findOne({
        _id: pendingId,
        user_id: userObjectId,
        method: "FAMPAY_UPI",
        amount: requestedAmount,
        status: "pending",
        expires_at: { $gt: new Date() },
      });
      if (!pendingDeposit) {
        return res.status(400).json({
          error: "This exact pending Direct UPI deposit is missing, expired, or already settled. Please generate a fresh QR.",
        });
      }
      const storedMemo = String(pendingDeposit.memo || "").trim().toUpperCase();
      if (!expectedMemo || expectedMemo !== storedMemo) {
        return res.status(400).json({ error: "The payment memo does not match this pending deposit." });
      }

      const parsedPayment = await searchFamPayPayment({
        identifier: cleanInput,
        expectedAmount: requestedAmount,
      });
      if (!parsedPayment) {
        return res.status(404).json({
          error: "Record not found in bank records yet. If you just paid, wait 15–30 seconds and retry.",
        });
      }
      if (Math.round(parsedPayment.amount * 100) !== Math.round(requestedAmount * 100)) {
        return res.status(400).json({
          error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but ₹${requestedAmount.toFixed(2)} was selected. Contact support with proof.`,
        });
      }
      if (!parsedPayment.purpose) {
        await db.collection("payment_reconciliation").updateOne(
          { memo: storedMemo, status: "open", reason: "receipt_memo_missing" },
          {
            $set: { pending_transaction_id: pendingId, user_id: userObjectId, identifier: cleanInput, last_seen_at: new Date() },
            $inc: { attempts: 1 },
            $setOnInsert: { created_at: new Date(), status: "open" },
          },
          { upsert: true },
        );
        return res.status(409).json({ error: "The bank receipt did not include the exact payment memo, so it was not credited automatically. Support has been notified for reconciliation." });
      }
      const receiptMemo = String(parsedPayment.purpose).trim().toUpperCase();
      if (receiptMemo !== storedMemo) {
        return res.status(400).json({ error: "The bank receipt memo does not match this pending deposit." });
      }

      const finalUtr = String(parsedPayment.utr || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const finalTxId = String(parsedPayment.transactionId || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const client = await getMongoClient();
      const { newBalance } = await settleDirectUpiPayment({
        db,
        client,
        userId: userObjectId,
        userEmail: authUser.email,
        pendingId,
        expectedAmount: requestedAmount,
        expectedMemo: storedMemo,
        receivedAmount: parsedPayment.amount,
        receiptMemo: parsedPayment.purpose,
        utr: finalUtr,
        transactionId: finalTxId,
        sender: parsedPayment.sender,
        source: "manual_identifier_verify",
      });

      sendPaymentSuccessAlert({
        userEmail: authUser.email,
        amount: parsedPayment.amount,
        method: "Manual UTR/TxID Submission",
        utr: finalUtr,
        transactionId: finalTxId,
        memo: parsedPayment.purpose || storedMemo,
        newBalance,
      }).catch((e) => console.error("Telegram log error:", e));

      return res.status(200).json({
        success: true,
        amount: parsedPayment.amount,
        utr: finalUtr,
        transactionId: finalTxId,
        newBalance,
        message: `Payment verified! ₹${parsedPayment.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ error: "This payment has already been claimed or settled." });
      }
      if (err?.code === "PENDING_DEPOSIT_STALE") {
        return res.status(409).json({ error: "This pending deposit expired or was settled by another request." });
      }
      if (err?.code === "PAYMENT_HOLD_ACTIVE") {
        return res.status(403).json({ error: "Deposits are temporarily disabled for this account." });
      }
      if (err?.code === "RECEIPT_MISMATCH") {
        return res.status(400).json({ error: "The receipt does not match this pending deposit." });
      }
      console.error("Manual verify error:", err);
      return res.status(500).json({ error: "Internal error checking bank records. Please try again in a few moments." });
    }
  }

  // ── 4. TRANSACTION HISTORY ───────────────────────────────────
  if (action === "history") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      const transactions = await db
        .collection("transactions")
        .find({ user_id: userObjectId })
        .sort({ created_at: -1 })
        .limit(30)
        .toArray();

      const formatted = transactions.map((t) => ({
        id: t._id.toString(),
        amount: t.amount,
        method: t.method || "UPI",
        memo: t.memo,
        utr: t.utr || "—",
        transactionId: t.transaction_id || t.razorpay_payment_id || t.razorpay_order_id || "—",
        environment: t.environment,
        status: t.status,
        createdAt: t.created_at,
        paidAt: t.paid_at,
      }));

      return res.status(200).json({ success: true, transactions: formatted });
    } catch {
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }
  }

  return res.status(404).json({ error: "Payments action not found" });
}
