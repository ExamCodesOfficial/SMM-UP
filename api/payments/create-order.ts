import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { amount } = req.body || {};
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount < 10) {
    return res.status(400).json({ error: "Minimum deposit is ₹10.00 INR" });
  }

  const upiVpa = process.env.UPI_VPA || "***REMOVED_UPI_VPA***";
  const merchantName = process.env.UPI_MERCHANT_NAME || "SMM UP Official";

  // Generate unique memo tracking ID (e.g. SUP9F8A2B)
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
    const db = await getDb();
    const newTx = {
      user_id: new ObjectId(authUser.userId),
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
  } catch (err) {
    console.error("Create payment order error:", err);
    return res.status(500).json({ error: "Failed to generate payment QR" });
  }
}
