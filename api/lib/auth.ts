import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "***REMOVED_JWT_SECRET***";
const COOKIE_NAME = "smm_up_session";

export interface UserTokenPayload {
  userId: string;
  email: string;
  username: string;
  role: "user" | "admin";
}

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(plain, hash);
}

export function signUserToken(user: { _id: ObjectId | string; email: string; username: string; role?: string }): string {
  const payload: UserTokenPayload = {
    userId: user._id.toString(),
    email: user.email.toLowerCase(),
    username: user.username,
    role: (user.role === "admin" ? "admin" : "user"),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch (err) {
    return null;
  }
}

export function getUserFromRequest(req: VercelRequest): UserTokenPayload | null {
  let token: string | undefined;

  // 1. Try Cookie
  if (req.headers.cookie) {
    const cookies = parse(req.headers.cookie);
    token = cookies[COOKIE_NAME];
  }

  // 2. Try Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) return null;
  return verifyUserToken(token);
}

export function setAuthCookie(res: VercelResponse, token: string): void {
  const cookieStr = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
