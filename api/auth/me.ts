import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: new ObjectId(authUser.userId) });

    if (!user) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        balance: user.balance || 0.0,
        total_spent: user.total_spent || 0.0,
        total_orders: user.total_orders || 0,
        role: user.role || "user",
        apiKey: user.api_key,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    console.error("Auth check error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
