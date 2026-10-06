import type { IncomingMessage, ServerResponse } from "node:http";

/** Minimal Vercel-compatible HTTP types without shipping the Vercel build toolchain. */
export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body: any;
  cookies?: Record<string, string>;
}

export interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: any): VercelResponse;
  send(body: any): VercelResponse;
  redirect(statusOrUrl: number | string, url?: string): VercelResponse;
}
