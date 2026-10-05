import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db.js";
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  setAuthCookie,
  clearAuthCookie,
  getUserFromRequest,
} from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";
import { sanitizeBrandText } from "../lib/smm.js";

function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateApiKey(): { raw: string; hash: string } {
  const raw = "sup_" + crypto.randomBytes(24).toString("hex");
  return { raw, hash: hashApiKey(raw) };
}

function maskApiKey(raw: string | null | undefined): string | null {
  if (!raw || raw.length < 12) return null;
  return raw.slice(0, 10) + "•".repeat(12) + raw.slice(-4);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const db = await getDb();
  const users = db.collection("users");

  // ── 1. REGISTER (NO auto API key) ────────────────────────────
  if (action === "register") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: "All fields are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = sanitizeBrandText(String(username).trim()).slice(0, 40);
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    try {
      const existing = await users.findOne({ email: cleanEmail });
      if (existing) return res.status(400).json({ error: "Email already registered" });

      const passwordHash = await hashPassword(password);

      const newUser: any = {
        username: cleanUsername,
        email: cleanEmail,
        password_hash: passwordHash,
        balance: 0.0,
        total_spent: 0.0,
        total_orders: 0,
        role: "user",
        api_key: null,
        api_key_hash: null,
        api_key_created_at: null,
        api_key_last_used_at: null,
        created_at: new Date(),
        updated_at: new Date(),
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
          apiKey: null,
          apiKeyMasked: null,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  // ── 2. LOGIN ─────────────────────────────────────────────────
  if (action === "login") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
    const { allowed, remainingSec } = checkRateLimit(`login_${ip}`, 10, 300);
    if (!allowed) {
      return res.status(429).json({ error: `Too many login attempts. Try again in ${remainingSec}s.` });
    }

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    try {
      const user: any = await users.findOne({ email: cleanEmail });
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = signUserToken({
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      });
      setAuthCookie(res, token);

      // Migrate legacy plaintext api_key -> hashed if needed (one-time)
      if (user.api_key && !user.api_key_hash) {
        try {
          await users.updateOne({ _id: user._id }, { $set: { api_key_hash: hashApiKey(user.api_key), api_key_created_at: user.created_at || new Date() } });
          user.api_key_hash = hashApiKey(user.api_key);
        } catch {}
      }
      const hasApiKey = Boolean(user.api_key_hash || user.api_key);
      const rawKey: string | null = user.api_key || null;

      return res.status(200).json({
        success: true,
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          balance: user.balance || 0.0,
          role: user.role || "user",
          hasApiKey,
          apiKey: null,
          apiKeyMasked: hasApiKey && rawKey ? maskApiKey(rawKey) : null,
        },
      });
    } catch (err) {
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
      if (user.api_key && !user.api_key_hash) {
        try {
          await users.updateOne({ _id: user._id }, { $set: { api_key_hash: hashApiKey(user.api_key), api_key_created_at: user.created_at || new Date() } });
          user.api_key_hash = hashApiKey(user.api_key);
        } catch {}
      }
      const hasApiKey = Boolean(user.api_key_hash || user.api_key);
      const rawKey: string | null = user.api_key || null;
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
          hasApiKey,
          apiKey: null,
          apiKeyMasked: hasApiKey && rawKey ? maskApiKey(rawKey) : null,
          apiKeyCreatedAt: user.api_key_created_at || null,
        },
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  }

  // ── 5. GENERATE API KEY (on-demand, one-time reveal) ───────
  if (action === "generate-key") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global");
    const rl = checkRateLimit(`genkey_${authUser.userId}_${ip}`, 3, 600);
    if (!rl.allowed) return res.status(429).json({ error: `Too many requests. Try again in ${rl.remainingSec}s.` });
    try {
      const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.api_key_hash || user.api_key) {
        return res.status(409).json({ error: "API key already exists. Use regenerate to create a new one.", hasApiKey: true });
      }
      const { raw, hash } = generateApiKey();
      await users.updateOne({ _id: user._id }, { $set: { api_key: raw, api_key_hash: hash, api_key_created_at: new Date(), updated_at: new Date() } });
      return res.status(201).json({ success: true, apiKey: raw, apiKeyMasked: maskApiKey(raw), message: "API key generated. Copy it now — it will be masked after this." });
    } catch (e: any) {
      if (e?.code === 11000) return res.status(409).json({ error: "API key collision, please retry." });
      return res.status(500).json({ error: "Failed to generate API key" });
    }
  }

  // ── 6. REGENERATE API KEY ───────────────────────────────────
  if (action === "regenerate-key") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global");
    const rl = checkRateLimit(`regen_${authUser.userId}_${ip}`, 3, 600);
    if (!rl.allowed) return res.status(429).json({ error: `Too many requests. Try again in ${rl.remainingSec}s.` });
    const { confirm } = (req.body as any) || {};
    if (confirm !== true && confirm !== "true") return res.status(400).json({ error: "Confirmation required. Send { confirm: true } to regenerate. Old key will be revoked." });
    try {
      const { raw, hash } = generateApiKey();
      const result: any = await users.findOneAndUpdate(
        { _id: new ObjectId(authUser.userId) },
        { $set: { api_key: raw, api_key_hash: hash, api_key_created_at: new Date(), api_key_last_used_at: null, updated_at: new Date() } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({ success: true, apiKey: raw, apiKeyMasked: maskApiKey(raw), message: "API key regenerated. Old key is now revoked. Copy the new key now." });
    } catch {
      return res.status(500).json({ error: "Failed to regenerate API key" });
    }
  }

  // ── 7. REVEAL (masked hint only; full key only right after generate/regen) ──
  if (action === "reveal-key") {
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    try {
      const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
      if (!user || (!user.api_key_hash && !user.api_key)) return res.status(404).json({ error: "No API key found. Generate one first." });
      const rawKey: string | null = user.api_key || null;
      return res.status(200).json({ hasApiKey: true, apiKeyMasked: rawKey ? maskApiKey(rawKey) : null, createdAt: user.api_key_created_at || null, lastUsedAt: user.api_key_last_used_at || null, hint: "Full key is only shown once right after generation/regeneration. Use regenerate to get a new key." });
    } catch {
      return res.status(500).json({ error: "Failed to fetch key info" });
    }
  }

  // ── 8. DELETE API KEY ───────────────────────────────────────
  if (action === "delete-key") {
    if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
    const { confirm } = (req.body as any) || {};
    if (confirm !== true && confirm !== "true") return res.status(400).json({ error: "Confirmation required. Send { confirm: true } to delete." });
    try {
      await users.updateOne({ _id: new ObjectId(authUser.userId) }, { $set: { api_key: null, api_key_hash: null, api_key_last_used_at: null, updated_at: new Date() } });
      return res.status(200).json({ success: true, message: "API key deleted." });
    } catch {
      return res.status(500).json({ error: "Failed to delete API key" });
    }
  }

  return res.status(404).json({ error: "Auth action not found" });
}
