import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = await getDb();
    const transactions = await db
      .collection("transactions")
      .find({ user_id: new ObjectId(authUser.userId) })
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

    return res.status(200).json({
      success: true,
      transactions: formatted,
    });
  } catch (err) {
    console.error("Payment history error:", err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
