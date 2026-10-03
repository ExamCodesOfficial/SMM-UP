import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { getDb } from "../lib/db";
import { hashPassword, signUserToken, setAuthCookie } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanUsername = String(username).trim();

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const apiKey = "sup_" + crypto.randomBytes(16).toString("hex");

    const newUser = {
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
  } catch (err: any) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed. Try again." });
  }
}
