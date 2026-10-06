import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";
import type { VercelRequest, VercelResponse } from "./http.js";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import { ensureSessionIndexes, getDb, getMongoClient } from "./db.js";

function jwtSecret(): string {
  const secret = String(process.env.JWT_SECRET || "");
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

const COOKIE_NAME = "smm_up_session";
const SUPPORT_COOKIE_NAME = "smm_up_support";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface UserTokenPayload {
  userId: string;
  email: string;
  username: string;
  role: "user" | "admin";
  sessionId?: string;
  purpose?: "normal" | "admin_impersonation";
  actorAdminId?: string | null;
  sessionExpiresAt?: string;
  legacyJwt?: boolean;
  iat?: number;
}

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
}

export function validateNewPassword(value: unknown): string | null {
  const password = String(value || "");
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  const categories = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
    .filter(Boolean).length;
  if (categories < 3) {
    return "Use at least three of: lowercase letters, uppercase letters, numbers and symbols.";
  }
  return null;
}

/** Retained only to validate pre-migration cookies during the session cutover. */
export function signUserToken(user: { _id: ObjectId | string; email: string; username: string; role?: string }): string {
  const payload: UserTokenPayload = {
    userId: user._id.toString(),
    email: user.email.toLowerCase(),
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
  };
  return jwt.sign(payload, jwtSecret(), { expiresIn: "30d" });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as UserTokenPayload;
  } catch {
    return null;
  }
}

export function hashSessionToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function rawTokenFromRequest(req: VercelRequest): string | null {
  if (req.headers.cookie) {
    const cookies = parse(req.headers.cookie);
    if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  }
  const authorization = String(req.headers.authorization || "");
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim() || null;
  return null;
}

function supportTokenFromRequest(req: VercelRequest): string | null {
  if (!req.headers.cookie) return null;
  return parse(req.headers.cookie)[SUPPORT_COOKIE_NAME] || null;
}

function appendCookie(res: VercelResponse, value: string) {
  const existing = res.getHeader("Set-Cookie");
  const values = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
  res.setHeader("Set-Cookie", [...values, value]);
}

function ipPseudonym(req: VercelRequest): string | null {
  const forwarded = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  const secret = process.env.SESSION_METADATA_HASH_SECRET || process.env.JWT_SECRET;
  if (!forwarded || !secret) return null;
  return crypto.createHmac("sha256", secret).update(forwarded).digest("hex");
}

function deviceMetadata(req: VercelRequest) {
  const userAgent = String(req.headers["user-agent"] || "Unknown device").slice(0, 500);
  const platform = String(req.headers["sec-ch-ua-platform"] || "").replace(/^"|"$/g, "").slice(0, 80) || null;
  const mobileHint = String(req.headers["sec-ch-ua-mobile"] || "") === "?1";
  return { user_agent: userAgent, platform, mobile_hint: mobileHint, ip_hash: ipPseudonym(req) };
}

