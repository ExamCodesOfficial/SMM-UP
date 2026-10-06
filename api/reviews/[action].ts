import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { sendReviewSubmittedAlert } from "../../server/lib/telegram.js";

// ── Data model ─────────────────────────────────────────────────
// reviews: { user_id?: ObjectId, seed: boolean, username, city?,
//            rating 1-5, text, status: "approved"|"hidden",
//            orders_count, created_at, updated_at }

// Qualifying order = real purchase (charged, not voided/failed/refunded)
const QUALIFYING_STATUSES = [
  "Pending", "Processing", "In progress", "Completed", "Partial",
];

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || "global")
    .split(",")[0]
    .trim();
}

async function userStats(db: any, userId: ObjectId) {
  const result = await db.collection("orders").aggregate([
    {
      $match: {
        user_id: userId,
        status: { $in: QUALIFYING_STATUSES },
        charge: { $gt: 0 },
      },
    },
    { $group: { _id: null, n: { $sum: 1 } } },
  ]).toArray();
  return result.length ? result[0].n : 0;
}

function publicReview(r: any) {
  return {
    id: r._id.toString(),
    username: r.username,
    role: r.role || (r.seed ? null : "Verified buyer"),
    city: r.city || null,
    rating: r.rating,
    text: r.text,
    headline: r.headline || null,
    metric: r.seed
      ? r.metric
      : r.orders_count != null
      ? String(r.orders_count)
      : null,
    metric_label: r.seed ? r.metric_label : r.orders_count != null ? "orders placed" : null,
    date: r.created_at,
    verified: true,
  };
}

async function handleReviewsRequest(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction || "";
  if (!["GET", "HEAD", "OPTIONS"].includes(String(req.method || "GET").toUpperCase()) && !sameOriginIfPresent(req)) {
    return res.status(403).json({ error: "Invalid request origin." });
  }
  const db = await getDb();
  const col = db.collection("reviews");

  // ── Public: latest approved community submissions ────────────
  // The six established reviews remain permanently on the homepage; this
  // deliberately isn't an aggregate or paginated review directory.
  if (action === "list" && req.method === "GET") {
    try {
      const feedRate = await checkRateLimit(`review_feed_${clientIp(req)}`, 90, 60, db);
      if (!feedRate.allowed) {
        res.setHeader("Retry-After", String(feedRate.remainingSec));
        return res.status(429).json({ error: "Too many review-feed requests. Please try again shortly." });
      }
      const reviews = await col
        .find({ status: "approved", seed: { $ne: true } })
        .sort({ created_at: -1 })
        .limit(12)
        .toArray();
      // A short edge cache absorbs anonymous bursts; Telegram moderation becomes visible within 30 seconds.
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
      return res.status(200).json({ reviews: reviews.map(publicReview) });
    } catch {
      return res.status(500).json({ error: "Failed to load reviews" });
    }
  }

  // ── Public: can the signed-in visitor write one? ─────────────
  if (action === "eligibility" && req.method === "GET") {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const u = await getUserFromRequest(req, db);
    if (!u) return res.status(200).json({ eligible: false, reason: "Sign in to continue." });
    try {
      const orderCount = await userStats(db, new ObjectId(u.userId));
      const mine = await col.findOne({ user_id: new ObjectId(u.userId), seed: { $ne: true } });
      return res.status(200).json({
        eligible: orderCount >= 1,
        reason: orderCount >= 1 ? null : "Place your first order to unlock reviewing.",
        order_count: orderCount,
        my_review: mine ? { ...publicReview(mine), status: mine.status } : null,
      });
    } catch {
      return res.status(500).json({ error: "Failed to check eligibility" });
    }
  }

  // ── Authed: create or update own review ──────────────────────
  if (action === "submit" && req.method === "POST") {
    const u = await getUserFromRequest(req, db);
    if (!u) return res.status(401).json({ error: "Sign in to write a review." });
    if (denySupportMutation(u, res, false)) return;
    const rl = await checkRateLimit(`review_${u.userId}`, 5, 600, db);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Too many edits. Try again in ${rl.remainingSec}s.` });
    }
    try {
      const { rating, text, city } = req.body || {};
      const r = Number(rating);
      const t = String(text || "").trim();
      if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: "Rating must be a whole number from 1 to 5 stars." });
      if (t.length < 40) return res.status(400).json({ error: "Tell us a little more — at least 40 characters." });
      if (t.length > 1200) return res.status(400).json({ error: "Keep it under 1,200 characters." });
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(t)) {
        return res.status(400).json({ error: "Review text contains unsupported control characters." });
      }

      const userId = new ObjectId(u.userId);
      const orderCount = await userStats(db, userId);
      if (orderCount < 1) {
        return res.status(403).json({ error: "Reviews are for verified buyers. Place an order first — it can be any service, any size." });
      }

      const doc = {
        user_id: userId,
        seed: false,
        username: u.username,
        city: city ? String(city).trim().slice(0, 40) : null,
        rating: r,
        text: t,
        orders_count: orderCount,
        updated_at: new Date(),
      };

      await col.updateOne(
        { user_id: userId, seed: { $ne: true } },
        {
          $set: doc,
          // Admin moderation persists through user edits; an owner-hidden review
          // cannot silently republish itself by being edited.
          $setOnInsert: { created_at: new Date(), status: "approved" },
        },
        { upsert: true }
      );

      const saved = await col.findOne({ user_id: userId, seed: { $ne: true } });
      if (saved) {
        sendReviewSubmittedAlert({
          reviewId: saved._id.toString(),
          username: u.username,
          rating: r,
          text: t,
          city: doc.city,
        }).catch(() => {});
      }
      return res.status(200).json({ success: true, message: "Thank you — your review was saved." });
    } catch {
      return res.status(500).json({ error: "Failed to save review. Try again shortly." });
    }
  }

  // Review moderation intentionally has NO website endpoint. It lives directly
  // inside the owner-only Telegram admin bot and writes to MongoDB there.
  return res.status(404).json({ error: "Not found" });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleReviewsRequest(req, res);
  } catch (error: any) {
    console.error("handleReviewsRequest uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
}
