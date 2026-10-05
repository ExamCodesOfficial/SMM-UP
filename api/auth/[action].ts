import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { ensureApiKeyIndexes, getDb } from "../../server/lib/db.js";
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
  signUserToken,
  setAuthCookie,
  clearAuthCookie,
  getUserFromRequest,
} from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { sanitizeBrandText } from "../../server/lib/smm.js";

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
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: "All fields are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = sanitizeBrandText(String(username).trim()).slice(0, 40);
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

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
        created_at: now,
        updated_at: now,
      };

      const insertResult = await users.insertOne(newUser);
      const token = signUserToken({
        _id: insertResult.insertedId,
        email: cleanEmail,
        username: cleanUsername,
        role: newUser.role,
      });
      setAuthCookie(res, token);
      return res.status(201).json({
        success: true,
        user: {
          userId: insertResult.insertedId.toString(),
          username: cleanUsername,
          email: cleanEmail,
          balance: 0.0,
          role: newUser.role,
          hasApiKey: false,
          apiKeyCount: 0,
          apiKey: null,
          apiKeyMasked: null,
        },
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

  // ── 2. LOGIN ─────────────────────────────────────────────────
  if (action === "login") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const ip = clientIp(req);
    const { allowed, remainingSec } = checkRateLimit(`login_${ip}`, 10, 300);
    if (!allowed) return res.status(429).json({ error: `Too many login attempts. Try again in ${remainingSec}s.` });

    const { email, identifier, username, password } = req.body || {};
    const rawIdentity = String(identifier || email || username || "").trim();
    if (!rawIdentity || !password) return res.status(400).json({ error: "Username/email and password are required" });

    try {
      const identityQuery = rawIdentity.includes("@")
        ? { email: rawIdentity.toLowerCase() }
        : { $or: [{ email: rawIdentity.toLowerCase() }, { username: rawIdentity }] };
      const user: any = await users.findOne(identityQuery, {
        collation: { locale: "en", strength: 2 },
      });
      if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await ensureApiKeyIndexes();
      await migrateLegacyApiKey(db, user);
      const apiKeyCount = await db.collection("api_keys").countDocuments({
        user_id: user._id,
        status: { $ne: "archived" },
      });

      const token = signUserToken({
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      });
      setAuthCookie(res, token);
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
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  }

  // ── 4. ME ────────────────────────────────────────────────────
  if (action === "me") {
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ authenticated: false });
    try {
      const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
      if (!user) return res.status(401).json({ authenticated: false });
      await ensureApiKeyIndexes();
      await migrateLegacyApiKey(db, user);
      const apiKeyCount = await db.collection("api_keys").countDocuments({
        user_id: user._id,
        status: { $ne: "archived" },
      });
      return res.status(200).json({
        authenticated: true,
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          balance: user.balance || 0.0,
          total_spent: user.total_spent || 0.0,
          total_orders: user.total_orders || 0,
          role: user.role || "user",
          hasApiKey: apiKeyCount > 0,
          apiKeyCount,
          apiKey: null,
          apiKeyMasked: null,
        },
      });
    } catch (error) {
      console.error("Account fetch error:", error);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // ── Authenticated multi-key management ──────────────────────
  const authUser = getUserFromRequest(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
  const userId = new ObjectId(authUser.userId);
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const rate = checkRateLimit(`keymgmt_${authUser.userId}_${clientIp(req)}`, 60, 600);
  if (!rate.allowed) return res.status(429).json({ error: `Too many requests. Try again in ${rate.remainingSec}s.` });

  try {
    await ensureApiKeyIndexes();
    await migrateLegacyApiKey(db, userId);

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
      const activity = await db.collection("api_key_activity")
        .find(query, { projection: { ip_hash: 0 } })
        .sort({ completed_at: -1 })
        .limit(limit)
        .toArray();
      return res.status(200).json({
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
          chargeInr: item.charge_inr ?? null,
          startedAt: item.started_at,
          completedAt: item.completed_at,
          durationMs: item.duration_ms,
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
