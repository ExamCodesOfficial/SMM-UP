import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { getWholesaleBalance } from "../lib/smm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = getUserFromRequest(req);
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin authorization required." });
  }

  const db = await getDb();

  // POST: Admin manual balance adjustment
  if (req.method === "POST") {
    const { targetEmail, amountAdjustment, reason } = req.body || {};
    const amt = parseFloat(amountAdjustment);

    if (!targetEmail || isNaN(amt)) {
      return res.status(400).json({ error: "Target email and adjustment amount are required" });
    }

    const targetUser = await db.collection("users").findOneAndUpdate(
      { email: String(targetEmail).trim().toLowerCase() },
      { $inc: { balance: amt }, $set: { updated_at: new Date() } },
      { returnDocument: "after" }
    );

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Updated balance for ${targetEmail}. New balance: ₹${targetUser.balance.toFixed(2)}`,
      user: {
        email: targetUser.email,
        balance: targetUser.balance,
      },
    });
  }

  // GET: Platform overview statistics
  try {
    const [totalUsers, totalOrders, totalDeposits, wholesaleInfo] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("orders").countDocuments(),
      db.collection("transactions").countDocuments({ status: "paid" }),
      getWholesaleBalance().catch(() => ({ balance: 0, currency: "INR" })),
    ]);

    // Calculate gross profit from orders
    const profitAgg = await db
      .collection("orders")
      .aggregate([{ $group: { _id: null, totalProfit: { $sum: "$profit" }, totalCharge: { $sum: "$charge" } } }])
      .toArray();

    const totalProfit = profitAgg[0]?.totalProfit || 0;
    const totalRevenue = profitAgg[0]?.totalCharge || 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        totalDeposits,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        wholesaleBalance: wholesaleInfo.balance,
        wholesaleCurrency: wholesaleInfo.currency,
      },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return res.status(500).json({ error: "Failed to load admin statistics" });
  }
}
