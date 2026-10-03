import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { searchFamPayEmailByUTR } from "../lib/imap";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  const userObjectId = new ObjectId(authUser.userId);

  // ── 1. CREATE PAYMENT ORDER ──────────────────────────────────
  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { amount } = req.body || {};
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 10) {
      return res.status(400).json({ error: "Minimum deposit is ₹10.00 INR" });
    }

    const upiVpa = process.env.UPI_VPA || "***REMOVED_UPI_VPA***";
    const merchantName = process.env.UPI_MERCHANT_NAME || "SMM UP Official";
    const memo = "SUP" + crypto.randomBytes(3).toString("hex").toUpperCase();

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
    } catch {
      return res.status(500).json({ error: "Failed to generate payment QR" });
    }
  }

  // ── 2. VERIFY 12-DIGIT UTR ───────────────────────────────────
  if (action === "verify-utr") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Sliding window rate limit: max 5 attempts per 3 minutes
    const rateLimitKey = `utr_submit_${authUser.userId}`;
    const { allowed, remainingSec } = checkRateLimit(rateLimitKey, 5, 180);
    if (!allowed) {
      return res.status(429).json({
        error: `Too many verification requests. Please wait ${remainingSec} seconds before submitting again.`,
      });
    }

    const { utr, amount } = req.body || {};
    const cleanUtr = String(utr || "").trim();
    const requestedAmount = parseFloat(amount);

    if (!/^\d{12}$/.test(cleanUtr)) {
      return res.status(400).json({
        error: "Invalid UTR number. Please enter the exact 12-digit numeric UTR/Reference ID from your UPI receipt.",
      });
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount specified." });
    }

    try {
      // Check Anti-Replay in MongoDB
      const alreadyProcessed = await db.collection("processed_transactions").findOne({ utr: cleanUtr });
      if (alreadyProcessed) {
        return res.status(400).json({
          error: "This 12-digit UTR has already been claimed and credited to an account.",
        });
      }

      // Search Gmail Inbox via IMAP
      const parsedPayment = await searchFamPayEmailByUTR(cleanUtr);
      if (!parsedPayment) {
        return res.status(404).json({
          error: "UTR not found in FamPay bank records yet. If you completed payment within the last 60 seconds, please wait 30 seconds and retry.",
        });
      }

      // Strict Amount Check
      if (Math.abs(parsedPayment.amount - requestedAmount) > 0.05) {
        return res.status(400).json({
          error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but ₹${requestedAmount.toFixed(2)} was selected. Contact support with proof.`,
        });
      }

      // Record into processed_transactions
      try {
        await db.collection("processed_transactions").insertOne({
          utr: cleanUtr,
          transaction_id: parsedPayment.transactionId || `TXN_${cleanUtr}`,
          amount: parsedPayment.amount,
          user_id: userObjectId,
          user_email: authUser.email,
          purpose: parsedPayment.purpose || "",
          processed_at: new Date(),
        });
      } catch (dupErr: any) {
        if (dupErr.code === 11000) {
          return res.status(400).json({
            error: "This UTR was already processed in another concurrent request.",
          });
        }
        throw dupErr;
      }

      // Credit User Wallet
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
            utr: cleanUtr,
            transaction_id: parsedPayment.transactionId,
            paid_at: new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        amount: parsedPayment.amount,
        utr: cleanUtr,
        newBalance: updateResult?.balance ?? parsedPayment.amount,
        message: `Payment verified! ₹${parsedPayment.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (err) {
      return res.status(500).json({
        error: "Internal error checking bank records. Please try again in a few moments.",
      });
    }
  }

  // ── 3. TRANSACTION HISTORY ───────────────────────────────────
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
