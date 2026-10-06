import crypto from "node:crypto";
import type { Db } from "mongodb";
import { getDb } from "./db.js";

export interface RateLimitResult {
  allowed: boolean;
  remainingSec: number;
  remaining: number;
}

let indexPromise: Promise<string> | null = null;

function hashKey(key: string): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET || process.env.SESSION_METADATA_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("RATE_LIMIT_HASH_SECRET or JWT_SECRET is required for persistent rate limiting.");
  return crypto.createHmac("sha256", secret).update(key).digest("hex");
}

async function ensureIndex(db: Db) {
  if (!indexPromise) {
    indexPromise = db.collection("rate_limits").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  await indexPromise;
}

/**
 * Shared MongoDB fixed-window limiter. The unique _id makes increments atomic
 * across every Vercel instance; a duplicate-key upsert means the window is full.
 * Database/index failures throw so sensitive callers fail closed.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 180,
  suppliedDb?: Db,
): Promise<RateLimitResult> {
  const max = Math.max(1, Math.min(Math.trunc(maxAttempts), 100_000));
  const window = Math.max(1, Math.min(Math.trunc(windowSeconds), 86_400));
  const nowMs = Date.now();
  const windowMs = window * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowEndMs = windowStartMs + windowMs;
  const keyHash = hashKey(key);
  const id = `${keyHash}:${windowStartMs}`;
  const db = suppliedDb || await getDb();
  await ensureIndex(db);

  try {
    const record: any = await db.collection<any>("rate_limits").findOneAndUpdate(
      { _id: id, count: { $lt: max } },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          key_hash: keyHash,
          window_started_at: new Date(windowStartMs),
          window_ends_at: new Date(windowEndMs),
          expires_at: new Date(windowEndMs + 5 * 60_000),
          created_at: new Date(nowMs),
        },
        $set: { last_seen_at: new Date(nowMs) },
      },
      { upsert: true, returnDocument: "after" },
    );
    const count = Number(record?.count || 1);
    return { allowed: true, remainingSec: 0, remaining: Math.max(0, max - count) };
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    return {
      allowed: false,
      remainingSec: Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000)),
      remaining: 0,
    };
  }
}

export async function resetRateLimit(key: string, suppliedDb?: Db): Promise<void> {
  const db = suppliedDb || await getDb();
  await db.collection("rate_limits").deleteMany({ key_hash: hashKey(key) });
}
