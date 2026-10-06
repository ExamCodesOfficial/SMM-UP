import crypto from "crypto";
import { parse, serialize } from "cookie";
import type { VercelRequest, VercelResponse } from "./http.js";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import {
  clearAuthCookie,
  createUserSession,
  hashPassword,
  hashSessionToken,
  validateNewPassword,
  verifyPassword,
} from "./auth.js";
import { ensureSessionIndexes, getMongoClient } from "./db.js";
import { editTelegramMessage } from "./telegram.js";

const RECOVERY_COOKIE = "smm_up_recovery";

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function temporaryPasswordTtlMinutes() {
  return boundedInteger(process.env.TEMP_PASSWORD_TTL_MINUTES, 180, 15, 24 * 60);
}

export function temporaryPasswordMaxUses(): 1 | 2 {
  return Number.parseInt(String(process.env.TEMP_PASSWORD_MAX_USES || "2"), 10) === 1 ? 1 : 2;
}

export function recoverySessionTtlMinutes() {
  return boundedInteger(process.env.TEMP_PASSWORD_SESSION_TTL_MINUTES, 15, 5, 60);
}

function appendCookie(res: VercelResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const values = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
  res.setHeader("Set-Cookie", [...values, value]);
}

function setRecoveryCookie(res: VercelResponse, raw: string, ttlSeconds: number) {
  appendCookie(res, serialize(RECOVERY_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ttlSeconds,
  }));
}

export function clearRecoveryCookie(res: VercelResponse) {
  appendCookie(res, serialize(RECOVERY_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  }));
}

