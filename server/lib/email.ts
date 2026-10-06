import crypto from "node:crypto";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

export type EmailTokenPurpose = "registration" | "password_reset" | "email_change";

function publicOrigin() {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://smmup.co.in").trim();
  const parsed = new URL(configured);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("PUBLIC_SITE_URL must use HTTPS in production.");
  }
  return parsed.origin;
}

function tokenTtlMinutes(purpose: EmailTokenPurpose) {
  const fallback = purpose === "password_reset" ? 20 : purpose === "email_change" ? 30 : 60;
  const raw = Number.parseInt(String(process.env.EMAIL_TOKEN_TTL_MINUTES || fallback), 10);
  return Number.isFinite(raw) ? Math.max(10, Math.min(raw, 24 * 60)) : fallback;
}

export function hashEmailToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function emailPath(purpose: EmailTokenPurpose, rawToken: string) {
  const route = purpose === "password_reset" ? "/auth?reset_token=" : "/auth?verify_token=";
  return `${publicOrigin()}${route}${encodeURIComponent(rawToken)}`;
}

function emailCopy(purpose: EmailTokenPurpose, actionUrl: string) {
  if (purpose === "password_reset") {
    return {
      subject: "Reset your SMM UP password",
      heading: "Reset your password",
      body: "Use the secure link below to choose a new password. If you did not request this, you can ignore this email.",
      action: "Reset password",
      actionUrl,
    };
  }
  if (purpose === "email_change") {
    return {
      subject: "Confirm your new SMM UP email address",
      heading: "Confirm your new email",
      body: "Confirm this address to complete your account email change. This link is single-use.",
      action: "Confirm email change",
      actionUrl,
    };
  }
  return {
    subject: "Verify your SMM UP email address",
    heading: "Verify your email",
    body: "Verify this email address to activate your SMM UP account.",
    action: "Verify email",
    actionUrl,
  };
}

async function sendTransactionalEmail(to: string, purpose: EmailTokenPurpose, actionUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Transactional email is not configured.");
  const copy = emailCopy(purpose, actionUrl);
  const html = `<!doctype html><html><body style="margin:0;background:#090909;color:#f4f4f5;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="letter-spacing:.2em;color:#a1a1aa">SMM UP</p><h1 style="font-size:24px">${copy.heading}</h1><p style="line-height:1.6;color:#d4d4d8">${copy.body}</p><p style="margin:30px 0"><a href="${copy.actionUrl}" style="display:inline-block;padding:13px 20px;background:#fff;color:#000;text-decoration:none;font-weight:700">${copy.action}</a></p><p style="font-size:12px;line-height:1.6;color:#71717a">If the button does not work, copy this link: ${copy.actionUrl}</p></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: copy.subject,
      html,
      text: `${copy.heading}\n\n${copy.body}\n\n${copy.actionUrl}`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Transactional email provider rejected the request (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function issueEmailToken(
  db: Db,
  input: { userId: ObjectId; email: string; purpose: EmailTokenPurpose; requestedIpHash?: string },
) {
  const now = new Date();
  const rawToken = `sme_${crypto.randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(now.getTime() + tokenTtlMinutes(input.purpose) * 60_000);
  await db.collection("email_verification_tokens").updateMany(
    { user_id: input.userId, purpose: input.purpose, used_at: null, invalidated_at: null },
    { $set: { invalidated_at: now, invalidation_reason: "superseded" } },
  );
  const record = await db.collection("email_verification_tokens").insertOne({
    token_hash: hashEmailToken(rawToken),
    user_id: input.userId,
    email: input.email.trim().toLowerCase(),
    purpose: input.purpose,
    requested_ip_hash: input.requestedIpHash,
    created_at: now,
    expires_at: expiresAt,
    used_at: null,
    invalidated_at: null,
  });
  try {
    await sendTransactionalEmail(input.email, input.purpose, emailPath(input.purpose, rawToken));
    await db.collection("email_verification_tokens").updateOne(
      { _id: record.insertedId },
      { $set: { sent_at: new Date() } },
    );
  } catch (error) {
    await db.collection("email_verification_tokens").updateOne(
      { _id: record.insertedId },
      { $set: { invalidated_at: new Date(), invalidation_reason: "delivery_failed" } },
    ).catch(() => {});
    throw error;
  }
  return { expiresAt };
}
