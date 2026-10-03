import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { checkOrderStatus } from "../lib/smm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
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
      return res.status(400).json({ error: "No upstream provider order ID" });
    }

    const liveStatus = await checkOrderStatus(order.provider_order_id);

    if (liveStatus && liveStatus.status) {
      const updatedStatus = liveStatus.status;
      await db.collection("orders").updateOne(
        { _id: order._id },
        {
          $set: {
            status: updatedStatus,
            start_count: liveStatus.start_count,
            remains: liveStatus.remains,
            updated_at: new Date(),
          },
        }
      );

      return res.status(200).json({
        success: true,
        status: updatedStatus,
        start_count: liveStatus.start_count,
        remains: liveStatus.remains,
      });
    }

    return res.status(200).json({ success: true, status: order.status });
  } catch (err) {
    console.error("Status check error:", err);
    return res.status(500).json({ error: "Failed to check order status" });
  }
}
