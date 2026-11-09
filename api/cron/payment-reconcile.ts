import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { getDb } from "../../server/lib/db.js";
import { reconcilePendingDeposits } from "../../server/lib/paymentReconciliation.js";

/**
 * Payment reconciliation sweep (Vercel Cron, configured in vercel.json).
 *
 * Backstop for provider webhooks that never arrived: a deploy during the
 * callback, a network failure, a provider outage. The Telegram bot runs the
 * same sweep far more frequently; this daily run guarantees that nothing is
 * stranded even if the bot is down.
 *
 * Security: Vercel sends `Authorization: Bearer <CRON_SECRET>`. Everything else
 * is refused so nobody can force-run an expensive provider sweep.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    return res.status(200).json({
      famgateway,
      oxapay,
      reconciled: famgateway.scanned + oxapay.scanned,
      settled: famgateway.settled + oxapay.settled,
    });
  } catch (error: any) {
    console.error("payment-reconcile cron error:", error?.message || error);
    return res.status(500).json({ error: "Payment reconciliation failed" });
  }
}
