import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { getDb } from "../../server/lib/db.js";
import { reconcilePendingDeposits } from "../../server/lib/paymentReconciliation.js";
import { drainPendingOwnerNotifications } from "../../server/lib/ownerNotifications.js";
import { checkOrderStatusMulti, normalizeProviderOrderStatus } from "../../server/lib/smm.js";

/**
 * Periodic order status sync (Vercel Cron, configured in vercel.json; currently 04:00 UTC daily).
 *
 * Finds orders that are not in a terminal state and have a provider_order_id,
 * batches them 100 per upstream call (the provider's v2 multi-status limit),
 * and persists fresh status / start_count / remains values.
 *
 * Security: Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron calls.
 * Refuse everything else so nobody can force-run an expensive sync loop.
 */

const TERMINAL_STATES = new Set(["Completed", "Partial", "Canceled", "Cancelled", "Failed", "Refunded"]);

async function handleStatusSyncCron(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) {
    console.error("status-sync cron refused: CRON_SECRET is missing or too short");
    return res.status(503).json({ error: "Internal authentication is not configured" });
  }
  const got = String(req.headers.authorization || "");
  const wanted = `Bearer ${expected}`;
  const valid = got.length === wanted.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(wanted));
  if (!valid) return res.status(401).json({ error: "Unauthorised" });

  try {
    const db = await getDb();
    const orders = db.collection("orders");

    // Only sync non-terminal orders that the upstream actually accepted.
    // Window: last 30 days — anything older is archived out of the live loop.
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pending = await orders
      .find({
        provider_order_id: { $ne: null },
        status: { $nin: Array.from(TERMINAL_STATES) },
        created_at: { $gte: windowStart },
      })
      .project({ provider_order_id: 1, status: 1 })
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();

    if (!pending.length) {
      return res.status(200).json({ synced: 0, message: "No live orders to sync" });
    }

    const tracked = pending.filter((order: any) => {
      const providerId = String(order.provider_order_id || "").trim();
      return providerId.length > 0 && providerId.length <= 100;
    });
    const providerIds = tracked.map((order: any) => order.provider_order_id);

    let synced = 0;
    let changed = 0;

    // Upstream accepts max 100 IDs per multi-status request
    for (let i = 0; i < providerIds.length; i += 100) {
      const chunk = providerIds.slice(i, i + 100).join(",");
      const live = await checkOrderStatusMulti(chunk);
      if (!live || typeof live !== "object" || Array.isArray(live) || live.error) continue;

      const bulkOps: any[] = [];
      tracked.slice(i, i + 100).forEach((o: any) => {
        const pid = String(o.provider_order_id);
        const entry = live[pid] || live[Number(pid)];
        if (!entry) return;

        const nextStatus = normalizeProviderOrderStatus(entry.status);
        const update: any = {
          status: nextStatus,
          start_count: Number(entry.start_count) || 0,
          remains: Number(entry.remains) || 0,
          last_synced_at: new Date(),
        };

        bulkOps.push({
          updateOne: {
            filter: { _id: o._id },
            update: { $set: update },
          },
        });
        synced++;
        if (nextStatus !== o.status) changed++;
      });

      if (bulkOps.length) await orders.bulkWrite(bulkOps, { ordered: false });
    }

    return res.status(200).json({ synced, changed, scanned: pending.length });
  } catch (err: any) {
    console.error("status-sync cron error:", err);
    return res.status(500).json({ error: "Status sync failed" });
  }
}

async function handlePaymentReconcileCron(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) {
    console.error("payment-reconcile cron refused: CRON_SECRET is missing or too short");
    return res.status(503).json({ error: "Internal authentication is not configured" });
  }

  const got = String(req.headers.authorization || "");
  const wanted = `Bearer ${expected}`;
  const valid = got.length === wanted.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(wanted));
  if (!valid) return res.status(401).json({ error: "Unauthorised" });

  try {
    const db = await getDb();

    const famgateway = await reconcilePendingDeposits({
      provider: "famgateway",
      limit: 50,
      minAgeSeconds: 60,
    });
    const oxapay = await reconcilePendingDeposits({
      provider: "oxapay",
      limit: 50,
      minAgeSeconds: 60,
    });

    // Deliver anything the owner was told about but has not received yet.
    // The fast path is the request that caused the event; this is the
    // backstop for a request that died mid-send or a Telegram outage.
    const notifications = await drainPendingOwnerNotifications(25);

    return res.status(200).json({
      famgateway,
      oxapay,
      notifications,
      reconciled: famgateway.scanned + oxapay.scanned,
      settled: famgateway.settled + oxapay.settled,
    });
  } catch (error: any) {
    console.error("payment-reconcile cron error:", error?.message || error);
    return res.status(500).json({ error: "Payment reconciliation failed" });
  }
}


/**
 * Cron dispatcher.
 *
 * Both scheduled jobs live in this one file because the Vercel Hobby plan
 * allows at most 12 serverless functions per deployment, and the payment
 * rails added enough routes to reach that ceiling.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "");
  try {
    if (action === "payment-reconcile") {
      return await handlePaymentReconcileCron(req, res);
    }
    if (action === "status-sync" || action === "") {
      return await handleStatusSyncCron(req, res);
    }
    return res.status(404).json({ error: "Cron action not found." });
  } catch (error: any) {
    console.error("Cron handler uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(500).json({ error: "Cron job failed." });
  }
}
