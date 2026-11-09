/**
 * Owner notification queue.
 *
 * The website knows exactly WHEN a payment event happens (an order was
 * created, money was credited) but the notification used to be sent
 * straight to Telegram from the website, best-effort:
 *
 *   - the send was swallowed on error, so the error only ever reached a
 *     serverless log nobody reads and the owner was told nothing while
 *     the alert silently vanished;
 *   - there was no retry and no record, so a transient blip meant the
 *     alert was gone for good;
 *   - and the chat id the website used was not guaranteed to be the same
 *     conversation the bot used.
 *
 * So every event is now written to a durable queue first. The website
 * then delivers it immediately — it holds a Telegram credential that is
 * known to reach the owner — and the Telegram bot on Railway picks up
 * anything still pending, retries it and keeps the audit trail.
 *
 * Exactly-once comes from two places: the unique dedupe key means the
 * same real-world event is only ever queued once, and the claim lease
 * means the website and the bot never deliver the same row at the same
 * time.
 */

import { getDb } from "./db.js";
import { sendTelegramMessageDetailed } from "./telegram.js";
import {
  renderOwnerNotification,
  type OwnerNotificationEvent,
  type OwnerNotificationMessageInput,
} from "./ownerNotificationMessages.js";

export const OWNER_NOTIFICATION_COLLECTION = "owner_notification_queue";

/**
 * Where the owner-chat id is published.
 *
 * The bot has its own TELEGRAM_OWNER_ID, and if that value is stale the
 * bot delivers alerts to a chat the owner never reads while the owner is
 * locked out of the bot. The website already knows the chat id that
 * reaches the owner — it is the one it sends its own alerts to — so it
 * publishes that id here and the bot accepts it as well.
 *
 * Only the chat id is published. No token, no secret.
 */
export const OWNER_IDENTITY_COLLECTION = "owner_notification_config";

export type { OwnerNotificationEvent };

export interface OwnerNotificationInput extends OwnerNotificationMessageInput {
  /** Globally unique key. The same event is never queued twice. */
  dedupeKey: string;
  event: OwnerNotificationEvent;
  provider?: string | null;
}

/**
 * Human-readable label for the payment method, used in the notification.
 * The label lives with the event so the queue row stays self-describing.
 */
export function describePaymentMethod(method: string | null | undefined): string {
  switch (String(method || "").toUpperCase()) {
    case "FAMGATEWAY_UPI":
      return "UPI Automatic (FamGateway)";
    case "OXAPAY_CRYPTO":
      return "Crypto (OxaPay)";
    case "RAZORPAY":
      return "Razorpay";
    case "FAMPAY_UPI":
    case "UPI":
      return "UPI (Direct)";
    default:
      return String(method || "Unknown method");
  }
}

/**
 * Publishes the chat id the website uses, so the bot can deliver to the
 * same conversation even if its own environment variable is wrong.
 *
 * A failure here is never fatal: it only means the bot keeps using its
 * own configured id.
 */
