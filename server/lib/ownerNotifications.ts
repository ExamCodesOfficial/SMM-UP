/**
 * Owner notification queue.
 *
 * The website knows exactly WHEN a payment event happens (an order was
 * created, money was credited), but it is not the component that owns the
 * Telegram conversation. The Telegram bot on Railway does.
 *
 * Previously the website tried to send those alerts itself, straight to
 * Telegram. That failed silently: the send is best-effort, the error is only
 * written to a serverless log nobody reads, and the owner is left believing
 * that a payment went unnoticed. Worse, the chat id used by the website and
 * the one used by the bot are not guaranteed to be the same conversation.
 *
 * So the website now writes an immutable notification row and the bot
 * delivers it. That gives us:
 *
 *   - one delivery channel (the bot, whose Telegram chat id is proven),
 *   - exactly-once semantics (a unique dedupe key),
 *   - retries when a send fails, instead of dropping the message,
 *   - and an audit trail of every notification the owner should have seen.
 *
 * The website NEVER holds a Telegram credential and the bot NEVER needs a
 * provider credential. Each side keeps only what it needs.
 */

import { getDb } from "./db.js";

export const OWNER_NOTIFICATION_COLLECTION = "owner_notification_queue";

export type OwnerNotificationEvent =
  | "order_placed"
  | "money_added"
  | "review_required"
  | "order_failed"
  | "review_submitted";

export interface OwnerNotificationInput {
  /** Globally unique key. The same event is never queued twice. */
  dedupeKey: string;
  event: OwnerNotificationEvent;
  userEmail?: string | null;
  amount?: number | null;
  method?: string | null;
  provider?: string | null;
  providerOrderId?: string | null;
  transactionId?: string | null;
  utr?: string | null;
  newBalance?: number | null;
  reviewReason?: string | null;
  serviceName?: string | null;
  detail?: string | null;
}

/**
 * Human-readable label for the payment method, used in the notification.
 * The bot renders the message, but the label lives with the event so the
 * queue row stays self-describing.
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
      created_at: now,
      sent_at: null,
      attempts: 0,
      claimed_at: null,
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
