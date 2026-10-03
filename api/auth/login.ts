import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../lib/db";
import { verifyPassword, signUserToken, setAuthCookie } from "../lib/auth";
import { checkRateLimit } from "../lib/rateLimit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
  const { allowed, remainingSec } = checkRateLimit(`login_${ip}`, 10, 300);
  if (!allowed) {
    return res.status(429).json({ error: `Too many login attempts. Try again in ${remainingSec}s.` });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: cleanEmail });

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signUserToken(user);
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
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
}
