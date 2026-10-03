import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { requestOrderRefill } from "../lib/smm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  try {
    const db = await getDb();
    const order = await db.collection("orders").findOne({
      _id: new ObjectId(String(id)),
      user_id: new ObjectId(authUser.userId),
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.provider_order_id) {
      return res.status(400).json({ error: "Invalid provider order ID" });
    }

    const refillRes = await requestOrderRefill(order.provider_order_id);

    if (refillRes.error) {
      return res.status(400).json({ error: refillRes.error });
    }

    const refillId = refillRes.refill;
    await db.collection("orders").updateOne(
      { _id: order._id },
      {
        $set: {
          refill_id: refillId,
          last_refill_at: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Refill request accepted by provider node",
      refillId,
    });
  } catch (err: any) {
    console.error("Refill error:", err);
    return res.status(500).json({ error: "Refill request failed" });
  }
}
