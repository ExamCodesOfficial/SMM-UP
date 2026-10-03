import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { getUserFromRequest } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";
import { searchFamPayPayment } from "../lib/imap.js";
import { sendPaymentSuccessAlert, sendPaymentDelayAlert } from "../lib/telegram.js";

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
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  const userObjectId = new ObjectId(authUser.userId);

  // ── 1. CREATE PAYMENT ORDER (DYNAMIC QR WITH SUP + 5-CHAR ALPHANUMERIC MEMO) ──
  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { amount } = req.body || {};
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 10) {
      return res.status(400).json({ error: "Minimum deposit is ₹10.00 INR" });
    }

    const upiVpa = process.env.UPI_VPA || "***REMOVED_UPI_VPA***";
    const merchantName = process.env.UPI_MERCHANT_NAME || "SMM UP Official";
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
      const newTx = {
        user_id: userObjectId,
        user_email: authUser.email,
        amount: numAmount,
        method: "FAMPAY_UPI",
        upi_id: upiVpa,
        memo: memo,
        status: "pending",
        delay_alert_sent: false,
        created_at: new Date(),
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
    const memo = String(req.query.memo || req.body?.memo || "").trim().toUpperCase();
    const txnId = String(req.query.transactionId || req.body?.transactionId || "").trim();

    if (!memo && !txnId) {
      return res.status(400).json({ error: "memo or transactionId is required" });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        user_id: userObjectId,
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

      // Live IMAP Check for incoming email with this memo
      const parsedPayment = await searchFamPayPayment({
        memo: tx.memo,
        expectedAmount: tx.amount,
        minDate: tx.created_at,
      });

      if (parsedPayment) {
        const cleanUtr = parsedPayment.utr || `MEMO_${tx.memo}`;
        const cleanTxId = parsedPayment.transactionId || `TXN_${tx.memo}`;

        // Check Anti-Replay
        const alreadyClaimed = await db.collection("processed_transactions").findOne({
          $or: [
            { memo: tx.memo },
            { utr: cleanUtr },
            ...(parsedPayment.transactionId ? [{ transaction_id: parsedPayment.transactionId }] : []),
          ],
        });

        if (alreadyClaimed) {
          await db.collection("transactions").updateOne(
            { _id: tx._id },
            { $set: { status: "paid", utr: cleanUtr, transaction_id: cleanTxId, paid_at: new Date() } }
          );

          const currentUser = await db.collection("users").findOne({ _id: userObjectId });
          return res.status(200).json({
            status: "paid",
            amount: tx.amount,
            utr: cleanUtr,
            newBalance: currentUser?.balance || 0,
            message: "Payment previously verified and credited.",
          });
        }

        // Insert into processed_transactions
        try {
          await db.collection("processed_transactions").insertOne({
            memo: tx.memo,
            utr: cleanUtr,
            transaction_id: cleanTxId,
            amount: parsedPayment.amount,
            user_id: userObjectId,
            user_email: authUser.email,
            sender: parsedPayment.sender || "",
            method: "FAMPAY_MEMO_AUTODETECT",
            processed_at: new Date(),
          });
        } catch (dupErr: any) {
          if (dupErr.code === 11000) {
            const currentUser = await db.collection("users").findOne({ _id: userObjectId });
            return res.status(200).json({
              status: "paid",
              amount: tx.amount,
              newBalance: currentUser?.balance || 0,
            });
          }
          throw dupErr;
        }

        // Atomic Wallet Increment
        const updateResult: any = await db.collection("users").findOneAndUpdate(
          { _id: userObjectId },
          {
            $inc: { balance: parsedPayment.amount },
            $set: { updated_at: new Date() },
          },
          { returnDocument: "after" }
        );

        // Update Ledger
        await db.collection("transactions").updateOne(
          { _id: tx._id },
          {
            $set: {
              status: "paid",
              utr: cleanUtr,
              transaction_id: cleanTxId,
              sender: parsedPayment.sender,
              paid_at: new Date(),
            },
          }
        );

        const newBalance = updateResult?.balance ?? parsedPayment.amount;

        // Dispatch Payment Success Audit Log to Telegram Admin Group
        sendPaymentSuccessAlert({
          userEmail: authUser.email,
          amount: parsedPayment.amount,
          method: "Dynamic QR Auto-Detect (Memo)",
          memo: tx.memo,
          utr: parsedPayment.utr,
          transactionId: parsedPayment.transactionId,
          newBalance: newBalance,
        }).catch((e) => console.error("Telegram log error:", e));

        return res.status(200).json({
          status: "paid",
          amount: parsedPayment.amount,
          memo: tx.memo,
          utr: cleanUtr,
          newBalance: newBalance,
          message: `Payment confirmed! ₹${parsedPayment.amount.toFixed(2)} credited automatically.`,
        });
      }

      // Still awaiting bank notification
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

    // Rate limit: max 5 verification attempts per 3 minutes
    const rateLimitKey = `payment_verify_${authUser.userId}`;
    const { allowed, remainingSec } = checkRateLimit(rateLimitKey, 5, 180);
    if (!allowed) {
      return res.status(429).json({
        error: `Too many verification requests. Please wait ${remainingSec} seconds before submitting again.`,
      });
    }

    const { identifier, utr, amount } = req.body || {};
    const rawInput = String(identifier || utr || "").trim();
    const requestedAmount = parseFloat(amount);

    if (!rawInput || rawInput.length < 6 || rawInput.length > 40) {
      return res.status(400).json({
        error: "Please enter a valid 12-digit UTR, FamPay Transaction ID, or Bank Reference number.",
      });
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount specified." });
    }

    try {
      // Check Anti-Replay in MongoDB
      const alreadyProcessed = await db.collection("processed_transactions").findOne({
        $or: [
          { utr: rawInput },
          { transaction_id: rawInput },
          { memo: rawInput.toUpperCase() },
        ],
      });

      if (alreadyProcessed) {
        return res.status(400).json({
          error: "This Transaction ID / UTR has already been claimed and credited.",
        });
      }

      // Search Gmail Inbox via IMAP
      const parsedPayment = await searchFamPayPayment({
        identifier: rawInput,
        expectedAmount: requestedAmount,
      });

      if (!parsedPayment) {
        return res.status(404).json({
          error:
            "Record not found in bank records yet. If you completed payment within the last 60 seconds, please wait 15–30 seconds and retry.",
        });
      }

      // Verify Amount
      if (Math.abs(parsedPayment.amount - requestedAmount) > 0.05) {
        return res.status(400).json({
          error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but ₹${requestedAmount.toFixed(2)} was selected. Contact support with proof.`,
        });
      }

      const finalUtr = parsedPayment.utr || rawInput;
      const finalTxId = parsedPayment.transactionId || rawInput;

      // Double-check Anti-Replay with resolved parsed identifiers
      const secondCheck = await db.collection("processed_transactions").findOne({
        $or: [
          { utr: finalUtr },
          { transaction_id: finalTxId },
          ...(parsedPayment.purpose ? [{ memo: parsedPayment.purpose }] : []),
        ],
      });

      if (secondCheck) {
        return res.status(400).json({
          error: "This payment has already been credited to an account.",
        });
      }

      // Record into processed_transactions
      try {
        await db.collection("processed_transactions").insertOne({
          utr: finalUtr,
          transaction_id: finalTxId,
          memo: parsedPayment.purpose || "",
          amount: parsedPayment.amount,
          user_id: userObjectId,
          user_email: authUser.email,
          sender: parsedPayment.sender || "",
          method: "MANUAL_IDENTIFIER_VERIFY",
          processed_at: new Date(),
        });
      } catch (dupErr: any) {
        if (dupErr.code === 11000) {
          return res.status(400).json({
            error: "This transaction was already processed in another concurrent request.",
          });
        }
        throw dupErr;
      }

      // Credit User Wallet Atomically
      const updateResult: any = await db.collection("users").findOneAndUpdate(
        { _id: userObjectId },
        {
          $inc: { balance: parsedPayment.amount },
          $set: { updated_at: new Date() },
        },
        { returnDocument: "after" }
      );

      // Update Ledger
      await db.collection("transactions").updateOne(
        { user_id: userObjectId, amount: requestedAmount, status: "pending" },
        {
          $set: {
            status: "paid",
            utr: finalUtr,
            transaction_id: finalTxId,
            sender: parsedPayment.sender,
            paid_at: new Date(),
          },
        }
      );

      const newBalance = updateResult?.balance ?? parsedPayment.amount;

      // Dispatch Payment Success Audit Log to Telegram Admin Group
      sendPaymentSuccessAlert({
        userEmail: authUser.email,
        amount: parsedPayment.amount,
        method: "Manual UTR/TxID Submission",
        utr: finalUtr,
        transactionId: finalTxId,
        memo: parsedPayment.purpose,
        newBalance: newBalance,
      }).catch((e) => console.error("Telegram log error:", e));

      return res.status(200).json({
        success: true,
        amount: parsedPayment.amount,
        utr: finalUtr,
        transactionId: finalTxId,
        newBalance: newBalance,
        message: `Payment verified! ₹${parsedPayment.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (err: any) {
      console.error("Manual verify error:", err);
      return res.status(500).json({
        error: "Internal error checking bank records. Please try again in a few moments.",
      });
    }
  }

  // ── 4. TRANSACTION HISTORY ───────────────────────────────────
  if (action === "history") {
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
        transactionId: t.transaction_id || "—",
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
