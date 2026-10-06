import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { getDb } from "../../server/lib/db.js";
import { checkOrderStatusMulti } from "../../server/lib/smm.js";

/**
 * Periodic order status sync (Vercel Cron, every 15 minutes).
 *
 * Finds orders that are not in a terminal state and have a provider_order_id,
 * batches them 100 per upstream call (the provider's v2 multi-status limit),
 * and persists fresh status / start_count / remains values.
 *
 * Security: Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron calls.
 * Refuse everything else so nobody can force-run an expensive sync loop.
 */

const TERMINAL_STATES = new Set(["Completed", "Partial", "Canceled", "Cancelled", "Failed", "Refunded"]);

// Statuses coming back from an upstream provider, normalised to a canonical set
function normaliseStatus(raw: string | undefined): string {
  if (!raw) return "Pending";
  const s = raw.trim().toLowerCase();
  if (s === "completed" || s === "complete") return "Completed";
  if (s === "partial") return "Partial";
  if (s === "processing") return "Processing";
  if (s === "in progress" || s === "inprogress") return "In progress";
  if (s === "canceled" || s === "cancelled") return "Canceled";
  return "Pending";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const providerIds = pending
      .map((o: any) => o.provider_order_id)
      .filter(Boolean);

    let synced = 0;
    let changed = 0;

    // Upstream accepts max 100 IDs per multi-status request
    for (let i = 0; i < providerIds.length; i += 100) {
      const chunk = providerIds.slice(i, i + 100).join(",");
      const live = await checkOrderStatusMulti(chunk);
      if (!live || live.error) continue;

      const bulkOps: any[] = [];
      pending.slice(i, i + 100).forEach((o: any) => {
        const pid = String(o.provider_order_id);
        const entry = live[pid] || live[Number(pid)];
        if (!entry) return;

        const nextStatus = normaliseStatus(entry.status);
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