export async function createUserSession(
  db: Db,
  req: VercelRequest,
  res: VercelResponse,
  user: any,
) {
  await ensureSessionIndexes();
  const raw = `sms_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenHash = hashSessionToken(raw);
  const now = new Date();
  const ttlSeconds = SESSION_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const sessionId = new ObjectId();
  const purpose = "normal";

  await db.collection("sessions").insertOne({
    _id: sessionId,
    token_hash: tokenHash,
    user_id: user._id,
    username: user.username,
    purpose,
    actor_admin_id: null,
    subject_user_id: user._id,
    created_at: now,
    last_activity_at: now,
    expires_at: expiresAt,
    revoked_at: null,
    revoked_reason: null,
    device: deviceMetadata(req),
  });

  // Keep the active-session set bounded without affecting audit records already revoked.
  const overflow = await db.collection("sessions")
    .find({ user_id: user._id, purpose: "normal", revoked_at: null })
    .sort({ created_at: -1 })
    .skip(20)
    .project({ _id: 1 })
    .toArray();
  if (overflow.length > 0) {
    await db.collection("sessions").updateMany(
      { _id: { $in: overflow.map((item) => item._id) } },
      { $set: { revoked_at: now, revoked_reason: "active_session_limit" } },
    );
  }

  setAuthCookie(res, raw, ttlSeconds);
  clearSupportCookie(res);
  return { sessionId, expiresAt, purpose };
}

export async function exchangeSupportAccessCode(
  db: Db,
  req: VercelRequest,
  res: VercelResponse,
  actorAdmin: any,
  suppliedCode: unknown,
) {
  if (actorAdmin?.role !== "admin") throw new Error("Owner authentication is required.");
  await ensureSessionIndexes();
  const code = String(suppliedCode || "").trim().toUpperCase();
  if (!/^SUP-(?:[A-Z0-9]{4}-){3}[A-Z0-9]{4}$/.test(code)) throw new Error("Invalid Support Access code.");
  const codeHash = hashSessionToken(code);
  const rawSession = `smi_${crypto.randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60_000);
  const sessionId = new ObjectId();
  const client = await getMongoClient();
  const mongoSession = client.startSession();
  let supportCode: any = null;
  let subjectUser: any = null;

  try {
    await mongoSession.withTransaction(async () => {
      supportCode = await db.collection("support_access_codes").findOneAndUpdate(
        {
          code_hash: codeHash,
          consumed_at: null,
          invalidated_at: null,
          expires_at: { $gt: now },
        },
        {
          $set: {
            consumed_at: now,
            consumed_by_admin_id: actorAdmin._id,
            support_session_id: sessionId,
            support_session_expires_at: expiresAt,
            support_session_status: "active",
          },
        },
        { returnDocument: "after", session: mongoSession },
      );
      if (!supportCode) throw new Error("Support Access code is invalid, expired or already used.");
      subjectUser = await db.collection("users").findOne(
        { _id: supportCode.subject_user_id, account_locked: { $ne: true } },
        { session: mongoSession },
      );
      if (!subjectUser) throw new Error("Support Access subject is unavailable.");

      await db.collection("sessions").insertOne({
        _id: sessionId,
        token_hash: hashSessionToken(rawSession),
        user_id: subjectUser._id,
        username: subjectUser.username,
        purpose: "admin_impersonation",
        actor_admin_id: actorAdmin._id,
        actor_admin_username: actorAdmin.username,
        subject_user_id: subjectUser._id,
        support_access_code_id: supportCode._id,
        reason: String(supportCode.reason || "Owner support").slice(0, 500),
        read_only: true,
        created_at: now,
        last_activity_at: now,
        expires_at: expiresAt,
        revoked_at: null,
        revoked_reason: null,
        device: deviceMetadata(req),
      }, { session: mongoSession });
      await db.collection("support_access_audit").insertOne({
        session_id: sessionId,
        support_access_code_id: supportCode._id,
        actor_admin_id: actorAdmin._id,
        subject_user_id: subjectUser._id,
        event: "exchanged",
        reason: supportCode.reason,
        created_at: now,
      }, { session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }

  appendCookie(res, serialize(SUPPORT_COOKIE_NAME, rawSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60,
  }));
  return { sessionId, expiresAt, subjectUser, supportCode };
}

/**
 * Resolves opaque MongoDB sessions. Signed JWT cookies issued before migration
 * remain temporarily compatible, but a sessions_revoked_before timestamp can
 * revoke all of them immediately during password recovery or account lock.
 */
export async function getUserFromRequest(req: VercelRequest, suppliedDb?: Db): Promise<UserTokenPayload | null> {
  const db = suppliedDb || await getDb();
  const now = new Date();
  await ensureSessionIndexes();

  const resolveOpaque = async (
    raw: string | null,
    expectedPurpose: "normal" | "admin_impersonation",
  ): Promise<UserTokenPayload | null> => {
    const expectedPrefix = expectedPurpose === "admin_impersonation" ? "smi_" : "sms_";
    if (!raw?.startsWith(expectedPrefix)) return null;
    const session: any = await db.collection("sessions").findOne({
      token_hash: hashSessionToken(raw),
      purpose: expectedPurpose,
      revoked_at: null,
      expires_at: { $gt: now },
    });
    if (!session) return null;
    const user: any = await db.collection("users").findOne({ _id: session.subject_user_id || session.user_id });
    if (!user || user.account_locked === true) return null;
    if (user.sessions_revoked_before && new Date(user.sessions_revoked_before) >= new Date(session.created_at)) {
      await db.collection("sessions").updateOne(
        { _id: session._id, revoked_at: null },
        { $set: { revoked_at: now, revoked_reason: "global_revocation" } },
      );
      return null;
    }

    let actorAdminId: string | null = null;
    if (session.purpose === "admin_impersonation") {
      const actor: any = await db.collection("users").findOne({ _id: session.actor_admin_id });
      const actorGloballyRevoked = actor?.sessions_revoked_before
        && new Date(actor.sessions_revoked_before) >= new Date(session.created_at);
      if (!actor || actor.role !== "admin" || actor.account_locked === true || actorGloballyRevoked || session.read_only !== true) {
        await db.collection("sessions").updateOne(
          { _id: session._id },
          { $set: { revoked_at: now, revoked_reason: "invalid_admin_actor" } },
        );
        return null;
      }
      actorAdminId = actor._id.toString();
      await db.collection("support_access_audit").insertOne({
        session_id: session._id,
        actor_admin_id: actor._id,
        subject_user_id: user._id,
        event: "request",
        method: String(req.method || "GET").slice(0, 12),
        path: String(req.url || "/").split("?")[0].slice(0, 300),
        created_at: now,
      });
    }

    const lastActivity = new Date(session.last_activity_at || session.created_at).getTime();
    if (now.getTime() - lastActivity > 60_000) {
      db.collection("sessions").updateOne(
        { _id: session._id, revoked_at: null },
        { $set: { last_activity_at: now } },
      ).catch(() => {});
    }
    return {
      userId: user._id.toString(),
      email: String(user.email || "").toLowerCase(),
      username: user.username,
      role: user.role === "admin" ? "admin" : "user",
      sessionId: session._id.toString(),
      purpose: session.purpose || "normal",
      actorAdminId,
      sessionExpiresAt: new Date(session.expires_at).toISOString(),
    };
  };

  // A stale support cookie must not hide the owner's still-valid normal session.
  const support = await resolveOpaque(supportTokenFromRequest(req), "admin_impersonation");
  if (support) return support;
  const raw = rawTokenFromRequest(req);
  const normal = await resolveOpaque(raw, "normal");
  if (normal) return normal;
  if (!raw || raw.startsWith("sms_") || raw.startsWith("smi_")) return null;

  const legacy = verifyUserToken(raw);
  if (!legacy?.userId || !ObjectId.isValid(legacy.userId)) return null;
  const user: any = await db.collection("users").findOne({ _id: new ObjectId(legacy.userId) });
  if (!user || user.account_locked === true) return null;
  const issuedAtMs = Number(legacy.iat || 0) * 1000;
  const legacyCutoff = user.legacy_sessions_revoked_before || user.sessions_revoked_before;
  if (legacyCutoff && issuedAtMs <= new Date(legacyCutoff).getTime()) return null;
  return {
    userId: user._id.toString(),
    email: String(user.email || "").toLowerCase(),
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
    purpose: "normal",
    legacyJwt: true,
    iat: legacy.iat,
  };
}

export function denySupportMutation(
  user: UserTokenPayload | null,
  res: VercelResponse,
  operationIsReadOnly: boolean,
): boolean {
  if (user?.purpose !== "admin_impersonation" || operationIsReadOnly) return false;
  res.status(403).json({
    error: "Support Access is read-only. Exit the support session to make changes.",
    code: "SUPPORT_READ_ONLY",
  });
  return true;
}

export async function revokeSessionFromRequest(req: VercelRequest, db: Db, reason = "logout") {
  const raws = [supportTokenFromRequest(req), rawTokenFromRequest(req)].filter(Boolean) as string[];
  const hashes = raws
    .filter((raw) => raw.startsWith("sms_") || raw.startsWith("smi_"))
    .map(hashSessionToken);
  const now = new Date();
  if (hashes.length > 0) {
    await db.collection("sessions").updateMany(
      { token_hash: { $in: hashes }, revoked_at: null },
      { $set: { revoked_at: now, revoked_reason: reason } },
    );
  }
  const normalRaw = rawTokenFromRequest(req);
  if (normalRaw && !normalRaw.startsWith("sms_") && !normalRaw.startsWith("smi_")) {
    const legacy = verifyUserToken(normalRaw);
    if (legacy?.userId && ObjectId.isValid(legacy.userId)) {
      await db.collection("users").updateOne(
        { _id: new ObjectId(legacy.userId) },
        { $max: { legacy_sessions_revoked_before: now } },
      );
    }
  }
}

export function setAuthCookie(res: VercelResponse, token: string, maxAge = SESSION_TTL_SECONDS): void {
  const cookieStr = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
  res.setHeader("Set-Cookie", cookieStr);
}

export function clearAuthCookie(res: VercelResponse): void {
  const cookieStr = serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  res.setHeader("Set-Cookie", cookieStr);
}

export function clearSupportCookie(res: VercelResponse): void {
  appendCookie(res, serialize(SUPPORT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  }));
}
