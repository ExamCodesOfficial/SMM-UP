import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../../server/lib/db.js";
import { getUserFromRequest } from "../../server/lib/auth.js";
import {
  fetchAllServices,
  calculateOrderTotal,
  addProviderOrder,
  checkOrderStatus,
  requestOrderRefill,
  cancelProviderOrder,
  sanitizeBrandText,
  sanitizeProviderError,
} from "../../server/lib/smm.js";
import { sendFailedOrderAlert } from "../../server/lib/telegram.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }

  const db = await getDb();
  const userObjectId = new ObjectId(authUser.userId);

  // ── 1. CREATE ORDER ──────────────────────────────────────────
  if (action === "create") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const {
      serviceId,
      link,
      quantity,
      comments,
      usernames,
      hashtags,
      username,
      answer_number,
      runs,
      interval,
    } = req.body || {};

    if (!serviceId || !link) {
      return res.status(400).json({ error: "Service and target link are required" });
    }

    const sId = parseInt(serviceId, 10);
    const cleanLink = String(link).trim();

    try {
      const services = await fetchAllServices();
      const service = services.find((s) => Number(s.service) === sId);
      if (!service) {
        return res.status(404).json({ error: "Service not found or currently offline" });
      }

      let effQuantity = 0;
      if (service.type === "Custom Comments" && comments) {
        const lines = String(comments).split("\n").filter((l) => l.trim().length > 0);
        effQuantity = lines.length;
      } else if (service.type === "Package") {
        effQuantity = 1;
      } else {
        effQuantity = parseInt(quantity, 10);
        if (isNaN(effQuantity) || effQuantity < service.min || effQuantity > service.max) {
          return res.status(400).json({
            error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
          });
        }
      }

      const { totalCharge, wholesaleCost, profit } = calculateOrderTotal(
        service.wholesale_rate,
        effQuantity
      );

      const users = db.collection("users");
      const debitResult: any = await users.findOneAndUpdate(
        { _id: userObjectId, balance: { $gte: totalCharge } },
        {
          $inc: {
            balance: -totalCharge,
            total_spent: totalCharge,
            total_orders: 1,
          },
        },
        { returnDocument: "after" }
      );

      if (!debitResult) {
        return res.status(400).json({
          error: "Insufficient funds. Please add money to your wallet.",
          required: totalCharge,
        });
      }

      const providerRes = await addProviderOrder({
        serviceId: sId,
        link: cleanLink,
        quantity: effQuantity,
        comments,
        usernames,
        hashtags,
        username,
        answer_number,
        runs,
        interval,
      });

      if (providerRes.error || !providerRes.orderId) {
        // STRICT DIRECTIVE: Zero automatic refunds!
        // Funds remain debited. Order is recorded with status: "Failed", refund_status: "requires_admin_review".
        const failedOrder = {
          user_id: userObjectId,
          user_email: authUser.email,
          service_id: sId,
          service_name: service.name,
          category: service.category,
          link: cleanLink,
          quantity: effQuantity,
          charge: totalCharge,
          wholesale_cost: wholesaleCost,
          profit: profit,
          provider_order_id: null,
          provider_error: providerRes.error || "Unknown provider error",
          status: "Failed",
          refund_status: "requires_admin_review",
          refill_available: false,
          cancel_available: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const failedInsert = await db.collection("orders").insertOne(failedOrder);

        // Dispatch alert to Admin Group / Telegram Owner for manual review
        sendFailedOrderAlert({
          orderId: failedInsert.insertedId.toString(),
          userEmail: authUser.email,
          serviceName: service.name,
          charge: totalCharge,
          error: providerRes.error || "Unknown provider error",
        }).catch((e) => console.error("Failed order alert error:", e));

        return res.status(400).json({
          error:
            "Order submission encountered an issue and has been flagged for manual administrative review. Your funds are held securely. Please contact support with your Order ID.",
          orderId: failedInsert.insertedId.toString(),
        });
      }

      const newOrder = {
        user_id: userObjectId,
        user_email: authUser.email,
        service_id: sId,
        service_name: service.name,
        category: service.category,
        link: cleanLink,
        quantity: effQuantity,
        charge: totalCharge,
        wholesale_cost: wholesaleCost,
        profit: profit,
        provider_order_id: providerRes.orderId,
        status: "In progress",
        refill_available: service.refill,
        refill_days: service.refill_days,
        refill_label: service.refill_label,
        cancel_available: service.cancel,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const orderInsert = await db.collection("orders").insertOne(newOrder);

      return res.status(201).json({
        success: true,
        orderId: orderInsert.insertedId.toString(),
        providerOrderId: providerRes.orderId,
        charge: totalCharge,
        balance: debitResult.balance,
        serviceName: service.name,
      });
    } catch (err) {
      return res.status(500).json({ error: "Order execution failed" });
    }
  }

  // ── 2. LIST ORDERS ───────────────────────────────────────────
  if (action === "list") {
    const limit = parseInt(String(req.query.limit || "50"), 10);
    const statusFilter = String(req.query.status || "").trim();

    try {
      const query: any = { user_id: userObjectId };
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
        serviceName: sanitizeBrandText(o.service_name),
        category: sanitizeBrandText(o.category),
        link: o.link,
        quantity: o.quantity,
        charge: o.charge,
        status: o.status || "Pending",
        refillAvailable: Boolean(o.refill_available),
        refillDays: o.refill_days,
        refillLabel: o.refill_label,
        refundStatus: o.refund_status || null,
        cancelAvailable: Boolean(o.cancel_available),
        createdAt: o.created_at,
      }));

      return res.status(200).json({
        success: true,
        total: formatted.length,
        orders: formatted,
      });
    } catch {
      return res.status(500).json({ error: "Failed to fetch orders" });
    }
  }

  // ── 3. STATUS RECHECK ────────────────────────────────────────
  if (action === "status") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Order ID required" });

    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(String(id)),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) {
        return res.status(404).json({ error: "Order not found" });
      }

      const liveStatus = await checkOrderStatus(order.provider_order_id);
      if (liveStatus && liveStatus.status) {
        await db.collection("orders").updateOne(
          { _id: order._id },
          {
            $set: {
              status: liveStatus.status,
              start_count: liveStatus.start_count,
              remains: liveStatus.remains,
              updated_at: new Date(),
            },
          }
        );
        return res.status(200).json({ success: true, status: liveStatus.status });
      }

      return res.status(200).json({ success: true, status: order.status });
    } catch {
      return res.status(500).json({ error: "Status check failed" });
    }
  }

  // ── 4. REFILL ────────────────────────────────────────────────
  if (action === "refill") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Order ID required" });

    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(String(id)),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) {
        return res.status(404).json({ error: "Order not found" });
      }

      const refillRes = await requestOrderRefill(order.provider_order_id);
      if (refillRes.error) return res.status(400).json({ error: sanitizeProviderError(refillRes.error) });

      await db.collection("orders").updateOne(
        { _id: order._id },
        {
          $set: {
            refill_id: refillRes.refill,
            last_refill_at: new Date(),
          },
        }
      );

      return res.status(200).json({ success: true, refillId: refillRes.refill });
    } catch {
      return res.status(500).json({ error: "Refill request failed" });
    }
  }

  // ── 5. CANCEL ────────────────────────────────────────────────
  if (action === "cancel") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "Order ID required" });
    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(String(id)),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) return res.status(404).json({ error: "Order not found" });
      if (!order.cancel_available) return res.status(400).json({ error: "Cancel not available for this service" });
      const result = await cancelProviderOrder(order.provider_order_id);
      if (result.error) return res.status(400).json({ error: sanitizeProviderError(result.error) });
      await db.collection("orders").updateOne({ _id: order._id }, { $set: { status: "Cancelled", updated_at: new Date() } });
      return res.status(200).json({ success: true, message: "Cancel requested", result });
    } catch {
      return res.status(500).json({ error: "Cancel request failed" });
    }
  }

  return res.status(404).json({ error: "Orders action not found" });
}