async function publishOwnerChatId(db: any, now: Date): Promise<void> {
  const chatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  if (!/^\d+$/.test(chatId)) return;
  try {
    await db.collection(OWNER_IDENTITY_COLLECTION).updateOne(
      { _id: "owner" },
      {
        $set: { chat_id: chatId, source: "website", updated_at: now },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  } catch (error: any) {
    console.error("[OwnerNotification] could not publish the owner chat id:", error?.message || error);
  }
}

/**
 * Queues one owner notification.
 *
 * Never throws: a notification is a courtesy, and it must never be able to
 * fail a payment or an order. A duplicate key means the same event was
 * already queued, which is exactly the desired behaviour.
 */
export async function enqueueOwnerNotification(
  input: OwnerNotificationInput,
): Promise<{ queued: boolean; duplicate: boolean }> {
  if (!input?.dedupeKey || !input?.event) {
    return { queued: false, duplicate: false };
  }
  try {
    const db = await getDb();
    const now = new Date();
    await publishOwnerChatId(db, now);
    await db.collection(OWNER_NOTIFICATION_COLLECTION).insertOne({
      dedupe_key: input.dedupeKey,
      event: input.event,
      user_email: input.userEmail ?? null,
      amount: input.amount ?? null,
      method: input.method ?? null,
      provider: input.provider ?? null,
      provider_order_id: input.providerOrderId ?? null,
      transaction_id: input.transactionId ?? null,
      utr: input.utr ?? null,
      new_balance: input.newBalance ?? null,
      review_reason: input.reviewReason ?? null,
      service_name: input.serviceName ?? null,
      detail: input.detail ?? null,
      rating: input.rating ?? null,
      // The rendered message travels with the row so whichever side
      // delivers it, the owner reads exactly the same text.
      message_html: renderOwnerNotification(input),
      created_at: now,
      sent_at: null,
      attempts: 0,
      claimed_at: null,
      claim_id: null,
    });
    return { queued: true, duplicate: false };
  } catch (error: any) {
    if (error?.code === 11000) {
      return { queued: false, duplicate: true };
    }
    console.error("[OwnerNotification] queue failed:", error?.message || error);
    return { queued: false, duplicate: false };
  }
}

/** How long a delivery claim is held before another instance may retry it. */
const CLAIM_LEASE_MS = 120_000;

/**
 * Delivers one queued notification right now.
 *
 * The row is claimed with a short lease first. The website and the bot
 * use the same lease, so when both are alive exactly one of them delivers
 * the row — never both.
 *
 * Returns what happened so the caller can log it. A failure is not an
 * error: the row stays pending and the bot retries it.
 */
export async function deliverOwnerNotificationByKey(
  dedupeKey: string,
): Promise<{ delivered: boolean; skipped: boolean; error?: string | null }> {
  if (!dedupeKey) return { delivered: false, skipped: true, error: "no dedupe key" };

  let claimId: string;
  let row: any;
  try {
    const db = await getDb();
    const now = new Date();
    const staleClaim = new Date(now.getTime() - CLAIM_LEASE_MS);
    claimId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    row = await db.collection(OWNER_NOTIFICATION_COLLECTION).findOneAndUpdate(
      {
        dedupe_key: dedupeKey,
        sent_at: null,
        $or: [
          { claimed_at: { $exists: false } },
          { claimed_at: null },
          { claimed_at: { $lt: staleClaim } },
        ],
      },
      { $set: { claimed_at: now, claim_id: claimId }, $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
  } catch (error: any) {
    console.error("[OwnerNotification] claim failed:", error?.message || error);
    return { delivered: false, skipped: true, error: String(error?.message || error) };
  }

  if (!row) {
    // Another instance holds the claim, or the row is already delivered.
    return { delivered: false, skipped: true };
  }

  const text: string =
    row.message_html ||
    renderOwnerNotification({
      event: row.event,
      userEmail: row.user_email,
      amount: row.amount,
      method: row.method,
      providerOrderId: row.provider_order_id,
      transactionId: row.transaction_id,
      utr: row.utr,
      newBalance: row.new_balance,
      reviewReason: row.review_reason,
      serviceName: row.service_name,
      detail: row.detail,
      rating: row.rating,
    });

  const result = await sendTelegramMessageDetailed(text);

  try {
    const db = await getDb();
    if (result.ok) {
      await db.collection(OWNER_NOTIFICATION_COLLECTION).updateOne(
        { dedupe_key: dedupeKey, claim_id: claimId },
        {
          $set: { sent_at: new Date(), last_error: null, delivered_by: "website" },
          $unset: { claimed_at: "", claim_id: "" },
        },
      );
    } else {
      await db.collection(OWNER_NOTIFICATION_COLLECTION).updateOne(
        { dedupe_key: dedupeKey, claim_id: claimId },
        {
          $set: { last_error: String(result.error || "unknown").slice(0, 300), last_error_at: new Date() },
          $unset: { claimed_at: "", claim_id: "" },
        },
      );
    }
  } catch (error: any) {
    console.error("[OwnerNotification] delivery bookkeeping failed:", error?.message || error);
  }

  if (!result.ok) {
    console.error("[OwnerNotification] telegram delivery failed:", result.error);
  }
  return { delivered: result.ok, skipped: false, error: result.ok ? null : result.error };
}

/**
 * Ensures the queue's indexes exist. Called by the bot before it starts
 * delivering, and by the website on its first write.
 */
export async function ensureOwnerNotificationIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(OWNER_NOTIFICATION_COLLECTION).createIndex(
    { dedupe_key: 1 },
    { unique: true, name: "owner_notification_queue_dedupe_unique" },
  );
  await db.collection(OWNER_NOTIFICATION_COLLECTION).createIndex(
    { sent_at: 1, created_at: 1 },
    { name: "owner_notification_queue_pending" },
  );
  await db.collection(OWNER_NOTIFICATION_COLLECTION).createIndex(
    { created_at: -1 },
    { name: "owner_notification_queue_recent" },
  );
}
