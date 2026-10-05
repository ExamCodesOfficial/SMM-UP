import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../server/lib/db.js";
import {
  fetchAllServices,
  calculateOrderTotal,
  addProviderOrder,
  checkOrderStatus,
  checkOrderStatusMulti,
  checkRefillStatus,
  requestOrderRefill,
  cancelProviderOrder,
} from "../server/lib/smm.js";
import { sendFailedOrderAlert } from "../server/lib/telegram.js";
import { checkRateLimit } from "../server/lib/rateLimit.js";
import crypto from "crypto";
import { sanitizeBrandText, sanitizeProviderError } from "../server/lib/smm.js";

function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Standard SMM v2 API Specification for Resellers & Developers — smmup.co.in
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.method === "POST" ? req.body || {} : req.query;
    const rawKey = (body.key || req.query.key || req.headers["x-api-key"] || "").toString().trim();
    const authHeader = String(req.headers.authorization || "");
    const bearerKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const key = rawKey || bearerKey;
    const action = body.action || req.query.action;

    if (!key) {
      return res.status(400).json({ error: "API key is required. Generate one at https://smmup.co.in/api" });
    }

    const keyHash = hashApiKey(key);
    const db = await getDb();
    const user: any = await db.collection("users").findOne({
      $or: [{ api_key_hash: keyHash }, { api_key: key }],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    // Touch last-used timestamp (best-effort, non-blocking)
    db.collection("users").updateOne({ _id: user._id }, { $set: { api_key_last_used_at: new Date() } }).catch(() => {});

    // Rate limit per API key so one leaked key cannot be brute-forced or abused
    const rl = checkRateLimit(`v2_${user._id}`, 120, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Rate limit exceeded. Retry in ${rl.remainingSec}s.` });
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
          refill_days: s.refill_days,
          refill_type: s.refill_label,
          cancel: s.cancel,
        }));
        return res.status(200).json(formatted);
      } catch (err: any) {
        return res.status(500).json({ error: sanitizeProviderError(err.message) || "Failed to fetch services" });
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

        // Atomic balance deduction BEFORE calling upstream provider
        const debitResult: any = await db.collection("users").findOneAndUpdate(
          { _id: user._id, balance: { $gte: totalCharge }, payment_hold: { $ne: true } },
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
          if (user.payment_hold) {
            return res.status(403).json({
              error: "Ordering is paused while a payment refund or dispute is reviewed",
            });
          }
          // Re-read because a webhook can place the account on hold after API authentication.
          const currentUser = await db.collection("users").findOne(
            { _id: user._id },
            { projection: { payment_hold: 1 } },
          );
          if (currentUser?.payment_hold) {
            return res.status(403).json({
              error: "Ordering is paused while a payment refund or dispute is reviewed",
            });
          }
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

        if (providerRes.error || !providerRes.orderId) {
          // STRICT DIRECTIVE: Zero automatic refunds!
          // Funds remain debited. Order is recorded with status: "Failed", refund_status: "requires_admin_review".
          const failedOrder = {
            user_id: user._id,
            user_email: user.email,
            service_id: matched.service,
            service_name: matched.name,
            category: matched.category,
            platform: matched.platform,
            link: link,
            quantity: effQuantity,
            charge: totalCharge,
            provider_order_id: null,
            provider_error: providerRes.error || "Provider rejected order",
            status: "Failed",
            refund_status: "requires_admin_review",
            source: "v2_api",
            created_at: new Date(),
          };

          const failedInsert = await db.collection("orders").insertOne(failedOrder);

          // Dispatch alert to Telegram Admin
          sendFailedOrderAlert({
            orderId: failedInsert.insertedId.toString(),
            userEmail: user.email,
            serviceName: matched.name,
            charge: totalCharge,
            error: providerRes.error || "Provider rejected order",
          }).catch((e) => console.error("v2 failed order alert error:", e));

          return res.status(400).json({
            error: sanitizeProviderError(providerRes.error || "Provider rejected order. Order flagged for administrative review."),
            order: failedInsert.insertedId.toString(),
          });
        }

        // Record order (same flags the site order path sets, so refill/cancel work via API too)
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
          refill_available: Boolean(matched.refill),
          cancel_available: Boolean(matched.cancel),
          status: "Pending",
          created_at: new Date(),
        };

        const orderInsert = await db.collection("orders").insertOne(newOrder);

        return res.status(200).json({
          order: providerRes.orderId || orderInsert.insertedId.toString(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: sanitizeProviderError(err.message) || "Order execution failed" });
      }
    }

    // ── 4. ACTION: CANCEL ──────────────────────────────────────────
    if (action === "cancel") {
      const orderId = body.order;
      if (!orderId) return res.status(400).json({ error: "order parameter is required" });
      try {
        const order = await db.collection("orders").findOne({
          user_id: user._id,
          $or: [
            { provider_order_id: Number(orderId) || String(orderId) },
            { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null },
          ],
        });
        if (!order || !order.provider_order_id) return res.status(404).json({ error: "Order not found" });
        if (!order.cancel_available) return res.status(400).json({ error: "Cancel not available for this order" });
        const result = await cancelProviderOrder(order.provider_order_id);
        if (result.error) return res.status(400).json({ error: sanitizeProviderError(result.error) });
        await db.collection("orders").updateOne({ _id: order._id }, { $set: { status: "Cancelled", updated_at: new Date() } });
        return res.status(200).json({ success: true, message: "Cancel requested", result });
      } catch (e: any) {
        return res.status(500).json({ error: sanitizeProviderError(e.message) || "Cancel failed" });
      }
    }

    // ── 5. ACTION: REFILL ──────────────────────────────────────────
    if (action === "refill") {
      const orderId = body.order;
      if (!orderId) return res.status(400).json({ error: "order parameter is required" });
      try {
        const order = await db.collection("orders").findOne({
          user_id: user._id,
          $or: [
            { provider_order_id: Number(orderId) || String(orderId) },
            { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null },
          ],
        });
        if (!order || !order.provider_order_id) return res.status(404).json({ error: "Order not found" });
        if (!order.refill_available) return res.status(400).json({ error: "Refill not available for this order" });
        const result = await requestOrderRefill(order.provider_order_id);
        if (result.error) return res.status(400).json({ error: sanitizeProviderError(result.error) });
        await db.collection("orders").updateOne({ _id: order._id }, { $set: { refill_id: result.refill, last_refill_at: new Date() } });
        return res.status(200).json({ success: true, refill: result.refill });
      } catch (e: any) {
        return res.status(500).json({ error: sanitizeProviderError(e.message) || "Refill failed" });
      }
    }

    // ── 7. ACTION: REFILL STATUS ───────────────────────────────────
    if (action === "refill_status") {
      const refillId = body.refill;
      if (!refillId) return res.status(400).json({ error: "refill parameter required" });
      try {
        const live = await checkRefillStatus(refillId);
        if (live?.error) return res.status(400).json({ error: sanitizeProviderError(live.error) });
        return res.status(200).json({ status: live?.status || "Pending" });
      } catch (e: any) {
        return res.status(500).json({ error: sanitizeProviderError(e.message) || "Refill status check failed" });
      }
    }

    // ── 6. ACTION: STATUS (single + multi-order) ───────────────────
    if (action === "status") {
      const orderParam = body.order;
      if (!orderParam) return res.status(400).json({ error: "order parameter required" });
      const orderId = orderParam;

      // ── 6b. MULTI-ORDER STATUS: comma-separated list, max 100 ────
      if (typeof orderId === "string" && orderId.includes(",")) {
        const ids = orderId.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) return res.status(400).json({ error: "order parameter required" });
        if (ids.length > 100) return res.status(400).json({ error: "Maximum 100 orders per request" });
        try {
          // Only this user's orders are resolvable — never leak someone else's
          const objectIds = ids.filter((i) => ObjectId.isValid(i)).map((i) => new ObjectId(i));
          const orders = await db.collection("orders")
            .find({
              user_id: user._id,
              $or: [
                { provider_order_id: { $in: ids.map((i) => Number(i) || i) } },
                { _id: { $in: objectIds } },
              ],
            })
            .toArray();
          if (!orders || orders.length === 0) {
            return res.status(404).json({ error: "No matching orders found" });
          }
          const providerIds = orders
            .map((o: any) => o.provider_order_id)
            .filter(Boolean)
            .join(",");
          if (!providerIds) return res.status(404).json({ error: "No orders with live tracking found" });

          const live = await checkOrderStatusMulti(providerIds);
          if (live?.error) return res.status(400).json({ error: sanitizeProviderError(live.error) });

          // Normalise to the v2 multi-status format keyed by order id
          const out: Record<string, any> = {};
          orders.forEach((o: any) => {
            const pid = String(o.provider_order_id);
            const entry = live?.[pid] || live?.[Number(pid)];
            out[pid] = {
              charge: Number(o.charge || 0).toFixed(2),
              start_count: entry?.start_count ?? "0",
              status: entry?.status ?? o.status ?? "Pending",
              remains: entry?.remains ?? "0",
              currency: "INR",
            };
          });
          return res.status(200).json(out);
        } catch (e: any) {
          return res.status(500).json({ error: sanitizeProviderError(e.message) || "Multi-order status check failed" });
        }
      }

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
  } catch (globalErr: any) {
    console.error("api/v2 uncaught error:", globalErr);
    return res.status(500).json({ error: "Internal server error. Please try again or contact support." });
  }
}
