import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { ensureApiKeyIndexes, getDb, getMongoClient } from "../../server/lib/db.js";
import {
  API_KEY_SCOPES,
  ApiKeyError,
  apiKeyCreationFeeInr,
  archiveApiKey,
  createApiKey,
  maxApiKeysPerUser,
  migrateLegacyApiKey,
  rotateApiKey,
  serializeApiKey,
  setApiKeyPaused,
  updateApiKey,
} from "../../server/lib/apiKeys.js";
import {
  hashPassword,
  verifyPassword,
  createUserSession,
  exchangeSupportAccessCode,
  clearAuthCookie,
  clearSupportCookie,
  denySupportMutation,
  getUserFromRequest,
  revokeSessionFromRequest,
  validateNewPassword,
} from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  completePasswordChange,
  getRecoveryContext,
  tryTemporaryPasswordLogin,
} from "../../server/lib/recovery.js";
import { sanitizeBrandText } from "../../server/lib/sanitize.js";
import { editTelegramMessage } from "../../server/lib/telegram.js";
import { hashEmailToken, issueEmailToken } from "../../server/lib/email.js";

function apiKeyError(res: VercelResponse, error: any) {
  if (error instanceof ApiKeyError) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: "That API-key request conflicts with an existing record." });
  }
  console.error("API key management error:", error);
  return res.status(500).json({ error: "API key operation failed." });
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket.remoteAddress || "global")
    .split(",")[0]
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "");
  const db = await getDb();
  const users = db.collection("users");

  // ── 1. REGISTER (API keys are created separately and charged) ──
  if (action === "register") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const existingAuth = await getUserFromRequest(req, db);
    if (denySupportMutation(existingAuth, res, false)) return;
    const registrationRate = await checkRateLimit(`register_${clientIp(req)}`, 5, 3600, db);
    if (!registrationRate.allowed) {
      return res.status(429).json({ error: `Too many registration attempts. Try again in ${registrationRate.remainingSec}s.` });
    }
    const { username, email, password } = req.body || {};
    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "All fields are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = sanitizeBrandText(username.trim()).slice(0, 40);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 320) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (cleanUsername.length < 3 || /[\u0000-\u001F\u007F]/.test(cleanUsername)) {
      return res.status(400).json({ error: "Username must be at least 3 valid characters." });
    }
    const passwordError = validateNewPassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    try {
      const [existingEmail, existingUsername] = await Promise.all([
        users.findOne({ email: cleanEmail }),
        users.findOne(
          { username: cleanUsername },
          { collation: { locale: "en", strength: 2 } },
        ),
      ]);
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });
      if (existingUsername) return res.status(400).json({ error: "Username already taken. Please choose a different one." });

      const passwordHash = await hashPassword(password);
      const now = new Date();
      const newUser: any = {
        username: cleanUsername,
        email: cleanEmail,
        password_hash: passwordHash,
        balance: 0.0,
        total_spent: 0.0,
        total_orders: 0,
        role: "user",
        api_key_count: 0,
        email_verification_required: true,
        email_verified_at: null,
        created_at: now,
        updated_at: now,
      };

      const insertResult = await users.insertOne(newUser);
      try {
        await issueEmailToken(db, {
          userId: insertResult.insertedId,
          email: cleanEmail,
          purpose: "registration",
        });
      } catch (deliveryError) {
        console.error("Registration verification delivery failed:", deliveryError);
        return res.status(503).json({
          error: "Your account was reserved, but the verification email could not be sent. Use Resend verification shortly.",
          verificationRequired: true,
        });
      }
      return res.status(201).json({
        success: true,
        verificationRequired: true,
        message: "Check your email and verify your address before signing in.",
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        const field = err?.keyPattern?.username
          ? "Username already taken. Please choose a different one."
          : "Email already registered";
        return res.status(400).json({ error: field });
      }
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  // ── EMAIL VERIFICATION, RECOVERY, AND EMAIL CHANGE ───────────
  if (action === "resend-verification") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const cleanEmail = String(req.body?.email || "").trim().toLowerCase();
    const rate = await checkRateLimit(`resend_verification_${clientIp(req)}_${cleanEmail}`, 3, 3600, db);
    if (!rate.allowed) return res.status(429).json({ error: `Please wait ${rate.remainingSec}s before trying again.` });
    const user: any = cleanEmail ? await users.findOne({ email: cleanEmail }) : null;
    if (user?.email_verification_required === true && !user.email_verified_at) {
      try {
        await issueEmailToken(db, { userId: user._id, email: user.email, purpose: "registration" });
      } catch (error) {
        console.error("Verification resend failed:", error);
      }
    }
    return res.status(200).json({ success: true, message: "If that account needs verification, a new email has been sent." });
  }

  if (action === "verify-email") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rawToken = String(req.body?.token || "").trim();
    if (!rawToken.startsWith("sme_") || rawToken.length > 200) {
      return res.status(400).json({ error: "Verification link is invalid or expired." });
    }
    const client = await getMongoClient();
    const session = client.startSession();
    let verifiedUser: any = null;
    let purpose = "";
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const token: any = await db.collection("email_verification_tokens").findOne({
          token_hash: hashEmailToken(rawToken),
          purpose: { $in: ["registration", "email_change"] },
          used_at: null,
          invalidated_at: null,
          expires_at: { $gt: now },
        }, { session });
        if (!token) throw new Error("EMAIL_TOKEN_INVALID");
        purpose = token.purpose;
        const user: any = await users.findOne({ _id: token.user_id }, { session });
        if (!user) throw new Error("EMAIL_TOKEN_INVALID");

        if (token.purpose === "registration") {
          if (String(user.email).toLowerCase() !== String(token.email).toLowerCase()) throw new Error("EMAIL_TOKEN_INVALID");
          await users.updateOne(
            { _id: user._id },
            { $set: { email_verified_at: now, email_verification_required: false, updated_at: now } },
            { session },
          );
          verifiedUser = { ...user, email_verified_at: now, email_verification_required: false };
        } else {
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                email: token.email,
                email_verified_at: now,
                email_verification_required: false,
                email_changed_at: now,
                sessions_revoked_before: now,
                updated_at: now,
              },
            },
            { session },
          );
          await db.collection("sessions").updateMany(
            { $or: [{ user_id: user._id }, { actor_admin_id: user._id }], revoked_at: null },
            { $set: { revoked_at: now, revoked_reason: "email_changed" } },
            { session },
          );
          await db.collection("restricted_sessions").updateMany(
            { user_id: user._id, invalidated_at: null },
            { $set: { invalidated_at: now, invalidation_reason: "email_changed" } },
            { session },
          );
          verifiedUser = { ...user, email: token.email, email_verified_at: now };
        }
        const claimed = await db.collection("email_verification_tokens").updateOne(
          { _id: token._id, used_at: null, invalidated_at: null },
          { $set: { used_at: now } },
          { session },
        );
        if (claimed.modifiedCount !== 1) throw new Error("EMAIL_TOKEN_INVALID");
        await db.collection("security_events").insertOne({
          user_id: token.user_id,
          type: token.purpose === "registration" ? "email_verified" : "email_changed",
          created_at: now,
        }, { session });
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });

      if (purpose === "registration") {
        try {
          await createUserSession(db, req, res, verifiedUser);
          return res.status(200).json({ success: true, signedIn: true, message: "Email verified. Your account is active." });
        } catch (sessionError) {
          console.error("Email verified but session creation failed:", sessionError);
          return res.status(200).json({ success: true, signedIn: false, message: "Email verified. Please sign in." });
        }
      }
      clearAuthCookie(res);
      clearSupportCookie(res);
      return res.status(200).json({ success: true, signedIn: false, message: "Email changed. Sign in again with the new address." });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ error: "That email address is already registered." });
      if (error?.message === "EMAIL_TOKEN_INVALID") return res.status(400).json({ error: "Verification link is invalid, expired, or already used." });
      console.error("Email verification failed:", error);
      return res.status(500).json({ error: "Email verification failed." });
    } finally {
      await session.endSession();
    }
  }

  if (action === "forgot-password") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const cleanEmail = String(req.body?.email || "").trim().toLowerCase();
    const rate = await checkRateLimit(`forgot_password_${clientIp(req)}_${cleanEmail}`, 3, 3600, db);
    if (!rate.allowed) return res.status(429).json({ error: `Please wait ${rate.remainingSec}s before trying again.` });
    const user: any = cleanEmail ? await users.findOne({ email: cleanEmail }) : null;
    if (user?.password_hash && user.account_locked !== true) {
      try {
        await issueEmailToken(db, { userId: user._id, email: user.email, purpose: "password_reset" });
        await db.collection("security_events").insertOne({ user_id: user._id, type: "password_reset_email_requested", created_at: new Date() });
      } catch (error) {
        console.error("Password-reset delivery failed:", error);
      }
    }
    return res.status(200).json({ success: true, message: "If that account can be recovered, a reset email has been sent." });
  }

  if (action === "reset-password-email") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const rawToken = String(req.body?.token || "").trim();
    const password = req.body?.password;
    const passwordError = validateNewPassword(password);
    if (!rawToken.startsWith("sme_") || rawToken.length > 200 || passwordError) {
      return res.status(400).json({ error: passwordError || "Reset link is invalid or expired." });
    }
    const passwordHash = await hashPassword(password);
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const token: any = await db.collection("email_verification_tokens").findOne({
          token_hash: hashEmailToken(rawToken), purpose: "password_reset",
          used_at: null, invalidated_at: null, expires_at: { $gt: now },
        }, { session });
        if (!token) throw new Error("EMAIL_TOKEN_INVALID");
        const updated = await users.updateOne(
          { _id: token.user_id, email: token.email, account_locked: { $ne: true } },
          {
            $set: {
              password_hash: passwordHash,
              password_changed_at: now,
              email_verified_at: now,
              email_verification_required: false,
              sessions_revoked_before: now,
              updated_at: now,
            },
          },
          { session },
        );
        if (updated.modifiedCount !== 1) throw new Error("EMAIL_TOKEN_INVALID");
        const claimed = await db.collection("email_verification_tokens").updateOne(
          { _id: token._id, used_at: null }, { $set: { used_at: now } }, { session },
        );
        if (claimed.modifiedCount !== 1) throw new Error("EMAIL_TOKEN_INVALID");
        await db.collection("sessions").updateMany(
          { $or: [{ user_id: token.user_id }, { actor_admin_id: token.user_id }], revoked_at: null },
          { $set: { revoked_at: now, revoked_reason: "email_password_reset" } },
          { session },
        );
        await db.collection("restricted_sessions").updateMany(
          { user_id: token.user_id, invalidated_at: null },
          { $set: { invalidated_at: now, invalidation_reason: "email_password_reset" } },
          { session },
        );
        await db.collection("temporary_passwords").updateMany(
          { user_id: token.user_id, invalidated_at: null },
          { $set: { status: "completed", invalidated_at: now, invalidation_reason: "email_password_reset" } },
          { session },
        );
        await db.collection("security_events").insertOne({
          user_id: token.user_id, type: "password_reset_by_verified_email", created_at: now,
        }, { session });
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      clearAuthCookie(res);
      clearSupportCookie(res);
      return res.status(200).json({ success: true, message: "Password reset complete. Sign in with your new password." });
    } catch (error: any) {
      if (error?.message === "EMAIL_TOKEN_INVALID") return res.status(400).json({ error: "Reset link is invalid, expired, or already used." });
      console.error("Email password reset failed:", error);
      return res.status(500).json({ error: "Password reset failed." });
    } finally {
      await session.endSession();
    }
  }

  if (action === "request-email-change") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const authUser = await getUserFromRequest(req, db);
    if (!authUser || authUser.purpose !== "normal") return res.status(401).json({ error: "Sign in again to change your email." });
    const rate = await checkRateLimit(`email_change_${authUser.userId}_${clientIp(req)}`, 3, 3600, db);
    if (!rate.allowed) return res.status(429).json({ error: `Please wait ${rate.remainingSec}s before trying again.` });
    const newEmail = String(req.body?.newEmail || "").trim().toLowerCase();
    const currentPassword = String(req.body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 320) {
      return res.status(400).json({ error: "Enter a valid new email address." });
    }
    const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return res.status(403).json({ error: "Current password is incorrect." });
    }
    if (newEmail === String(user.email).toLowerCase()) return res.status(400).json({ error: "Enter a different email address." });
    if (await users.findOne({ email: newEmail })) return res.status(409).json({ error: "That email address is already registered." });
    try {
      await issueEmailToken(db, { userId: user._id, email: newEmail, purpose: "email_change" });
      await db.collection("security_events").insertOne({ user_id: user._id, type: "email_change_requested", created_at: new Date() });
      return res.status(200).json({ success: true, message: "A confirmation link was sent to the new email address." });
    } catch (error) {
      console.error("Email-change delivery failed:", error);
      return res.status(503).json({ error: "The confirmation email could not be sent. Your current email was not changed." });
    }
  }

  // ── 2. LOGIN ─────────────────────────────────────────────────
  if (action === "login") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const existingAuth = await getUserFromRequest(req, db);
    if (denySupportMutation(existingAuth, res, false)) return;
    const ip = clientIp(req);
    const { allowed, remainingSec } = await checkRateLimit(`login_${ip}`, 10, 300, db);
    if (!allowed) return res.status(429).json({ error: `Too many login attempts. Try again in ${remainingSec}s.` });

    const { email, identifier, username, password } = req.body || {};
    const rawIdentity = String(identifier || email || username || "").trim();
    const rawPassword = typeof password === "string" ? password : "";
    if (!rawIdentity || !rawPassword) return res.status(400).json({ error: "Username/email and password are required" });
    if (rawIdentity.length > 320 || rawPassword.length > 1024) {
      return res.status(400).json({ error: "Invalid username/email or password." });
    }

    try {
      const identityQuery = rawIdentity.includes("@")
        ? { email: rawIdentity.toLowerCase() }
        : { $or: [{ email: rawIdentity.toLowerCase() }, { username: rawIdentity }] };
      const user: any = await users.findOne(identityQuery, {
        collation: { locale: "en", strength: 2 },
      });
      if (!user?.password_hash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (user.account_locked === true) {
        return res.status(403).json({ error: "This account is locked. Contact support." });
      }
      const permanentPasswordValid = await verifyPassword(rawPassword, user.password_hash);
      if (!permanentPasswordValid) {
        // A temporary credential never receives a normal account session.
        clearAuthCookie(res);
        const recovery = await tryTemporaryPasswordLogin(db, req, res, user, rawPassword);
        if (!recovery.accepted) {
          await db.collection("security_events").insertOne({ user_id: user._id, type: "login_failed", created_at: new Date() });
          return res.status(401).json({ error: "Invalid email or password" });
        }
        return res.status(200).json({
          success: true,
          requiresPasswordChange: true,
          recoveryExpiresAt: recovery.expiresAt,
          temporaryUsesRemaining: recovery.usesRemaining,
          user: {
            userId: user._id.toString(),
            username: user.username,
            email: user.email,
          },
        });
      }
      if (user.email_verification_required === true && !user.email_verified_at) {
        return res.status(403).json({
          error: "Verify your email address before signing in.",
          verificationRequired: true,
          email: user.email,
        });
      }

      await ensureApiKeyIndexes();
      await migrateLegacyApiKey(db, user);
      const apiKeyCount = await db.collection("api_keys").countDocuments({
        user_id: user._id,
        status: { $ne: "archived" },
      });

      await createUserSession(db, req, res, user);
      await db.collection("security_events").insertOne({ user_id: user._id, type: "login_succeeded", created_at: new Date() });
      return res.status(200).json({
        success: true,
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          balance: user.balance || 0.0,
          role: user.role || "user",
          hasApiKey: apiKeyCount > 0,
          apiKeyCount,
          apiKey: null,
          apiKeyMasked: null,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  }

  // ── 3. LOGOUT ────────────────────────────────────────────────
  if (action === "logout") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    await revokeSessionFromRequest(req, db, "logout");
    clearAuthCookie(res);
    clearSupportCookie(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  }

  // ── 4. OWNER SUPPORT ACCESS EXCHANGE / EXIT ─────────────────
  if (action === "exchange-support-access") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const actorAuth = await getUserFromRequest(req, db);
    if (!actorAuth || actorAuth.purpose !== "normal" || actorAuth.role !== "admin") {
      return res.status(403).json({ error: "A normal owner session is required." });
    }
    const actor: any = await users.findOne({ _id: new ObjectId(actorAuth.userId), role: "admin" });
    if (!actor) return res.status(403).json({ error: "Owner account not found." });
    const exchangeRate = await checkRateLimit(`support_exchange_${actorAuth.userId}_${clientIp(req)}`, 10, 300, db);
    if (!exchangeRate.allowed) {
      return res.status(429).json({ error: `Too many Support Access attempts. Try again in ${exchangeRate.remainingSec}s.` });
    }
    try {
      const exchanged = await exchangeSupportAccessCode(db, req, res, actor, req.body?.code);
      const supportCode: any = exchanged.supportCode;
      if (supportCode.telegram_chat_id && supportCode.telegram_message_id) {
        const edited = await editTelegramMessage(
          supportCode.telegram_chat_id,
          supportCode.telegram_message_id,
          [
            "✅ <b>Support Access Code Used</b>",
            "",
            `User: <code>@${String(exchanged.subjectUser.username || "user").replace(/[<>&]/g, "")}</code>`,
            `Email: <code>${String(exchanged.subjectUser.email || "").replace(/[<>&]/g, "")}</code>`,
            "Code: <i>consumed and hidden</i>",
            `Session expires: <code>${exchanged.expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>`,
            "Permissions: <b>Read-only</b>",
            `Reason: ${String(supportCode.reason || "Owner support").replace(/[<>&]/g, "")}`,
          ].join("\n"),
          "HTML",
        );
        await db.collection("support_access_codes").updateOne(
          { _id: supportCode._id },
          {
            $set: {
              telegram_status_synced: edited,
              telegram_status_updated_at: new Date(),
              ...(edited ? {} : { telegram_status_retry_required: true }),
            },
            ...(edited ? { $unset: { telegram_status_retry_required: "" } } : {}),
          },
        );
      }
      return res.status(200).json({
        success: true,
        subject: {
          userId: exchanged.subjectUser._id.toString(),
          username: exchanged.subjectUser.username,
          email: exchanged.subjectUser.email,
        },
        readOnly: true,
        expiresAt: exchanged.expiresAt,
      });
    } catch (error: any) {
      console.warn("Support Access exchange rejected:", error?.message || error);
      return res.status(400).json({ error: "Support Access code is invalid, expired or already used." });
    }
  }

  if (action === "exit-support-access") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const supportAuth = await getUserFromRequest(req, db);
    if (!supportAuth || supportAuth.purpose !== "admin_impersonation" || !supportAuth.sessionId) {
      clearSupportCookie(res);
      return res.status(200).json({ success: true, message: "No active support session." });
    }
    const now = new Date();
    const sessionId = new ObjectId(supportAuth.sessionId);
    const mongoSession = (await getMongoClient()).startSession();
    try {
      await mongoSession.withTransaction(async () => {
        const supportSession: any = await db.collection("sessions").findOne(
          { _id: sessionId, purpose: "admin_impersonation" },
          { session: mongoSession },
        );
        if (!supportSession) return;
        await db.collection("sessions").updateOne(
          { _id: sessionId, revoked_at: null },
          { $set: { revoked_at: now, revoked_reason: "support_exit" } },
          { session: mongoSession },
        );
        await db.collection("support_access_audit").insertOne({
          session_id: sessionId,
          actor_admin_id: new ObjectId(String(supportAuth.actorAdminId)),
          subject_user_id: new ObjectId(supportAuth.userId),
          event: "exited",
          created_at: now,
        }, { session: mongoSession });
        if (supportSession.support_access_code_id) {
          await db.collection("support_access_codes").updateOne(
            { _id: supportSession.support_access_code_id },
            {
              $set: {
                support_session_status: "exited",
                support_session_ended_at: now,
                telegram_status_retry_required: true,
              },
            },
            { session: mongoSession },
          );
        }
      });
    } finally {
      await mongoSession.endSession();
    }
    clearSupportCookie(res);
    return res.status(200).json({ success: true, message: "Support session ended." });
  }

  if (action === "support-page-view") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const supportAuth = await getUserFromRequest(req, db);
    if (!supportAuth || supportAuth.purpose !== "admin_impersonation" || !supportAuth.sessionId) {
      return res.status(403).json({ error: "No active Support Access session." });
    }
    const route = String(req.body?.path || "/").split("?")[0].slice(0, 300);
    if (!route.startsWith("/") || route.startsWith("//")) {
      return res.status(400).json({ error: "Invalid page path." });
    }
    await db.collection("support_access_audit").insertOne({
      session_id: new ObjectId(supportAuth.sessionId),
      actor_admin_id: new ObjectId(String(supportAuth.actorAdminId)),
      subject_user_id: new ObjectId(supportAuth.userId),
      event: "page_view",
      path: route,
      created_at: new Date(),
    });
    return res.status(204).end();
  }

  // ── 5. ME ────────────────────────────────────────────────────
  if (action === "me") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const authUser = await getUserFromRequest(req, db);
    if (!authUser) return res.status(401).json({ authenticated: false });
    try {
      const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
      if (!user) return res.status(401).json({ authenticated: false });
      await ensureApiKeyIndexes();
      if (authUser.purpose !== "admin_impersonation") await migrateLegacyApiKey(db, user);
      const dedicatedApiKeyCount = await db.collection("api_keys").countDocuments({
        user_id: user._id,
        status: { $ne: "archived" },
      });
      const apiKeyCount = dedicatedApiKeyCount || (user.api_key || user.api_key_hash ? 1 : 0);
      return res.status(200).json({
        authenticated: true,
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          emailVerified: user.email_verification_required !== true || Boolean(user.email_verified_at),
          balance: user.balance || 0.0,
          total_spent: user.total_spent || 0.0,
          total_orders: user.total_orders || 0,
          role: user.role || "user",
          hasApiKey: apiKeyCount > 0,
          apiKeyCount,
          apiKey: null,
          apiKeyMasked: null,
          supportSession: authUser.purpose === "admin_impersonation" ? {
            active: true,
            readOnly: true,
            actorAdminId: authUser.actorAdminId,
            subjectUserId: authUser.userId,
            expiresAt: authUser.sessionExpiresAt,
          } : null,
        },
      });
    } catch (error) {
      console.error("Account fetch error:", error);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // ── 5. RESTRICTED TEMPORARY-PASSWORD COMPLETION ─────────────
  if (action === "recovery-status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const context = await getRecoveryContext(db, req);
    if (!context) return res.status(401).json({ active: false, error: "Recovery session is invalid or expired." });
    return res.status(200).json({
      active: true,
      username: context.user.username,
      email: context.user.email,
      expiresAt: context.session.expires_at,
      purpose: "password_change",
    });
  }

  if (action === "complete-password-change") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const existingAuth = await getUserFromRequest(req, db);
    if (denySupportMutation(existingAuth, res, false)) return;
    try {
      const user: any = await completePasswordChange(db, req, res, req.body?.password);
      return res.status(200).json({
        success: true,
        message: "Permanent password created. The temporary password is now invalid.",
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          balance: user.balance || 0,
          total_spent: user.total_spent || 0,
          total_orders: user.total_orders || 0,
          role: user.role || "user",
        },
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Password change failed." });
    }
  }

  // ── Authenticated multi-key management ──────────────────────
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
  if (denySupportMutation(authUser, res, req.method === "GET")) return;
  const userId = new ObjectId(authUser.userId);
  const rate = await checkRateLimit(`keymgmt_${authUser.userId}_${clientIp(req)}`, 60, 600, db);
  if (!rate.allowed) return res.status(429).json({ error: `Too many requests. Try again in ${rate.remainingSec}s.` });

  try {
    await ensureApiKeyIndexes();
    if (authUser.purpose !== "admin_impersonation") await migrateLegacyApiKey(db, userId);

    if (action === "list-sessions") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const sessions = await db.collection("sessions")
        .find({ user_id: userId, revoked_at: null, expires_at: { $gt: new Date() } })
        .sort({ last_activity_at: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json({
        sessions: sessions.map((session: any) => ({
          id: session._id.toString(),
          current: authUser.sessionId === session._id.toString(),
          purpose: session.purpose || "normal",
          createdAt: session.created_at,
          lastActivityAt: session.last_activity_at,
          expiresAt: session.expires_at,
          device: {
            userAgent: session.device?.user_agent || "Unknown device",
            platform: session.device?.platform || null,
            mobile: Boolean(session.device?.mobile_hint),
          },
        })),
        legacyCurrentSession: Boolean(authUser.legacyJwt),
      });
    }

    if (action === "revoke-session") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const sessionId = String(req.body?.sessionId || "");
      if (!ObjectId.isValid(sessionId)) return res.status(400).json({ error: "Invalid session ID." });
      const result = await db.collection("sessions").updateOne(
        { _id: new ObjectId(sessionId), user_id: userId, revoked_at: null },
        { $set: { revoked_at: new Date(), revoked_reason: "user_revoked" } },
      );
      if (result.matchedCount !== 1) return res.status(404).json({ error: "Active session not found." });
      const revokedCurrent = authUser.sessionId === sessionId;
      if (revokedCurrent) clearAuthCookie(res);
      return res.status(200).json({ success: true, revokedCurrent });
    }

    if (action === "revoke-other-sessions") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const now = new Date();
      const query: any = { user_id: userId, revoked_at: null };
      if (authUser.sessionId && ObjectId.isValid(authUser.sessionId)) {
        query._id = { $ne: new ObjectId(authUser.sessionId) };
      }
      const result = await db.collection("sessions").updateMany(
        query,
        { $set: { revoked_at: now, revoked_reason: "user_revoked_other_sessions" } },
      );
      await users.updateOne(
        { _id: userId },
        { $set: { legacy_sessions_revoked_before: now, updated_at: now } },
      );
      return res.status(200).json({ success: true, revokedCount: result.modifiedCount });
    }

    if (action === "list-api-keys") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const [currentKeys, archivedKeys, user] = await Promise.all([
        db.collection("api_keys")
          .find({ user_id: userId, status: { $ne: "archived" } })
          .sort({ created_at: -1 })
          .limit(maxApiKeysPerUser())
          .toArray(),
        db.collection("api_keys")
          .find({ user_id: userId, status: "archived" })
          .sort({ archived_at: -1 })
          .limit(90)
          .toArray(),
        users.findOne({ _id: userId }, { projection: { balance: 1 } }),
      ]);
      return res.status(200).json({
        keys: [...currentKeys, ...archivedKeys].map(serializeApiKey),
        scopes: [...API_KEY_SCOPES],
        creationFeeInr: apiKeyCreationFeeInr(),
        maxKeys: maxApiKeysPerUser(),
        balance: Number(user?.balance || 0),
      });
    }

    if (action === "create-api-key") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const created = await createApiKey(db, userId, req.body || {});
      return res.status(created.created ? 201 : 200).json({
        success: true,
        created: created.created,
        key: serializeApiKey(created.key),
        apiKey: created.raw,
        balance: created.balance,
        message: created.created
          ? "API key created. Copy the secret now; it will never be shown again."
          : "This request was already completed. The secret cannot be shown again.",
      });
    }

    if (action === "update-api-key") {
      if (req.method !== "POST" && req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
      const key = await updateApiKey(db, userId, req.body?.keyId, req.body || {});
      return res.status(200).json({ success: true, key: serializeApiKey(key) });
    }

    if (action === "pause-api-key" || action === "resume-api-key") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const key = await setApiKeyPaused(db, userId, req.body?.keyId, action === "pause-api-key");
      return res.status(200).json({ success: true, key: serializeApiKey(key) });
    }

    if (action === "rotate-api-key") {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: "Confirmation is required. The old secret will stop working permanently." });
      }
      const rotated = await rotateApiKey(db, userId, req.body?.keyId);
      return res.status(200).json({
        success: true,
        key: serializeApiKey(rotated.key),
        apiKey: rotated.raw,
        message: "Secret rotated. Copy the new secret now; the old secret cannot be restored.",
      });
    }

    if (action === "archive-api-key") {
      if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
      const key = await archiveApiKey(db, userId, req.body?.keyId, req.body?.confirmationName);
      return res.status(200).json({
        success: true,
        key: serializeApiKey(key),
        message: "API key permanently archived. Historical attribution is retained and no fee is refunded.",
      });
    }

    if (action === "api-key-activity") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const keyId = String(req.query.keyId || "");
      const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || "30"), 10) || 30));
      const query: any = { user_id: userId };
      if (keyId) {
        if (!ObjectId.isValid(keyId)) return res.status(400).json({ error: "Invalid API key ID." });
        query.api_key_id = new ObjectId(keyId);
      }
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        return res.status(400).json({ error: "Invalid activity date filter." });
      }
      if (from || to) {
        query.completed_at = {};
        if (from) query.completed_at.$gte = from;
        if (to) query.completed_at.$lte = to;
      }
      if (req.query.actionFilter) query.action = String(req.query.actionFilter);
      if (req.query.result) query.result = String(req.query.result);
      if (req.query.serviceId) {
        const rawService = String(req.query.serviceId);
        query.service_id = Number.isFinite(Number(rawService)) ? Number(rawService) : rawService;
      }
      if (req.query.orderId) {
        const orderId = String(req.query.orderId);
        if (!ObjectId.isValid(orderId)) return res.status(400).json({ error: "Invalid order ID filter." });
        query.order_id = new ObjectId(orderId);
      }
      const minAmount = req.query.minAmount === undefined ? null : Number(req.query.minAmount);
      const maxAmount = req.query.maxAmount === undefined ? null : Number(req.query.maxAmount);
      if ((minAmount !== null && !Number.isFinite(minAmount)) || (maxAmount !== null && !Number.isFinite(maxAmount))) {
        return res.status(400).json({ error: "Invalid amount filter." });
      }
      if (minAmount !== null || maxAmount !== null) {
        query.gross_charge_inr = {};
        if (minAmount !== null) query.gross_charge_inr.$gte = minAmount;
        if (maxAmount !== null) query.gross_charge_inr.$lte = maxAmount;
      }
      if (req.query.outcome === "success") query.http_status = { $lt: 400 };
      if (req.query.outcome === "error") query.http_status = { $gte: 400 };

      const activity = await db.collection("api_key_activity")
        .find(query, { projection: { ip_hash: 0 } })
        .sort({ completed_at: -1 })
        .limit(limit)
        .toArray();
      return res.status(200).json({
        retentionDays: 90,
        activity: activity.map((item: any) => ({
          id: item._id.toString(),
          keyId: item.api_key_id.toString(),
          keyVersion: item.api_key_version,
          action: item.action,
          scope: item.scope,
          httpStatus: item.http_status,
          result: item.result,
          requestId: item.request_id,
          orderId: item.order_id?.toString?.() || item.order_id || null,
          orderIds: Array.isArray(item.order_ids)
            ? item.order_ids.map((id: any) => id?.toString?.() || String(id))
            : [],
          serviceId: item.service_id ?? null,
          serviceName: item.service_name ?? null,
          target: item.target ?? null,
          quantity: item.quantity ?? null,
          grossChargeInr: item.gross_charge_inr ?? null,
          refundInr: item.refund_inr ?? 0,
          netChargeInr: item.net_charge_inr ?? null,
          startedAt: item.started_at,
          completedAt: item.completed_at,
          durationMs: item.duration_ms,
        })),
      });
    }

    if (action === "api-key-report") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      const keyId = String(req.query.keyId || "");
      const keyObjectId = keyId && ObjectId.isValid(keyId) ? new ObjectId(keyId) : null;
      if (keyId && !keyObjectId) return res.status(400).json({ error: "Invalid API key ID." });
      if (keyObjectId) {
        const owned = await db.collection("api_keys").findOne({ _id: keyObjectId, user_id: userId });
        if (!owned) return res.status(404).json({ error: "API key not found." });
      }

      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        return res.status(400).json({ error: "Invalid report date filter." });
      }
      const orderMatch: any = { user_id: userId, api_key_id: { $type: "objectId" } };
      const activityMatch: any = { user_id: userId };
      if (keyObjectId) {
        orderMatch.api_key_id = keyObjectId;
        activityMatch.api_key_id = keyObjectId;
      }
      if (from || to) {
        orderMatch.created_at = {};
        activityMatch.completed_at = {};
        if (from) {
          orderMatch.created_at.$gte = from;
          activityMatch.completed_at.$gte = from;
        }
        if (to) {
          orderMatch.created_at.$lte = to;
          activityMatch.completed_at.$lte = to;
        }
      }
      if (req.query.serviceId) {
        const rawService = String(req.query.serviceId);
        orderMatch.service_id = Number.isFinite(Number(rawService)) ? Number(rawService) : rawService;
      }
      if (req.query.orderId) {
        const orderId = String(req.query.orderId);
        if (!ObjectId.isValid(orderId)) return res.status(400).json({ error: "Invalid order ID filter." });
        orderMatch._id = new ObjectId(orderId);
      }
      const minAmount = req.query.minAmount === undefined ? null : Number(req.query.minAmount);
      const maxAmount = req.query.maxAmount === undefined ? null : Number(req.query.maxAmount);
      if ((minAmount !== null && !Number.isFinite(minAmount)) || (maxAmount !== null && !Number.isFinite(maxAmount))) {
        return res.status(400).json({ error: "Invalid amount filter." });
      }
      if (minAmount !== null || maxAmount !== null) {
        orderMatch.charge = {};
        if (minAmount !== null) orderMatch.charge.$gte = minAmount;
        if (maxAmount !== null) orderMatch.charge.$lte = maxAmount;
      }

      const [keyRecords, orderTotals, requestTotals, recentOrders] = await Promise.all([
        db.collection("api_keys").find({
          user_id: userId,
          ...(keyObjectId ? { _id: keyObjectId } : {}),
        }).sort({ created_at: -1 }).toArray(),
        db.collection("orders").aggregate([
          { $match: orderMatch },
          {
            $group: {
              _id: "$api_key_id",
              orderCount: { $sum: 1 },
              failedOrders: { $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] } },
              refundedOrders: { $sum: { $cond: [{ $eq: ["$refund_status", "refunded"] }, 1, 0] } },
              grossChargeInr: { $sum: { $ifNull: ["$charge", 0] } },
              refundInr: {
                $sum: {
                  $cond: [
                    { $eq: ["$refund_status", "refunded"] },
                    { $ifNull: ["$charge", 0] },
                    0,
                  ],
                },
              },
              firstOrderAt: { $min: "$created_at" },
              lastOrderAt: { $max: "$created_at" },
            },
          },
        ]).toArray(),
        db.collection("api_key_activity").aggregate([
          { $match: activityMatch },
          {
            $group: {
              _id: "$api_key_id",
              requestCount: { $sum: 1 },
              errorCount: { $sum: { $cond: [{ $gte: ["$http_status", 400] }, 1, 0] } },
              averageLatencyMs: { $avg: "$duration_ms" },
              lastRequestAt: { $max: "$completed_at" },
            },
          },
        ]).toArray(),
        db.collection("orders").find(orderMatch, {
          projection: {
            user_email: 0,
            provider_error: 0,
          },
        }).sort({ created_at: -1 }).limit(100).toArray(),
      ]);

      const ordersByKey = new Map(orderTotals.map((item: any) => [item._id.toString(), item]));
      const requestsByKey = new Map(requestTotals.map((item: any) => [item._id.toString(), item]));
      const summaries = keyRecords.map((key: any) => {
        const order = ordersByKey.get(key._id.toString()) as any;
        const request = requestsByKey.get(key._id.toString()) as any;
        const grossChargeInr = Number(order?.grossChargeInr || 0);
        const refundInr = Number(order?.refundInr || 0);
        const requestCount = Number(request?.requestCount || 0);
        const errorCount = Number(request?.errorCount || 0);
        return {
          key: serializeApiKey(key),
          requestCount,
          errorCount,
          errorRate: requestCount > 0 ? errorCount / requestCount : 0,
          averageLatencyMs: Math.round(Number(request?.averageLatencyMs || 0)),
          lastRequestAt: request?.lastRequestAt || key.last_used_at || null,
          orderCount: Number(order?.orderCount || 0),
          failedOrders: Number(order?.failedOrders || 0),
          refundedOrders: Number(order?.refundedOrders || 0),
          grossChargeInr,
          refundInr,
          netChargeInr: grossChargeInr - refundInr,
          firstOrderAt: order?.firstOrderAt || null,
          lastOrderAt: order?.lastOrderAt || null,
        };
      });

      return res.status(200).json({
        detailedActivityRetentionDays: 90,
        summaries,
        orders: recentOrders.map((order: any) => ({
          id: order._id.toString(),
          keyId: order.api_key_id?.toString?.() || null,
          keyVersion: order.api_key_version || null,
          providerOrderId: order.provider_order_id || null,
          serviceId: order.service_id,
          serviceName: order.service_name,
          target: order.link,
          quantity: order.quantity,
          grossChargeInr: Number(order.charge || 0),
          refundInr: order.refund_status === "refunded" ? Number(order.charge || 0) : 0,
          netChargeInr: order.refund_status === "refunded" ? 0 : Number(order.charge || 0),
          status: order.status,
          refundStatus: order.refund_status || null,
          createdAt: order.created_at,
          refundedAt: order.refunded_at || null,
        })),
      });
    }

    // Old single-key endpoints are intentionally retired rather than silently
    // reintroducing insecure plaintext storage or destructive semantics.
    if (["generate-key", "regenerate-key", "reveal-key", "delete-key"].includes(action)) {
      return res.status(410).json({
        error: "The single-key endpoint has been replaced. Refresh Account to manage named API keys.",
        code: "MULTI_KEY_UPGRADE_REQUIRED",
      });
    }
  } catch (error) {
    return apiKeyError(res, error);
  }

  return res.status(404).json({ error: "Auth action not found" });
}
