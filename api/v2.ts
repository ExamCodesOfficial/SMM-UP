import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "./lib/db.js";
import {
  fetchAllServices,
  calculateOrderTotal,
  addProviderOrder,
  checkOrderStatus,
} from "./lib/smm.js";

// Standard SMM v2 API Specification for Resellers & Developers
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support both GET and POST with URLSearchParams or JSON body
  const body = req.method === "POST" ? req.body || {} : req.query;
  const key = body.key || req.query.key;
  const action = body.action || req.query.action;

  if (!key) {
    return res.status(400).json({ error: "API key is required" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ api_key: String(key).trim() });

  if (!user) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // ── 1. ACTION: BALANCE ─────────────────────────────────────────
  if (action === "balance") {
    return res.status(200).json({
      balance: (user.balance || 0).toFixed(2),
      currency: "INR",
    });
  }

  // ── 2. ACTION: SERVICES ────────────────────────────────────────
  if (action === "services") {
    try {
      const services = await fetchAllServices();
      const formatted = services.map((s) => ({
        service: s.service,
        name: s.name,
        type: s.type,
        category: s.category,
        platform: s.platform,
        rate: s.rate.toFixed(2),
        min: s.min,
        max: s.max,
        dripfeed: s.dripfeed,
        refill: s.refill,
        cancel: s.cancel,
      }));
      return res.status(200).json(formatted);
    } catch {
      return res.status(500).json({ error: "Failed to fetch services" });
    }
  }

  // ── 3. ACTION: ADD ─────────────────────────────────────────────
  if (action === "add") {
    const { service, link, quantity, comments, runs, interval } = body;
    if (!service || !link) {
      return res.status(400).json({ error: "service and link are required" });
    }

    try {
      const services = await fetchAllServices();
      const matched = services.find((s) => Number(s.service) === Number(service));
      if (!matched) {
        return res.status(404).json({ error: "Service not found" });
      }

      let effQuantity = parseInt(String(quantity || "0"), 10);
      if (matched.type === "Custom Comments" && comments) {
        effQuantity = String(comments).split("\n").filter((l) => l.trim()).length;
      } else if (matched.type === "Package") {
        effQuantity = 1;
      }

      if (effQuantity < matched.min || effQuantity > matched.max) {
        return res.status(400).json({
          error: `Quantity must be between ${matched.min} and ${matched.max}`,
        });
      }

      const { totalCharge } = calculateOrderTotal(matched.wholesale_rate, effQuantity);
      if ((user.balance || 0) < totalCharge) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const providerRes = await addProviderOrder({
        serviceId: matched.service,
        link: String(link).trim(),
        quantity: effQuantity,
        comments: comments ? String(comments) : undefined,
        runs: runs ? parseInt(String(runs), 10) : undefined,
        interval: interval ? parseInt(String(interval), 10) : undefined,
      });

      if (providerRes.error) {
        return res.status(400).json({ error: providerRes.error });
      }

      // Atomic balance deduction
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $inc: {
            balance: -totalCharge,
            total_spent: totalCharge,
            total_orders: 1,
          },
        }
      );

      // Record order
      const newOrder = {
        user_id: user._id,
        user_email: user.email,
        service_id: matched.service,
        service_name: matched.name,
        category: matched.category,
        platform: matched.platform,
        link: link,
        quantity: effQuantity,
        charge: totalCharge,
        provider_order_id: providerRes.orderId,
        status: "Pending",
        created_at: new Date(),
      };

      const orderInsert = await db.collection("orders").insertOne(newOrder);

      return res.status(200).json({
        order: providerRes.orderId || orderInsert.insertedId.toString(),
      });
    } catch {
      return res.status(500).json({ error: "Order execution failed" });
    }
  }

  // ── 4. ACTION: STATUS ──────────────────────────────────────────
  if (action === "status") {
    const orderId = body.order;
    if (!orderId) return res.status(400).json({ error: "order parameter required" });

    try {
      const order = await db.collection("orders").findOne({
        user_id: user._id,
        $or: [
          { provider_order_id: Number(orderId) || String(orderId) },
          { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null },
        ],
      });

      if (!order || !order.provider_order_id) {
        return res.status(404).json({ error: "Order not found" });
      }

      const live = await checkOrderStatus(order.provider_order_id);
      return res.status(200).json({
        charge: order.charge.toFixed(2),
        start_count: live.start_count || "0",
        status: live.status || order.status,
        remains: live.remains || "0",
        currency: "INR",
      });
    } catch {
      return res.status(500).json({ error: "Failed to check status" });
    }
  }

  return res.status(400).json({ error: "Invalid action parameter" });
}