function recoveryToken(req: VercelRequest): string | null {
  if (!req.headers.cookie) return null;
  return parse(req.headers.cookie)[RECOVERY_COOKIE] || null;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function updateTelegramStatus(temporary: any, usedCount: number, state: "used" | "completed" | "expired") {
  if (!temporary?.telegram_chat_id || !temporary?.telegram_message_id) return false;
  const maxUses = Number(temporary.max_uses || 1);
  const remaining = Math.max(0, maxUses - usedCount);
  const now = new Date();
  const time = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const stateLine = state === "completed"
    ? "✅ Permanent password created · Temporary credential invalidated"
    : state === "expired"
      ? `⌛ Expired after ${usedCount}/${maxUses} uses`
      : `✅ Used ${usedCount}/${maxUses} · ${remaining} use${remaining === 1 ? "" : "s"} remaining · ${time} IST`;
  const text = [
    "🔐 <b>Temporary Password Reset</b>",
    "",
    `User: <code>@${escapeHtml(temporary.username)}</code>`,
    `Email: <code>${escapeHtml(temporary.user_email)}</code>`,
    "Temporary password: <i>hidden after initial creation</i>",
    `Expires: <code>${new Date(temporary.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>`,
    `Uses: <code>${usedCount}/${maxUses}</code>`,
    `Status: ${stateLine}`,
    `Reason: ${escapeHtml(temporary.reason || "Owner recovery")}`,
  ].join("\n");
  return editTelegramMessage(temporary.telegram_chat_id, temporary.telegram_message_id, text, "HTML");
}

async function syncTelegramStatus(
  db: Db,
  temporary: any,
  usedCount: number,
  state: "used" | "completed" | "expired",
) {
  try {
    const edited = await updateTelegramStatus(temporary, usedCount, state);
    await db.collection("temporary_passwords").updateOne(
      { _id: temporary._id },
      {
        $set: {
          telegram_status_state: state,
          telegram_status_synced: edited,
          telegram_status_updated_at: new Date(),
          ...(edited ? {} : { telegram_status_retry_required: true }),
        },
        ...(edited ? { $unset: { telegram_status_retry_required: "" } } : {}),
      },
    );
  } catch {
    await db.collection("temporary_passwords").updateOne(
      { _id: temporary._id },
      { $set: { telegram_status_synced: false, telegram_status_retry_required: true } },
    ).catch(() => {});
  }
}

export async function tryTemporaryPasswordLogin(
  db: Db,
  req: VercelRequest,
  res: VercelResponse,
  user: any,
  suppliedPassword: string,
): Promise<{ accepted: boolean; expiresAt?: Date; usesRemaining?: number }> {
  await ensureSessionIndexes();
  if (user.email_verification_required === true && !user.email_verified_at) {
    return { accepted: false };
  }
  const now = new Date();
  const temporary: any = await db.collection("temporary_passwords").findOne({
    user_id: user._id,
    invalidated_at: null,
    status: "active",
    expires_at: { $gt: now },
    $expr: { $lt: ["$used_count", "$max_uses"] },
  }, { sort: { created_at: -1 } });
  if (!temporary || !(await verifyPassword(suppliedPassword, temporary.password_hash))) {
    const expired: any = await db.collection("temporary_passwords").findOne({
      user_id: user._id,
      invalidated_at: null,
      status: "active",
      expires_at: { $lte: now },
    }, { sort: { created_at: -1 } });
    if (expired) {
      await db.collection("temporary_passwords").updateOne(
        { _id: expired._id, invalidated_at: null },
        { $set: { status: "expired", invalidated_at: now, invalidation_reason: "expired" } },
      );
      await syncTelegramStatus(db, expired, Number(expired.used_count || 0), "expired");
    }
    return { accepted: false };
  }

  const rawSession = `smr_${crypto.randomBytes(32).toString("base64url")}`;
  const ttlSeconds = recoverySessionTtlMinutes() * 60;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const client = await getMongoClient();
  const mongoSession = client.startSession();
  let used: any = null;

  try {
    await mongoSession.withTransaction(async () => {
      used = await db.collection("temporary_passwords").findOneAndUpdate(
        {
          _id: temporary._id,
          invalidated_at: null,
          status: "active",
          expires_at: { $gt: now },
          used_count: Number(temporary.used_count || 0),
          $expr: { $lt: ["$used_count", "$max_uses"] },
        },
        [
          {
            $set: {
              used_count: { $add: ["$used_count", 1] },
              last_used_at: now,
              usage_events: {
                $concatArrays: [
                  { $ifNull: ["$usage_events", []] },
                  [{ used_at: now }],
                ],
              },
            },
          },
          {
            $set: {
              status: { $cond: [{ $gte: ["$used_count", "$max_uses"] }, "exhausted", "active"] },
              invalidated_at: { $cond: [{ $gte: ["$used_count", "$max_uses"] }, now, null] },
              invalidation_reason: { $cond: [{ $gte: ["$used_count", "$max_uses"] }, "uses_exhausted", null] },
            },
          },
        ],
        { returnDocument: "after", session: mongoSession },
      );
      if (!used) return;

      await db.collection("restricted_sessions").insertOne({
        token_hash: hashSessionToken(rawSession),
        user_id: user._id,
        username: user.username,
        purpose: "password_change",
        temporary_password_id: used._id,
        created_at: now,
        expires_at: expiresAt,
        used_at: null,
        invalidated_at: null,
      }, { session: mongoSession });
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await mongoSession.endSession();
  }
  if (!used) return { accepted: false };
  setRecoveryCookie(res, rawSession, ttlSeconds);
  await syncTelegramStatus(db, used, Number(used.used_count), "used");
  return {
    accepted: true,
    expiresAt,
    usesRemaining: Math.max(0, Number(used.max_uses) - Number(used.used_count)),
  };
}

export async function getRecoveryContext(db: Db, req: VercelRequest) {
  await ensureSessionIndexes();
  const raw = recoveryToken(req);
  if (!raw?.startsWith("smr_")) return null;
  const now = new Date();
  const session: any = await db.collection("restricted_sessions").findOne({
    token_hash: hashSessionToken(raw),
    purpose: "password_change",
    invalidated_at: null,
    expires_at: { $gt: now },
  });
  if (!session) return null;
  const user: any = await db.collection("users").findOne({ _id: session.user_id });
  if (!user) return null;
  return { session, user };
}

export async function completePasswordChange(
  db: Db,
  req: VercelRequest,
  res: VercelResponse,
  password: unknown,
) {
  if (typeof password !== "string") throw new Error("A valid new password is required.");
  const passwordError = validateNewPassword(password);
  if (passwordError) throw new Error(passwordError);
  const context = await getRecoveryContext(db, req);
  if (!context) throw new Error("Recovery session is invalid or expired. Request a new reset from support.");

  const passwordHash = await hashPassword(String(password));
  const now = new Date();
  const client = await getMongoClient();
  const session = client.startSession();
  let temporary: any = null;
  try {
    await session.withTransaction(async () => {
      const activeRecovery: any = await db.collection("restricted_sessions").findOne({
        _id: context.session._id,
        invalidated_at: null,
        expires_at: { $gt: now },
      }, { session });
      if (!activeRecovery) throw new Error("Recovery session is invalid or expired. Request a new reset from support.");

      temporary = await db.collection("temporary_passwords").findOne(
        { _id: activeRecovery.temporary_password_id },
        { session },
      );
      await db.collection("users").updateOne(
        { _id: context.user._id },
        {
          $set: {
            password_hash: passwordHash,
            password_changed_at: now,
            sessions_revoked_before: now,
            updated_at: now,
          },
        },
        { session },
      );
      await db.collection("temporary_passwords").updateMany(
        {
          user_id: context.user._id,
          $or: [
            { _id: activeRecovery.temporary_password_id },
            { invalidated_at: null },
          ],
        },
        {
          $set: {
            status: "completed",
            invalidated_at: now,
            invalidation_reason: "password_changed",
            completed_at: now,
          },
        },
        { session },
      );
      await db.collection("restricted_sessions").updateMany(
        { user_id: context.user._id, invalidated_at: null },
        { $set: { invalidated_at: now, invalidation_reason: "password_changed" } },
        { session },
      );
      const affectedSupportSessions: any[] = await db.collection("sessions").find({
        $or: [{ user_id: context.user._id }, { actor_admin_id: context.user._id }],
        purpose: "admin_impersonation",
        revoked_at: null,
      }, { session }).project({ support_access_code_id: 1 }).toArray();
      await db.collection("sessions").updateMany(
        {
          $or: [{ user_id: context.user._id }, { actor_admin_id: context.user._id }],
          revoked_at: null,
        },
        { $set: { revoked_at: now, revoked_reason: "password_changed" } },
        { session },
      );
      const supportCodeIds = affectedSupportSessions.map((item) => item.support_access_code_id).filter(Boolean);
      if (supportCodeIds.length) {
        await db.collection("support_access_codes").updateMany(
          { _id: { $in: supportCodeIds } },
          {
            $set: {
              support_session_status: "revoked",
              support_session_ended_at: now,
              telegram_status_retry_required: true,
            },
          },
          { session },
        );
      }
      await db.collection("security_events").insertOne({
        user_id: context.user._id,
        type: "password_recovery_completed",
        temporary_password_id: activeRecovery.temporary_password_id,
        created_at: now,
      }, { session });
    });
  } finally {
    await session.endSession();
  }

  let sessionCreated = true;
  try {
    await createUserSession(db, req, res, {
      ...context.user,
      password_hash: passwordHash,
    });
  } catch (error) {
    sessionCreated = false;
    clearAuthCookie(res);
    console.error("Password changed but normal session creation failed:", error);
  }
  clearRecoveryCookie(res);
  if (temporary) {
    await syncTelegramStatus(db, temporary, Number(temporary.used_count || 0), "completed");
  }
  return { user: context.user, sessionCreated };
}
