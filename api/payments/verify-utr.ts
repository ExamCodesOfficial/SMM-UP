import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimit";
import { searchFamPayEmailByUTR } from "../lib/imap";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

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
    const db = await getDb();
    const userObjectId = new ObjectId(authUser.userId);

    // ── 1. ANTI-REPLAY CHECK IN MONGODB ──
    const alreadyProcessed = await db.collection("processed_transactions").findOne({ utr: cleanUtr });
    if (alreadyProcessed) {
      return res.status(400).json({
        error: "This 12-digit UTR has already been claimed and credited to an account.",
      });
    }

    // ── 2. SEARCH GMAIL INBOX VIA IMAP ──
    const parsedPayment = await searchFamPayEmailByUTR(cleanUtr);

    if (!parsedPayment) {
      return res.status(404).json({
        error: "UTR not found in FamPay bank records yet. If you completed payment within the last 60 seconds, please wait 30 seconds and retry.",
      });
    }

    // ── 3. STRICT AMOUNT VERIFICATION ──
    if (Math.abs(parsedPayment.amount - requestedAmount) > 0.05) {
      return res.status(400).json({
        error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but ₹${requestedAmount.toFixed(2)} was selected. Contact support with proof.`,
      });
    }

    // ── 4. ATOMIC DATABASE COMMIT ──
    // A. Record into processed_transactions (Enforces unique index)
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

    // B. Atomically credit user's wallet
    const updateResult = await db.collection("users").findOneAndUpdate(
      { _id: userObjectId },
      {
        $inc: { balance: parsedPayment.amount },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    // C. Update transaction ledger record
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
  } catch (err: any) {
    console.error("UTR verification error:", err);
    return res.status(500).json({
      error: "Internal error checking bank records. Please try again in a few moments.",
    });
  }
}
