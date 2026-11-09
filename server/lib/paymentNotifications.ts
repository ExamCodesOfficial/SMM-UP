/**
 * Owner-facing notifications for payment and order events.
 *
 * These are the alerts the owner sees in Telegram. They used to be sent
 * directly from the website to Telegram, which was fragile in three ways:
 *
 *   1. The chat id on the website and the chat id the bot uses are not
 *      guaranteed to be the same conversation, so an alert could land in a
 *      chat the owner never opens.
 *   2. A failed send was swallowed: the error only reached a serverless log,
 *      so the owner was told nothing while the alert silently vanished.
 *   3. There was no retry and no record, so a transient network blip meant
 *      the alert was gone for good.
 *
 * Every alert is now written to a durable queue. The Telegram bot on Railway
 * delivers it, retries on failure, and keeps the audit trail. The website
 * holds no Telegram credential for this path at all.
 *
 * The direct Telegram sender stays available for the two cases that must
 * happen inside a live request (the temporary-password and support-access
 * messages, which EDIT an existing message) and for the delay alert, which
 * is worthless if it arrives late.
 */

import { enqueueOwnerNotification, describePaymentMethod, type OwnerNotificationEvent } from "./ownerNotifications.js";
import { sendTelegramMessage } from "./telegram.js";

export interface PaymentEventInput {
  userEmail: string;
  amount: number;
  method: string;
  provider?: string | null;
  providerOrderId?: string | null;
  transactionId?: string | null;
  utr?: string | null;
  newBalance?: number | null;
  reviewReason?: string | null;
}

/**
 * Queues the "money arrived" notification.
 *
 * The dedupe key is derived from the provider's own order reference, so the
 * same payment can never be announced twice even if it is settled by the
 * webhook, by a browser poll and by the reconciliation sweep.
 */
export async function notifyMoneyAdded(input: PaymentEventInput): Promise<void> {
  const reference = String(input.providerOrderId || input.transactionId || "").trim();
  if (!reference) return;
  await enqueueOwnerNotification({
    dedupeKey: `money_added:${input.provider || "unknown"}:${reference}`,
    event: "money_added",
    userEmail: input.userEmail,
    amount: input.amount,
    method: describePaymentMethod(input.method),
    provider: input.provider ?? null,
    providerOrderId: reference,
    transactionId: input.transactionId ?? null,
    utr: input.utr ?? null,
    newBalance: input.newBalance ?? null,
  });
}

/** Queues the "customer started a payment" notification. */
export async function notifyOrderPlaced(input: PaymentEventInput): Promise<void> {
  const reference = String(input.providerOrderId || input.transactionId || "").trim();
  if (!reference) return;
  await enqueueOwnerNotification({
    dedupeKey: `order_placed:${input.provider || "unknown"}:${reference}`,
    event: "order_placed",
    userEmail: input.userEmail,
    amount: input.amount,
    method: describePaymentMethod(input.method),
    provider: input.provider ?? null,
    providerOrderId: reference,
    transactionId: input.transactionId ?? null,
  });
}

/** Queues a "this payment needs a human look" notification. */
export async function notifyReviewRequired(input: PaymentEventInput): Promise<void> {
  const reference = String(input.providerOrderId || input.transactionId || "").trim();
  if (!reference) return;
  await enqueueOwnerNotification({
    dedupeKey: `review_required:${input.provider || "unknown"}:${reference}`,
    event: "review_required",
    userEmail: input.userEmail,
    amount: input.amount,
    method: describePaymentMethod(input.method),
    provider: input.provider ?? null,
    providerOrderId: reference,
    transactionId: input.transactionId ?? null,
    utr: input.utr ?? null,
    reviewReason: input.reviewReason ?? null,
  });
}

/** Queues a "this order failed upstream" notification. */
export async function notifyOrderFailed(input: {
  orderId: string;
  userEmail: string;
  serviceName: string;
  charge: number;
  error: string;
}): Promise<void> {
  const reference = String(input.orderId || "").trim();
  if (!reference) return;
  await enqueueOwnerNotification({
    dedupeKey: `order_failed:${reference}`,
    event: "order_failed",
    userEmail: input.userEmail,
    amount: input.charge,
    serviceName: input.serviceName,
    providerOrderId: reference,
    detail: input.error,
  });
}

/** Queues a "a buyer left a review" notification. */
export async function notifyReviewSubmitted(input: {
  reviewId: string;
  username: string;
  rating: number;
  text: string;
}): Promise<void> {
  const reference = String(input.reviewId || "").trim();
  if (!reference) return;
  await enqueueOwnerNotification({
    dedupeKey: `review_submitted:${reference}`,
    event: "review_submitted",
    userEmail: input.username,
    providerOrderId: reference,
    detail: input.text.slice(0, 700),
  });
}

/**
 * The delay alert is the one notification that must arrive WHILE the
 * customer is still staring at the QR screen, so it is sent directly
 * instead of being queued. If the direct send fails there is nothing left
 * to retry for, so the queue entry is used as the durable fallback.
 */
export async function notifyPaymentDelayed(input: {
  userEmail: string;
  amount: number;
  memo: string;
  elapsedSeconds: number;
  upiVpa?: string;
}): Promise<boolean> {
  const sent = await sendTelegramMessage(
    [
      `⚠️ <b>DEPOSIT DELAY ALERT (&gt; ${Math.round(input.elapsedSeconds)}s)</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Client:</b> <code>${escape(input.userEmail)}</code>`,
      `💵 <b>Expected Amount:</b> ₹${Number(input.amount || 0).toFixed(2)} INR`,
      `🔖 <b>Dynamic Memo:</b> <code>${escape(input.memo)}</code>`,
      `⏳ <b>Waiting Time:</b> ${Math.round(input.elapsedSeconds)} seconds`,
      input.upiVpa ? `🏦 <b>Target UPI VPA:</b> <code>${escape(input.upiVpa)}</code>` : "",
      `━━━━━━━━━━━━━━━━━━━━`,
      `ℹ️ <i>User is actively waiting on the deposit screen.</i>`,
    ].filter(Boolean).join("\n"),
    "HTML",
  );
  if (!sent) {
    // Queue it as a fallback so the alert is not lost entirely.
    await enqueueOwnerNotification({
      dedupeKey: `delay_alert:${input.memo}`,
      event: "review_required",
      userEmail: input.userEmail,
      amount: input.amount,
      method: "UPI (Direct)",
      detail: `Customer waiting ${Math.round(input.elapsedSeconds)}s on the payment screen (memo ${input.memo}).`,
    });
  }
  return sent;
}

function escape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type { OwnerNotificationEvent };
