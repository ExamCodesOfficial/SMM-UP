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

/** Methods that may carry a request body. */
const BODIED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Reads the raw request body without any parsing.
 *
 * Provider webhooks sign the exact bytes they sent, so the body must reach
 * the signature check untouched. A JSON parser running first would reorder
 * keys and change the byte sequence, breaking every signature.
 */
export async function readRawBody(req: VercelRequest, maxBytes = 1_000_000): Promise<Buffer> {
  const method = String(req.method || "GET").toUpperCase();
  if (!BODIED_METHODS.includes(method)) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Reads the raw body and parses it as JSON, leaving `req.body` populated.
 *
 * Used by routes that share a file with a signed webhook: the same file must
 * both verify a raw HMAC and accept an ordinary JSON request, so the body is
 * read once here and handed to the caller already parsed.
 */
export async function readJsonBody(req: VercelRequest, maxBytes = 1_000_000): Promise<any> {
  const method = String(req.method || "GET").toUpperCase();
  if (!BODIED_METHODS.includes(method)) {
    req.body = req.body ?? {};
    return req.body;
  }

  const raw = await readRawBody(req, maxBytes);
  if (!raw.length) {
    req.body = {};
    return req.body;
  }

  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    req.body = parsed;
    return parsed;
  } catch {
    throw new Error("Request body is not valid JSON.");
  }
}

/** Reads a single request header, tolerating array-valued headers. */
export function headerValue(req: VercelRequest, name: string): string {
  const value = (req.headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}
