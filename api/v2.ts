import type { VercelRequest, VercelResponse } from "../server/lib/http.js";
import { ObjectId } from "mongodb";
import { ensureApiKeyIndexes, getDb } from "../server/lib/db.js";
import {
  ApiKeyError,
  authenticateApiKey,
  recordApiKeyActivity,
  requireApiKeyScope,
  reserveApiKeyOrderSpend,
} from "../server/lib/apiKeys.js";
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
import { sanitizeProviderError } from "../server/lib/smm.js";

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

    const db = await getDb();
    await ensureApiKeyIndexes();
    let apiAuth;
    try {
      apiAuth = await authenticateApiKey(db, key);
    } catch (error: any) {
      if (error instanceof ApiKeyError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      throw error;
    }
    const user: any = apiAuth.user;
    const startedAt = new Date();
    const requestId = crypto.randomUUID();
    const forwarded = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const ipHashSecret = process.env.API_ACTIVITY_HASH_SECRET || process.env.JWT_SECRET;
    const ipHash = forwarded && ipHashSecret
      ? crypto.createHmac("sha256", ipHashSecret).update(forwarded).digest("hex")
      : null;

    let requiredScope: string;
    try {
      requiredScope = requireApiKeyScope(apiAuth.key, action);
    } catch (error: any) {
      if (error instanceof ApiKeyError) {
        try {
          await recordApiKeyActivity(db, apiAuth, {
            action: String(action || "unknown"),
            scope: "none",
            httpStatus: error.statusCode,
            result: error.code,
            requestId,
            ipHash,
            startedAt,
          });
        } catch (activityError) {
          console.error("API activity write failed:", activityError);
        }
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const respond = async (
      status: number,
      payload: any,
      meta: {
        orderId?: ObjectId | string | null;
        orderIds?: Array<ObjectId | string>;
        serviceId?: number | string | null;
        serviceName?: string | null;
        target?: string | null;
        quantity?: number | null;
        grossChargeInr?: number | null;
        refundInr?: number | null;
        netChargeInr?: number | null;
      } = {},
    ) => {
      const message = payload && !Array.isArray(payload) && payload.error
        ? String(payload.error).slice(0, 160)
        : status < 400
          ? "success"
          : "request_failed";
      try {
        await recordApiKeyActivity(db, apiAuth, {
          action: String(action),
          scope: requiredScope,
          httpStatus: status,
          result: message,
          requestId,
          orderId: meta.orderId,
          orderIds: meta.orderIds,
          serviceId: meta.serviceId,
          serviceName: meta.serviceName,
          target: meta.target,
          quantity: meta.quantity,
          grossChargeInr: meta.grossChargeInr,
          refundInr: meta.refundInr,
          netChargeInr: meta.netChargeInr,
          ipHash,
          startedAt,
        });
      } catch (activityError) {
        // Order records and wallet ledger still retain critical attribution. Never
        // turn a completed provider operation into a retryable 500 here.
        console.error("API activity write failed:", activityError);
      }
      return res.status(status).json(payload);
    };

    // Rate limit per API-key identity so one leaked key cannot affect sibling keys
    const rl = await checkRateLimit(`v2_${apiAuth.key._id.toString()}`, 120, 60, db);
    if (!rl.allowed) {
      return respond(429, { error: `Rate limit exceeded. Retry in ${rl.remainingSec}s.` });
    }

    // ── 1. ACTION: BALANCE ─────────────────────────────────────────
    if (action === "balance") {
      return respond(200, {
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
        return respond(200, formatted);
      } catch (err: any) {
        return respond(500, { error: sanitizeProviderError(err.message) || "Failed to fetch services" });
      }
    }

    // ── 3. ACTION: ADD ─────────────────────────────────────────────
    if (action === "add") {
      const { service, link, quantity, comments, runs, interval } = body;
      if (!service || !link) {
        return respond(400, { error: "service and link are required" });
      }

      try {
        const services = await fetchAllServices();
        const matched = services.find((s) => Number(s.service) === Number(service));
        if (!matched) {
          return respond(404, { error: "Service not found" });
        }

        let effQuantity = parseInt(String(quantity || "0"), 10);
        if (matched.type === "Custom Comments" && comments) {
          effQuantity = String(comments).split("\n").filter((l) => l.trim()).length;
        } else if (matched.type === "Package") {
          effQuantity = 1;
        }

        if (effQuantity < matched.min || effQuantity > matched.max) {
          return respond(400, {
            error: `Quantity must be between ${matched.min} and ${matched.max}`,
          });
        }

        const { totalCharge } = calculateOrderTotal(matched.wholesale_rate, effQuantity);

        // Limits, wallet debit and ledger attribution commit atomically before provider execution.
        const operationId = crypto.randomUUID();
        let spendReservation;
        try {
          spendReservation = await reserveApiKeyOrderSpend(db, apiAuth, totalCharge, operationId);
        } catch (error: any) {
          if (error instanceof ApiKeyError) {
            return respond(error.statusCode, { error: error.message, code: error.code }, {
              serviceId: matched.service,
              serviceName: matched.name,
              target: String(link).trim(),
              quantity: effQuantity,
              grossChargeInr: totalCharge,
              netChargeInr: 0,
            });
          }
          throw error;
        }

        let providerRes: any;
        try {
          providerRes = await addProviderOrder({
            serviceId: matched.service,
            link: String(link).trim(),
            quantity: effQuantity,
            comments: comments ? String(comments) : undefined,
            runs: runs ? parseInt(String(runs), 10) : undefined,
            interval: interval ? parseInt(String(interval), 10) : undefined,
          });
        } catch (providerError: any) {
          // The wallet charge has committed, so a provider transport failure must
          // still produce a durable, key-attributed order for owner review.
          providerRes = {
            error: sanitizeProviderError(providerError?.message) || "Provider request failed",
          };
        }

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
            api_key_id: apiAuth.key._id,
            api_key_version: apiAuth.version.version,
            api_request_id: requestId,
            api_operation_id: operationId,
            wallet_ledger_id: spendReservation.ledgerId,
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

          return respond(400, {
            error: sanitizeProviderError(providerRes.error || "Provider rejected order. Order flagged for administrative review."),
            order: failedInsert.insertedId.toString(),
          }, {
            orderId: failedInsert.insertedId,
            serviceId: matched.service,
            serviceName: matched.name,
            target: String(link).trim(),
            quantity: effQuantity,
            grossChargeInr: totalCharge,
            netChargeInr: totalCharge,
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
          source: "v2_api",
          api_key_id: apiAuth.key._id,
          api_key_version: apiAuth.version.version,
          api_request_id: requestId,
          api_operation_id: operationId,
          wallet_ledger_id: spendReservation.ledgerId,
          created_at: new Date(),
        };

        const orderInsert = await db.collection("orders").insertOne(newOrder);

        return respond(200, {
          order: providerRes.orderId || orderInsert.insertedId.toString(),
        }, {
          orderId: orderInsert.insertedId,
          serviceId: matched.service,
          serviceName: matched.name,
          target: String(link).trim(),
          quantity: effQuantity,
          grossChargeInr: totalCharge,
          netChargeInr: totalCharge,
        });
      } catch (err: any) {
        return respond(500, { error: sanitizeProviderError(err.message) || "Order execution failed" });
      }
    }

    // ── 4. ACTION: CANCEL ──────────────────────────────────────────
    if (action === "cancel") {
      const orderId = body.order;
      if (!orderId) return respond(400, { error: "order parameter is required" });
      try {
        const order = await db.collection("orders").findOne({
          user_id: user._id,
          $or: [
            { provider_order_id: Number(orderId) || String(orderId) },
            { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null },
          ],
        });
        if (!order || !order.provider_order_id) return respond(404, { error: "Order not found" });
        if (!order.cancel_available) return respond(400, { error: "Cancel not available for this order" }, { orderId: order._id });
        const result = await cancelProviderOrder(order.provider_order_id);
        if (result.error) return respond(400, { error: sanitizeProviderError(result.error) }, { orderId: order._id });
        await db.collection("orders").updateOne(
          { _id: order._id },
          {
            $set: {
              status: "Cancelled",
              last_api_action_key_id: apiAuth.key._id,
              last_api_action_key_version: apiAuth.version.version,
              updated_at: new Date(),
            },
          },
        );
        return respond(200, { success: true, message: "Cancel requested", result }, { orderId: order._id });
      } catch (e: any) {
        return respond(500, { error: sanitizeProviderError(e.message) || "Cancel failed" });
      }
    }

    // ── 5. ACTION: REFILL ──────────────────────────────────────────
    if (action === "refill") {
      const orderId = body.order;
      if (!orderId) return respond(400, { error: "order parameter is required" });
      try {
        const order = await db.collection("orders").findOne({
          user_id: user._id,
          $or: [
            { provider_order_id: Number(orderId) || String(orderId) },
            { _id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null },
          ],
        });
        if (!order || !order.provider_order_id) return respond(404, { error: "Order not found" });
        if (!order.refill_available) return respond(400, { error: "Refill not available for this order" }, { orderId: order._id });
        const result = await requestOrderRefill(order.provider_order_id);
        if (result.error) return respond(400, { error: sanitizeProviderError(result.error) }, { orderId: order._id });
        await db.collection("orders").updateOne(
          { _id: order._id },
          {
            $set: {
              refill_id: result.refill,
              last_refill_at: new Date(),
              last_api_action_key_id: apiAuth.key._id,
              last_api_action_key_version: apiAuth.version.version,
            },
          },
        );
        return respond(200, { success: true, refill: result.refill }, { orderId: order._id });
      } catch (e: any) {
        return respond(500, { error: sanitizeProviderError(e.message) || "Refill failed" });
      }
    }

    // ── 7. ACTION: REFILL STATUS ───────────────────────────────────
    if (action === "refill_status") {
      const refillId = body.refill;
      if (!refillId) return respond(400, { error: "refill parameter required" });
      try {
        const order = await db.collection("orders").findOne({
          user_id: user._id,
          $or: [
            { refill_id: String(refillId) },
            { refill_id: Number(refillId) || String(refillId) },
          ],
        });
        if (!order?.refill_id) return respond(404, { error: "Refill not found" });
        const live = await checkRefillStatus(order.refill_id);
        if (live?.error) return respond(400, { error: sanitizeProviderError(live.error) }, { orderId: order._id });
        return respond(200, { status: live?.status || "Pending" }, { orderId: order._id });
      } catch (e: any) {
        return respond(500, { error: sanitizeProviderError(e.message) || "Refill status check failed" });
      }
    }

    // ── 6. ACTION: STATUS (single + multi-order) ───────────────────
    if (action === "status") {
      const orderParam = body.order;
      if (!orderParam) return respond(400, { error: "order parameter required" });
      const orderId = orderParam;

      // ── 6b. MULTI-ORDER STATUS: comma-separated list, max 100 ────
      if (typeof orderId === "string" && orderId.includes(",")) {
        const ids = orderId.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) return respond(400, { error: "order parameter required" });
        if (ids.length > 100) return respond(400, { error: "Maximum 100 orders per request" });
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
            return respond(404, { error: "No matching orders found" });
          }
          const providerIds = orders
            .map((o: any) => o.provider_order_id)
            .filter(Boolean)
            .join(",");
          if (!providerIds) return respond(404, { error: "No orders with live tracking found" });

          const live = await checkOrderStatusMulti(providerIds);
          if (live?.error) return respond(400, { error: sanitizeProviderError(live.error) });

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
          return respond(200, out, { orderIds: orders.map((order: any) => order._id) });
        } catch (e: any) {
          return respond(500, { error: sanitizeProviderError(e.message) || "Multi-order status check failed" });
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
          return respond(404, { error: "Order not found" });
        }

        const live = await checkOrderStatus(order.provider_order_id);
        return respond(200, {
          charge: order.charge.toFixed(2),
          start_count: live.start_count || "0",
          status: live.status || order.status,
          remains: live.remains || "0",
          currency: "INR",
        }, { orderId: order._id });
      } catch {
        return respond(500, { error: "Failed to check status" });
      }
    }

    return respond(400, { error: "Invalid action parameter" });
  } catch (globalErr: any) {
    console.error("api/v2 uncaught error:", globalErr);
    return res.status(500).json({ error: "Internal server error. Please try again or contact support." });
  }
}
