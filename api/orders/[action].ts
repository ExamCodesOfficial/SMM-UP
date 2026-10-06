import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  fetchAllServices,
  calculateOrderTotal,
  addProviderOrder,
  checkOrderStatus,
  requestOrderRefill,
  cancelProviderOrder,
  normalizeProviderOrderStatus,
  sanitizeBrandText,
  sanitizeProviderError,
} from "../../server/lib/smm.js";
import { sendFailedOrderAlert } from "../../server/lib/telegram.js";
import { OrderReservationError, reserveWebsiteOrder } from "../../server/lib/orderReservations.js";

async function handleOrdersRequest(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }
  if (denySupportMutation(authUser, res, action === "list" && req.method === "GET")) return;
  const userObjectId = new ObjectId(authUser.userId);

  // ── 1. CREATE ORDER ──────────────────────────────────────────
  if (action === "create") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rate = await checkRateLimit(`web_order_${authUser.userId}`, 30, 60, db);
    if (!rate.allowed) return res.status(429).json({ error: `Too many order attempts. Try again in ${rate.remainingSec}s.` });
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

    const sId = Number(serviceId);
    const cleanLink = String(link).trim();
    if (!Number.isSafeInteger(sId) || sId <= 0) {
      return res.status(400).json({ error: "Enter a valid service ID." });
    }
    if (cleanLink.length < 3 || cleanLink.length > 2048 || /[\u0000-\u001F\u007F]/.test(cleanLink)) {
      return res.status(400).json({ error: "Enter a valid public target link or username." });
    }
    for (const [label, value, maxLength] of [
      ["comments", comments, 100_000],
      ["usernames", usernames, 100_000],
      ["hashtags", hashtags, 100_000],
      ["username", username, 500],
    ] as const) {
      if (value !== undefined && String(value).length > maxLength) {
        return res.status(413).json({ error: `${label} input is too large.` });
      }
    }

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
        effQuantity = Number(quantity);
      }
      if (
        !Number.isSafeInteger(effQuantity)
        || (service.type !== "Package" && (effQuantity < service.min || effQuantity > service.max))
      ) {
        return res.status(400).json({
          error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
        });
      }
      for (const [label, value, maximum] of [
        ["answer_number", answer_number, 10_000],
        ["runs", runs, 10_000],
        ["interval", interval, 1_000_000],
      ] as const) {
        if (value !== undefined && value !== null && value !== "") {
          const parsed = Number(value);
          if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
            return res.status(400).json({ error: `${label} is invalid.` });
          }
        }
      }

      const { totalCharge, wholesaleCost, profit } = calculateOrderTotal(
        service.wholesale_rate,
        effQuantity
      );

      const reservation = await reserveWebsiteOrder(db, {
        userId: userObjectId,
        userEmail: authUser.email,
        amountInr: totalCharge,
        draft: {
          service_id: sId,
          service_name: service.name,
          category: service.category,
          link: cleanLink,
          quantity: effQuantity,
          wholesale_cost: wholesaleCost,
          profit,
          refill_available: Boolean(service.refill),
          refill_days: service.refill_days,
          refill_label: service.refill_label,
          cancel_available: Boolean(service.cancel),
        },
      });

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
        const providerError = String(providerRes.error || "Unknown provider error").slice(0, 1000);
        const markedFailed = await db.collection("orders").updateOne(
          { _id: reservation.orderId, status: "Submitting" },
          {
            $set: {
              provider_error: providerError,
              status: "Failed",
              refund_status: "requires_admin_review",
              refill_available: false,
              cancel_available: false,
              updated_at: new Date(),
            },
          },
        );
        if (markedFailed.modifiedCount !== 1) {
          throw new Error("Reserved order could not be marked for administrative review.");
        }

        sendFailedOrderAlert({
          orderId: reservation.orderId.toString(),
          userEmail: authUser.email,
          serviceName: service.name,
          charge: totalCharge,
          error: providerError,
        }).catch((error) => console.error("Failed order alert error:", error));

        return res.status(400).json({
          error:
            "Order submission encountered an issue and has been flagged for manual administrative review. Your funds are held securely. Please contact support with your Order ID.",
          orderId: reservation.orderId.toString(),
        });
      }

      const finalized = await db.collection("orders").updateOne(
        { _id: reservation.orderId, status: "Submitting" },
        {
          $set: {
            provider_order_id: providerRes.orderId,
            status: "In progress",
            updated_at: new Date(),
          },
        },
      );
      if (finalized.modifiedCount !== 1) {
        const current: any = await db.collection("orders").findOne({ _id: reservation.orderId });
        if (String(current?.provider_order_id || "") !== String(providerRes.orderId)) {
          const reconciliationError = `Supplier accepted provider order ${String(providerRes.orderId).slice(0, 100)}, but local finalization was interrupted.`;
          await db.collection("orders").updateOne(
            { _id: reservation.orderId },
            {
              $set: {
                provider_order_id: providerRes.orderId,
                provider_error: reconciliationError,
                status: "Submission uncertain",
                refund_status: "requires_admin_review",
                updated_at: new Date(),
              },
            },
          );
          sendFailedOrderAlert({
            orderId: reservation.orderId.toString(),
            userEmail: authUser.email,
            serviceName: service.name,
            charge: totalCharge,
            error: reconciliationError,
          }).catch((alertError) => console.error("Order reconciliation alert error:", alertError));
          return res.status(503).json({
            error: "The supplier accepted this order, but local confirmation requires administrative review. Do not place it again.",
            orderId: reservation.orderId.toString(),
          });
        }
      }

      return res.status(201).json({
        success: true,
        orderId: reservation.orderId.toString(),
        providerOrderId: providerRes.orderId,
        charge: totalCharge,
        balance: reservation.newBalance,
        serviceName: service.name,
      });
    } catch (error: any) {
      if (error instanceof OrderReservationError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      console.error("Website order execution failed:", error?.message || error);
      return res.status(500).json({
        error: "Order execution failed. If funds were reserved, the order remains recorded for administrative review.",
      });
    }
  }

  // ── 2. LIST ORDERS ───────────────────────────────────────────
  if (action === "list") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const requestedLimit = Number.parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 50;
    const statusFilter = String(req.query.status || "").trim();

    try {
      const query: any = { user_id: userObjectId };
      if (statusFilter && statusFilter !== "All") {
        const escapedStatus = statusFilter.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.status = { $regex: new RegExp(`^${escapedStatus}$`, "i") };
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
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const id = String(req.query.id || "");
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "A valid order ID is required" });

    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(id),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (["Completed", "Partial", "Canceled", "Cancelled", "Failed", "Refunded"].includes(String(order.status))) {
        return res.status(200).json({ success: true, status: order.status });
      }
      const liveStatus = await checkOrderStatus(order.provider_order_id);
      if (liveStatus?.error) {
        return res.status(502).json({ error: sanitizeProviderError(liveStatus.error) });
      }
      if (liveStatus?.status) {
        const normalizedStatus = normalizeProviderOrderStatus(liveStatus.status);
        await db.collection("orders").updateOne(
          { _id: order._id },
          {
            $set: {
              status: normalizedStatus,
              start_count: Number(liveStatus.start_count) || 0,
              remains: Number(liveStatus.remains) || 0,
              updated_at: new Date(),
            },
          },
        );
        return res.status(200).json({ success: true, status: normalizedStatus });
      }

      return res.status(502).json({ error: "Supplier returned an invalid status response." });
    } catch {
      return res.status(500).json({ error: "Status check failed" });
    }
  }

  // ── 4. REFILL ────────────────────────────────────────────────
  if (action === "refill") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const id = String(req.body?.id || "");
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "A valid order ID is required" });

    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(id),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (!order.refill_available) {
        return res.status(400).json({ error: "Refill is not available for this service" });
      }

      const refillRes = await requestOrderRefill(order.provider_order_id);
      if (refillRes?.error) return res.status(400).json({ error: sanitizeProviderError(refillRes.error) });
      const refillId = refillRes?.refill;
      if (!(typeof refillId === "string" || typeof refillId === "number") || String(refillId).length > 100) {
        return res.status(502).json({ error: "Supplier returned an invalid refill response." });
      }

      await db.collection("orders").updateOne(
        { _id: order._id },
        {
          $set: {
            refill_id: refillId,
            last_refill_at: new Date(),
          },
        },
      );

      return res.status(200).json({ success: true, refillId });
    } catch {
      return res.status(500).json({ error: "Refill request failed" });
    }
  }

  // ── 5. CANCEL ────────────────────────────────────────────────
  if (action === "cancel") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const id = String(req.body?.id || "");
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "A valid order ID is required" });
    try {
      const order = await db.collection("orders").findOne({
        _id: new ObjectId(id),
        user_id: userObjectId,
      });
      if (!order || !order.provider_order_id) return res.status(404).json({ error: "Order not found" });
      if (!order.cancel_available) return res.status(400).json({ error: "Cancel not available for this service" });
      const result = await cancelProviderOrder(order.provider_order_id);
      const record = Array.isArray(result)
        ? result.find((item: any) => String(item?.order) === String(order.provider_order_id)) || result[0]
        : result;
      if (record?.error) return res.status(400).json({ error: sanitizeProviderError(record.error) });
      const accepted = record?.cancel === true || record?.cancel === 1 || record?.cancel === "1" || record?.success === true;
      if (!accepted) return res.status(502).json({ error: "Supplier did not confirm the cancellation request." });
      await db.collection("orders").updateOne(
        { _id: order._id },
        { $set: { status: "Cancel requested", cancel_requested_at: new Date(), updated_at: new Date() } },
      );
      return res.status(200).json({ success: true, message: "Cancel requested" });
    } catch {
      return res.status(500).json({ error: "Cancel request failed" });
    }
  }

  return res.status(404).json({ error: "Orders action not found" });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleOrdersRequest(req, res);
  } catch (error: any) {
    console.error("handleOrdersRequest uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
}
