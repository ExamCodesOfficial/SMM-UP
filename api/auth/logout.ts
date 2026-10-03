import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearAuthCookie } from "../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: "Logged out successfully" });
}
