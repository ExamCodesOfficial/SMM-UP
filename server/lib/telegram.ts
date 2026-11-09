/**
 * Telegram Bot Dispatcher for SMM UP
 * Dispatches real-time payment confirmation logs and delayed payment alerts to Admin Group.
 */

export interface PaymentSuccessAlertData {
  userEmail: string;
  amount: number;
  method?: string;
  utr?: string;
  transactionId?: string;
  memo?: string;
  newBalance?: number;
}

export interface PaymentDelayAlertData {
  userEmail: string;
  amount: number;
  memo: string;
  elapsedSeconds: number;
  upiVpa?: string;
}

export async function sendTelegramMessage(text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.log("[Telegram Notification Skipped - No Token/ChatID]", text.replace(/<[^>]+>/g, ""));
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: AbortSignal.timeout(4000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      console.error("[Telegram HTTP Error]:", res.status);
      return false;
    }
    const data = await res.json();
    if (!data.ok) {
      console.error("[Telegram Send Error]:", data.description);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[Telegram Network Error]:", err?.message || err);
    return false;
  }
}

/**
 * Sends a message and reports what actually happened.
 *
 * `sendTelegramMessage` returns a boolean and throws the reason away,
 * which is why a missing notification could never be diagnosed. This one
 * keeps the error so the caller can store it on the queue row and the
 * owner can see that a delivery failed instead of believing it worked.
 */
export async function sendTelegramMessageDetailed(
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<{ ok: boolean; error?: string | null; status?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not set." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, status: res.status };
    }

    const data: any = await res.json().catch(() => null);
    if (!data?.ok) {
      return { ok: false, error: String(data?.description || "unknown Telegram error"), status: res.status };
    }
    return { ok: true, error: null, status: res.status };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !messageId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      signal: AbortSignal.timeout(4000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[Telegram Edit HTTP Error]:", res.status);
      return false;
    }
    const data = await res.json();
    if (!data.ok) {
      console.error("[Telegram Edit Error]:", data.description);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[Telegram Edit Network Error]:", err?.message || err);
    return false;
  }
}

/**
 * Sends a luxury audit log to Admin Group on payment confirmation
 */
export async function sendPaymentSuccessAlert(data: PaymentSuccessAlertData): Promise<boolean> {
  const now = new Date();
  const timeStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const message = [
    `💰 <b>PAYMENT CONFIRMED — SMM UP</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>User:</b> <code>${escapeHtml(data.userEmail)}</code>`,
    `💵 <b>Amount Credited:</b> <b>₹${data.amount.toFixed(2)} INR</b>`,
    `⚡ <b>Payment Method:</b> ${escapeHtml(data.method || "FamPay / UPI Direct")}`,
    data.memo ? `🔖 <b>Dynamic Memo:</b> <code>${escapeHtml(data.memo)}</code>` : null,
    data.utr ? `🏦 <b>12-Digit UTR:</b> <code>${escapeHtml(data.utr)}</code>` : null,
    data.transactionId ? `🆔 <b>Provider TxID:</b> <code>${escapeHtml(data.transactionId)}</code>` : null,
    data.newBalance !== undefined ? `💳 <b>New User Balance:</b> <b>₹${data.newBalance.toFixed(2)}</b>` : null,
    `⏱️ <b>Settlement Time:</b> ${timeStr}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `✅ <i>Verified via Live IMAP Banking Reconciliation</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage(message, "HTML");
}

/**
 * Sends an alert to Admin Group if a user has been waiting > 60-90s on the QR screen
 */
export async function sendPaymentDelayAlert(data: PaymentDelayAlertData): Promise<boolean> {
  const message = [
    `⚠️ <b>DEPOSIT DELAY ALERT (> ${Math.round(data.elapsedSeconds)}s)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>Client:</b> <code>${escapeHtml(data.userEmail)}</code>`,
    `💵 <b>Expected Amount:</b> ₹${data.amount.toFixed(2)} INR`,
    `🔖 <b>Dynamic Memo:</b> <code>${escapeHtml(data.memo)}</code>`,
    `⏳ <b>Waiting Time:</b> ${Math.round(data.elapsedSeconds)} seconds`,
    data.upiVpa ? `🏦 <b>Target UPI VPA:</b> <code>${escapeHtml(data.upiVpa)}</code>` : null,
    `━━━━━━━━━━━━━━━━━━━━`,
    `ℹ️ <i>User is actively waiting on the deposit screen. Bank notification or webhook may be delayed.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage(message, "HTML");
}

export interface FailedOrderAlertData {
  orderId: string;
  userEmail: string;
  serviceName: string;
  charge: number;
  error: string;
}

/**
 * Sends an urgent alert to Admin Group / Telegram Owner when an order fails upstream,
 * notifying them that funds are retained and manual review is required.
 */
export async function sendFailedOrderAlert(data: FailedOrderAlertData): Promise<boolean> {
  const message = [
    `🚨 <b>FAILED ORDER FLAGGED — REQUIRES ADMIN REVIEW</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>Internal Order ID:</b> <code>${escapeHtml(data.orderId)}</code>`,
    `👤 <b>Client:</b> <code>${escapeHtml(data.userEmail)}</code>`,
    `📦 <b>Service:</b> ${escapeHtml(data.serviceName)}`,
    `💵 <b>Debited Amount:</b> ₹${data.charge.toFixed(2)} INR`,
    `⚠️ <b>Provider Reason:</b> <code>${escapeHtml(data.error)}</code>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔒 <i>Zero Auto-Refund Enforced: Funds remain debited. Admin must review and trigger manual refund or manual provider fulfillment.</i>`,
    `⚡ <i>Telegram Action: <code>/refund ${escapeHtml(data.orderId)}</code></i>`,
  ].join("\n");

  return sendTelegramMessage(message, "HTML");
}

export interface ReviewSubmittedAlertData {
  reviewId: string;
  username: string;
  rating: number;
  text: string;
  city?: string | null;
}

/** Sends a buyer-review notification. Moderation itself stays exclusively in
 * the owner-only Telegram bot via /reviews — there is no web admin route. */
export async function sendReviewSubmittedAlert(data: ReviewSubmittedAlertData): Promise<boolean> {
  const stars = "★".repeat(Math.max(1, Math.min(5, data.rating)));
  const message = [
    `⭐ <b>VERIFIED BUYER REVIEW SAVED</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>User:</b> <code>${escapeHtml(data.username)}</code>`,
    `⭐ <b>Rating:</b> ${stars}`,
    data.city ? `📍 <b>City:</b> ${escapeHtml(data.city)}` : null,
    `🆔 <b>Review ID:</b> <code>${escapeHtml(data.reviewId)}</code>`,
    ``,
    escapeHtml(data.text.slice(0, 700)),
    `━━━━━━━━━━━━━━━━━━━━`,
    `⚡ <i>Open <code>/reviews</code> for one-tap Hide / Show controls.</i>`,
  ].filter((line) => line !== null).join("\n");
  return sendTelegramMessage(message, "HTML");
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
