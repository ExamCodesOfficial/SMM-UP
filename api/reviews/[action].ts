import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import { getUserFromRequest } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";
import { sendReviewSubmittedAlert } from "../lib/telegram.js";

// ── Data model ─────────────────────────────────────────────────
// reviews: { user_id?: ObjectId, seed: boolean, username, city?,
//            rating 1-5, text, status: "approved"|"hidden",
//            orders_count, created_at, updated_at }

// Qualifying order = real purchase (charged, not voided/failed/refunded)
const QUALIFYING_STATUSES = [
  "Pending", "Processing", "In progress", "Completed", "Partial",
];

// Founder-curated starter set — text preserved verbatim from the
// original homepage section, now mirrored as first-class audit rows in the
// DB while remaining permanently displayed in their original homepage slot.
const SEED_REVIEWS = [
  {
    seed: true, username: "Rohit Malhotra", city: "New Delhi", role: "Telegram channel owner",
    rating: 5, metric: "24,600", metric_label: "Telegram members added",
    headline: "Took my study channel from 0 to 25K",
    text: "Started in August with an empty channel. Ordered members in batches, never more than 2–3K at a time. Drops happened on two batches and both refilled without me even asking twice. Views package on top now, every post crosses 6–7K views.",
    orders_count: 14, created_at: new Date("2026-07-18T10:00:00Z"),
  },
  {
    seed: true, username: "Shreya Verma", city: "Patna", role: "Boutique agency co-founder",
    rating: 5, metric: "9,800", metric_label: "Instagram followers",
    headline: "Agency work got 10x cheaper",
    text: "I run a two-person agency in Patna and used to pay a reseller almost 4x these rates for the same delivery speed. Moved all client work here two months back. The UTR deposit thing sounded odd at first, now I get why they skipped the gateway — it's fast and nothing gets eaten in fees.",
    orders_count: 31, created_at: new Date("2026-07-29T14:30:00Z"),
  },
  {
    seed: true, username: "Farhan Sheikh", city: "Mumbai", role: "YouTube creator, 41K subs",
    rating: 4, metric: "3,400 hrs", metric_label: "YouTube watch time",
    headline: "Watch time actually completed",
    text: "Burned by two panels before this one — ordered 4,000 hours each time, money gone, hours stuck at 2K. Here the 3,400-hour order finished in about 9 days like the card said. Took one star off because the first status sync lagged a bit; support sorted it on Telegram the same evening.",
    orders_count: 9, created_at: new Date("2026-08-11T09:15:00Z"),
  },
  {
    seed: true, username: "Aditya Rao", city: "Bengaluru", role: "Reseller, runs client panel on the API",
    rating: 5, metric: "37", metric_label: "Repeat orders placed",
    headline: "Founder personally stands behind it",
    text: "One deposit took longer than usual — messaged the desk expecting a bot reply in three days. Aryan himself checked the bank alert and credited it in minutes. That one interaction is why I stopped testing other panels.",
    orders_count: 37, created_at: new Date("2026-08-30T16:45:00Z"),
  },
  {
    seed: true, username: "Priya Nair", city: "Kochi", role: "Lifestyle creator",
    rating: 5, metric: "12,500", metric_label: "Reels views, 6 reels",
    headline: "Growth that survives audits",
    text: "Was scared cheap views would look fake and tank my engagement rate. Ordered for 6 reels, split across two weeks. Reach pushed past 40K on one of them and the ratio still looks natural to a brand checking my media kit.",
    orders_count: 22, created_at: new Date("2026-09-12T11:20:00Z"),
  },
  {
    seed: true, username: "Vikram Singh", city: "Jaipur", role: "Dropshipping + Instagram seller",
    rating: 4, metric: "0%", metric_label: "Deposit fee, every top-up",
    headline: "The fee math is honestly why I stay",
    text: "Every other panel quietly skims 2–4% when you load money. Here ₹1,000 is ₹1,000. Rates on Instagram are already low, so zero fee compounds. API docs are clear enough that my developer friend connected my shop in an evening.",
    orders_count: 17, created_at: new Date("2026-09-26T18:10:00Z"),
  },
];

async function ensureSeed(db: any) {
  const col = db.collection("reviews");
  await col.bulkWrite(
    SEED_REVIEWS.map((r, i) => ({
      updateOne: {
        filter: { seed_key: `homepage-${i + 1}` },
        update: {
          $setOnInsert: {
            ...r,
            seed_key: `homepage-${i + 1}`,
            status: "approved",
            updated_at: r.created_at,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawAction = req.query.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction || "";
  const db = await getDb();
  const col = db.collection("reviews");

  await ensureSeed(db);

  // ── Public: latest approved community submissions ────────────
  // The six established reviews remain permanently on the homepage; this
  // deliberately isn't an aggregate or paginated review directory.
  if (action === "list" && req.method === "GET") {
    try {
      const reviews = await col
        .find({ status: "approved", seed: { $ne: true } })
        .sort({ created_at: -1 })
        .limit(12)
        .toArray();
      // Moderation is owner-controlled from Telegram; don't let an edge cache
      // keep a just-hidden review visible.
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ reviews: reviews.map(publicReview) });
    } catch {
      return res.status(500).json({ error: "Failed to load reviews" });
    }
  }

  // ── Public: can the signed-in visitor write one? ─────────────
  if (action === "eligibility" && req.method === "GET") {
    const u = getUserFromRequest(req);
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
    const u = getUserFromRequest(req);
    if (!u) return res.status(401).json({ error: "Sign in to write a review." });
    const rl = checkRateLimit(`review_${u.userId}`, 5, 600);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Too many edits. Try again in ${rl.remainingSec}s.` });
    }
    try {
      const { rating, text, city } = req.body || {};
      const r = Number(rating);
      const t = String(text || "").trim();
      if (!r || r < 1 || r > 5) return res.status(400).json({ error: "Rating must be 1–5 stars." });
      if (t.length < 40) return res.status(400).json({ error: "Tell us a little more — at least 40 characters." });
      if (t.length > 1200) return res.status(400).json({ error: "Keep it under 1,200 characters." });

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
