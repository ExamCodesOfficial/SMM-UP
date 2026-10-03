import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const limit = parseInt(String(req.query.limit || "50"), 10);
  const statusFilter = String(req.query.status || "").trim();

  try {
    const db = await getDb();
    const query: any = { user_id: new ObjectId(authUser.userId) };

    if (statusFilter && statusFilter !== "All") {
      query.status = { $regex: new RegExp(`^${statusFilter}$`, "i") };
    }

    const orders = await db
      .collection("orders")
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    const formatted = orders.map((o) => ({
      id: o._id.toString(),
      orderId: o.provider_order_id,
      serviceId: o.service_id,
      serviceName: o.service_name,
      category: o.category,
      link: o.link,
      quantity: o.quantity,
      charge: o.charge,
      status: o.status || "Pending",
      refillAvailable: Boolean(o.refill_available),
      cancelAvailable: Boolean(o.cancel_available),
      createdAt: o.created_at,
    }));

    return res.status(200).json({
      success: true,
      total: formatted.length,
      orders: formatted,
    });
  } catch (err) {
    console.error("List orders error:", err);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
}
