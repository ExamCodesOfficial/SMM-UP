/**
 * The owner-notification message renderer.
 *
 * The website renders the message and stores it on the queue row. The bot
 * then sends exactly that text. Rendering happens in one place, so the
 * message the owner reads is identical no matter which side delivers it —
 * and a row that was written by an older website can still be rendered by
 * the bot itself.
 *
 * Everything customer-controlled is escaped. Telegram HTML is not a
 * sandbox: an unescaped `<` in a customer's email is not a formatting
 * glitch, it is a way to make the bot post something the owner did not
 * intend.
 */

export type OwnerNotificationEvent =
  | "order_placed"
  | "money_added"
  | "review_required"
  | "order_failed"
  | "review_submitted"
  | "delay_alert";

export interface OwnerNotificationMessageInput {
  event: string;
  userEmail?: string | null;
  amount?: number | null;
  method?: string | null;
  providerOrderId?: string | null;
  transactionId?: string | null;
  utr?: string | null;
  newBalance?: number | null;
  reviewReason?: string | null;
  serviceName?: string | null;
  detail?: string | null;
  rating?: number | null;
}

const RULE = "━━━━━━━━━━━━━━━━━━━━";

function escape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function istNow(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

/**
 * Builds the message the owner reads.
 *
 * Every branch lists the facts an owner actually acts on: who paid, how
 * much, which provider reference to look up, and the provider's own
 * identifier (the UTR) so the payment can be reconciled against the bank
 * statement.
 */
export function renderOwnerNotification(input: OwnerNotificationMessageInput): string {
  const event = String(input.event || "notification");
  const amount = Number(input.amount || 0);
  const lines: string[] = [];

  if (event === "money_added") {
    lines.push(
      `💰 <b>MONEY ADDED TO WALLET</b>`,
      RULE,
      `👤 <b>User:</b> <code>${escape(input.userEmail || "unknown")}</code>`,
      `💵 <b>Credited:</b> <b>₹${amount.toFixed(2)} INR</b>`,
      `⚡ <b>Method:</b> ${escape(input.method || "Unknown")}`,
    );
    if (input.providerOrderId) lines.push(`🔖 <b>Provider Order:</b> <code>${escape(input.providerOrderId)}</code>`);
    if (input.utr) lines.push(`🏦 <b>UTR:</b> <code>${escape(input.utr)}</code>`);
    if (input.transactionId) lines.push(`🆔 <b>Tx ID:</b> <code>${escape(input.transactionId)}</code>`);
    if (input.newBalance !== null && input.newBalance !== undefined) {
      lines.push(`💳 <b>New Balance:</b> <b>₹${Number(input.newBalance).toFixed(2)}</b>`);
    }
    lines.push(
      `⏱️ <b>Time:</b> ${istNow()} IST`,
      RULE,
      `✅ <i>Verified against the payment provider and credited automatically.</i>`,
    );
    return lines.join("\n");
  }

  if (event === "order_placed") {
    lines.push(
      `🧾 <b>NEW PAYMENT REQUEST</b>`,
      RULE,
      `👤 <b>User:</b> <code>${escape(input.userEmail || "unknown")}</code>`,
      `💵 <b>Amount:</b> <b>₹${amount.toFixed(2)} INR</b>`,
      `⚡ <b>Method:</b> ${escape(input.method || "Unknown")}`,
    );
    if (input.providerOrderId) lines.push(`🔖 <b>Provider Order:</b> <code>${escape(input.providerOrderId)}</code>`);
    if (input.detail) lines.push(`📝 <b>Detail:</b> ${escape(input.detail)}`);
    lines.push(
      `⏱️ <b>Time:</b> ${istNow()} IST`,
      RULE,
      `ℹ️ <i>Waiting for the customer to pay. The wallet is credited automatically.</i>`,
    );
    return lines.join("\n");
  }

  if (event === "review_required" || event === "delay_alert") {
    lines.push(
      event === "delay_alert" ? `⏳ <b>DEPOSIT DELAY</b>` : `⚠️ <b>NEEDS REVIEW</b>`,
      RULE,
    );
    if (input.userEmail) lines.push(`👤 <b>User:</b> <code>${escape(input.userEmail)}</code>`);
    if (amount > 0) lines.push(`💵 <b>Amount:</b> <b>₹${amount.toFixed(2)} INR</b>`);
    if (input.method) lines.push(`⚡ <b>Method:</b> ${escape(input.method)}`);
    if (input.providerOrderId) lines.push(`🔖 <b>Reference:</b> <code>${escape(input.providerOrderId)}</code>`);
    if (input.utr) lines.push(`🏦 <b>UTR:</b> <code>${escape(input.utr)}</code>`);
    if (input.reviewReason) lines.push(`📝 <b>Reason:</b> ${escape(input.reviewReason)}`);
    if (input.detail) lines.push(`📝 <b>Detail:</b> ${escape(input.detail)}`);
    lines.push(
      `⏱️ <b>Time:</b> ${istNow()} IST`,
      RULE,
      `🔎 <i>The customer was credited what actually arrived. Please verify this one.</i>`,
    );
    return lines.join("\n");
  }

  if (event === "order_failed") {
    lines.push(
      `🚨 <b>ORDER FAILED — ADMIN REVIEW REQUIRED</b>`,
      RULE,
      `🆔 <b>Order ID:</b> <code>${escape(input.providerOrderId || "unknown")}</code>`,
      `👤 <b>Client:</b> <code>${escape(input.userEmail || "unknown")}</code>`,
      `📦 <b>Service:</b> ${escape(input.serviceName || "unknown")}`,
      `💵 <b>Debited:</b> ₹${amount.toFixed(2)} INR`,
      `⚠️ <b>Provider Reason:</b> ${escape(input.detail || "unknown")}`,
      RULE,
      `🔒 <i>Zero auto-refund: funds remain debited. Please review and refund manually.</i>`,
    );
    return lines.join("\n");
  }

  if (event === "review_submitted") {
    const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating || 1))));
    lines.push(
      `⭐ <b>BUYER REVIEW SAVED</b>`,
      RULE,
      `👤 <b>User:</b> <code>${escape(input.userEmail || "unknown")}</code>`,
      `⭐ <b>Rating:</b> ${"★".repeat(rating)}`,
      `🆔 <b>Review ID:</b> <code>${escape(input.providerOrderId || "")}</code>`,
      ``,
      escape(String(input.detail || "").slice(0, 700)),
      RULE,
      `⚡ <i>Open <code>/reviews</code> for one-tap hide / show controls.</i>`,
    );
    return lines.join("\n");
  }

  lines.push(
    `🔔 <b>${escape(event.replace(/_/g, " ").toUpperCase())}</b>`,
    RULE,
  );
  if (input.userEmail) lines.push(`👤 <b>User:</b> <code>${escape(input.userEmail)}</code>`);
  if (amount > 0) lines.push(`💵 <b>Amount:</b> <b>₹${amount.toFixed(2)} INR</b>`);
  if (input.method) lines.push(`⚡ <b>Method:</b> ${escape(input.method)}`);
  if (input.providerOrderId) lines.push(`🔖 <b>Reference:</b> <code>${escape(input.providerOrderId)}</code>`);
  if (input.detail) lines.push(`📝 <b>Detail:</b> ${escape(input.detail)}`);
  lines.push(`⏱️ <b>Time:</b> ${istNow()} IST`);
  return lines.join("\n");
}
