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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  const db = await getDb();
  const users = db.collection("users");

  // ── 1. REGISTER ──────────────────────────────────────────────
  if (action === "register") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: "All fields are required" });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim();
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    try {
      const existing = await users.findOne({ email: cleanEmail });
      if (existing) return res.status(400).json({ error: "Email already registered" });

      const passwordHash = await hashPassword(password);
      const apiKey = "sup_" + crypto.randomBytes(16).toString("hex");

      const newUser: any = {
        username: cleanUsername,
        email: cleanEmail,
        password_hash: passwordHash,
        balance: 0.0,
        total_spent: 0.0,
        total_orders: 0,
        role: cleanEmail.includes("aryan") ? "admin" : "user",
        api_key: apiKey,
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
          apiKey,
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

      return res.status(200).json({
        success: true,
        user: {
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          balance: user.balance || 0.0,
          role: user.role || "user",
          apiKey: user.api_key,
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

  // ── 4. ME (CURRENT USER SESSION) ─────────────────────────────
  if (action === "me") {
    const authUser = getUserFromRequest(req);
    if (!authUser) return res.status(401).json({ authenticated: false });

    try {
      const user: any = await users.findOne({ _id: new ObjectId(authUser.userId) });
      if (!user) return res.status(401).json({ authenticated: false });

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
          apiKey: user.api_key,
          createdAt: user.created_at,
        },
      });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(404).json({ error: "Auth action not found" });
}
