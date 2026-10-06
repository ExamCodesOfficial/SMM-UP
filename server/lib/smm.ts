export interface RefillPolicy {
  hasRefill: boolean;
  days: number;
  label: string;
  shortLabel: string;
}

export interface SMMService {
  service: number | string;
  name: string;
  type: string;
  category: string;
  platform: string;
  rate: number; // Retail rate in INR
  wholesale_rate: number; // Original wholesale rate in INR
  min: number;
  max: number;
  dripfeed: boolean;
  refill: boolean;
  refill_days: number;
  refill_label: string;
  refill_short: string;
  cancel: boolean;
  average_time: string;
  description: string;
}

function panelConfiguration() {
  const url = String(process.env.PANEL_URL || "").trim();
  const key = String(process.env.PANEL_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supplier integration is not configured.");
  }
  const parsed = new URL(url);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Supplier integration must use HTTPS in production.");
  }
  return { url: parsed.toString(), key };
}

const DEFAULT_HEADERS = {
  "User-Agent": "SMM-UP/1.0",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

function pricingMultipliers() {
  const tier1 = Number(process.env.TIER1_MARKUP);
  const tier2 = Number(process.env.TIER2_MARKUP);
  if (!Number.isFinite(tier1) || tier1 <= 0 || !Number.isFinite(tier2) || tier2 <= 0) {
    throw new Error("Private pricing configuration is missing or invalid.");
  }
  return { tier1, tier2 };
}

export function calculateRetailRate(wholesaleRate1k: number, t1?: number, t2?: number): number {
  const wRate = Number(wholesaleRate1k);
  if (!Number.isFinite(wRate) || wRate <= 0) {
    throw new Error("Wholesale rate must be a positive number.");
  }
  const configured = t1 === undefined || t2 === undefined ? pricingMultipliers() : null;
  const tier1 = t1 ?? configured!.tier1;
  const tier2 = t2 ?? configured!.tier2;
  if (!Number.isFinite(tier1) || tier1 <= 0 || !Number.isFinite(tier2) || tier2 <= 0) {
    throw new Error("Pricing multipliers must be positive numbers.");
  }
  const retail = wRate * (wRate < 20.0 ? tier1 : tier2);
  return Math.max(0.01, Math.round(retail * 100) / 100);
}

export function calculateOrderTotal(
  wholesaleRate1k: number,
  quantity: number,
  t1?: number,
  t2?: number,
): { totalCharge: number; wholesaleCost: number; profit: number } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Order quantity must be a positive integer.");
  }
  const retail1k = calculateRetailRate(wholesaleRate1k, t1, t2);
  let totalCharge = (retail1k * quantity) / 1000.0;
  totalCharge = Math.max(0.10, Math.round(totalCharge * 100) / 100);

  const wholesaleCost = Math.round(((Number(wholesaleRate1k) * quantity) / 1000.0) * 100) / 100;
  const profit = Math.max(0, Math.round((totalCharge - wholesaleCost) * 100) / 100);

  return { totalCharge, wholesaleCost, profit };
}

async function panelRequest(
  action: string,
  parameters: Record<string, string | number | undefined> = {},
): Promise<any> {
  const configuration = panelConfiguration();
  const formData = new URLSearchParams({ key: configuration.key, action });
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== "") formData.append(name, String(value));
  }

  const response = await fetch(configuration.url, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Supplier request failed with HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Supplier returned an invalid response.");
  }
}

// In-memory catalog cache (TTL: 5 minutes)
let cachedServices: SMMService[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function normalizeProviderOrderStatus(raw: unknown): string {
  const status = String(raw || "").trim().toLowerCase();
  if (status === "completed" || status === "complete") return "Completed";
  if (status === "partial") return "Partial";
  if (status === "processing") return "Processing";
  if (status === "in progress" || status === "inprogress") return "In progress";
  if (status === "canceled" || status === "cancelled") return "Canceled";
  if (status === "failed") return "Failed";
  return "Pending";
}

export function detectPlatform(category: string, name: string): string {
  const combined = (category + " " + name).toLowerCase();
  if (/telegram|\btg\b/i.test(combined)) return "Telegram";
  if (/instagram|\big\b|reels/i.test(combined)) return "Instagram";
  if (/youtube|\byt\b/i.test(combined)) return "YouTube";
  if (/facebook|\bfb\b/i.test(combined)) return "Facebook";
  if (/twitter|\bx\b|tweet/i.test(combined)) return "Twitter / X";
  if (/tiktok/i.test(combined)) return "TikTok";
  if (/spotify/i.test(combined)) return "Spotify";
  if (/discord/i.test(combined)) return "Discord";
  if (/linkedin/i.test(combined)) return "LinkedIn";
  if (/whatsapp/i.test(combined)) return "WhatsApp";
  if (/traffic|website|visitor|seo/i.test(combined)) return "Traffic";
  return "Other";
}

export function decodeHtmlEntities(raw: string | undefined | null): string {
  if (!raw) return "";
  let str = String(raw);
  str = str.replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");
  str = str.replace(/&amp;/g, "&");
  str = str.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCodePoint(Number(dec));
    } catch {
      return "";
    }
  });
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });
  str = str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  return str;
}

export function sanitizeBrandText(raw: string | undefined | null): string {
  if (!raw) return "";
  let str = String(raw);

  // Replace upstream-brand.invalid domain
  str = str.replace(/smm[\s_\-]*bin\.com/gi, "smmup.co.in");

  // Replace mathematical bold/sans Unicode variants (e.g. 𝗦𝗠𝗠 𝗕𝗜N)
  str = str.replace(/[\u{1D5E6}\u{1D5B2}\u{1D412}s][\u{1D5E0}\u{1D5C6}\u{1D40C}m]{2}\s*[\u{1D5D5}\u{1D5BB}\u{1D401}b][\u{1D5DC}\u{1D5C2}\u{1D408}i][\u{1D5E1}\u{1D5C7}\u{1D40D}n]/giu, "SMM UP");

  // Replace standard UpstreamProvider / SMM BIN / upstream-brand / upstream_brand
  str = str.replace(/smm[\s_\-]*bin/gi, "SMM UP");

  // Check normalized form for any remaining unicode variations
  const normalized = str.normalize("NFKD");
  if (/smm[\s_\-]*bin/i.test(normalized)) {
    str = normalized
      .replace(/smm[\s_\-]*bin\.com/gi, "smmup.co.in")
      .replace(/smm[\s_\-]*bin/gi, "SMM UP");
  }

  return str;
}

export function cleanServiceDescription(raw: string | undefined | null): string {
  if (!raw) return "Automated delivery requires a public target. Timing depends on the selected service and supplier capacity.";
  let str = decodeHtmlEntities(raw);
  str = sanitizeBrandText(str);
  str = str.replace(/^[\s\S]*?(?:please read the description|please read before ordering[\.\:\!]?|important note[\.\:\!]?)/i, "");
  str = str.replace(/^[\s\n\r\-\:\_]+/, "");
  return str.trim() || "Automated delivery requires a public target. Timing depends on the selected service and supplier capacity.";
}

export function extractRefillPolicy(name: string, description: string, providerRefill: boolean): RefillPolicy {
  const text = ((name || "") + " " + (description || "")).trim();

  // 1. Explicit No Refill
  if (/(?:⚠️\s*)?no\s*refill|without\s*refill|refill\s*none|non[\s\-]*refill/i.test(text)) {
    return { hasRefill: false, days: 0, label: "No Refill", shortLabel: "No Refill" };
  }

  // 2. Lifetime Guaranteed
  if (/lifetime|life\s*time|forever|permanent/i.test(text) || /♻️\s*lifetime/i.test(text)) {
    return { hasRefill: true, days: 9999, label: "Lifetime Guaranteed", shortLabel: "Lifetime" };
  }

  // 3. Explicit numeric days (e.g. 7 Days, 15 Days, 30 Days, 60 Days, 90 Days, 365 Days)
  const dayMatch =
    text.match(/(?:♻️|⚡)?\s*(\d+)\s*(?:days?|d)\s*(?:auto\s*refill|refill|guarantee|warranty|sla|drop)?/i) ||
    text.match(/(?:refill|guarantee|warranty|sla)\s*[:\-]?\s*(\d+)\s*(?:days?|d)/i) ||
    text.match(/\b(\d+)\s*(?:days?|d)\s*♻️/i);

  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    if (!isNaN(days) && days > 0 && days < 2000) {
      return {
        hasRefill: true,
        days: days,
        label: `${days} Days Guaranteed`,
        shortLabel: `${days}D Refill`,
      };
    }
  }

  // 4. Fallback: if provider flagged refill === true
  if (providerRefill) {
    return { hasRefill: true, days: 30, label: "30 Days Guaranteed", shortLabel: "30D Refill" };
  }

  return { hasRefill: false, days: 0, label: "No Refill", shortLabel: "No Refill" };
}

/**
 * Sanitize provider error messages so wholesale domain/brand never leaks to end users.
 */
export function sanitizeProviderError(raw: string): string {
  if (!raw) return "Provider temporarily unavailable. Please try again or contact support.";
  let msg = sanitizeBrandText(raw);
  // Generic fallback for anything that still looks like a provider leak
  msg = msg.replace(/https?:\/\/[^\s]+/gi, "[upstream]");
  // Common wholesale error codes -> user-friendly
  if (/insufficient funds|not enough funds/i.test(msg)) return "Insufficient provider capacity. Please try again shortly or contact support.";
  if (/incorrect service/i.test(msg)) return "Service temporarily unavailable. Please try again or contact support.";
  if (/link.*invalid|incorrect link/i.test(msg)) return "Invalid link format for this service. Please check the target URL/username.";
  if (/quantity.*invalid|incorrect quantity/i.test(msg)) return "Quantity is outside allowed range for this service.";
  return msg.slice(0, 300);
}

export async function fetchAllServices(forceRefresh = false): Promise<SMMService[]> {
  const now = Date.now();
  if (!forceRefresh && cachedServices && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedServices;
  }

  const data = await panelRequest("services");
  if (!Array.isArray(data)) {
    throw new Error("Invalid provider response format");
  }

  const sanitized: SMMService[] = data
    .filter((service: any) => {
      const serviceId = Number(service?.service);
      const wholesaleRate = Number(service?.rate);
      return Number.isSafeInteger(serviceId) && serviceId > 0
        && Number.isFinite(wholesaleRate) && wholesaleRate > 0;
    })
    .map((service: any) => {
      const wholesaleRate = Number(service.rate);
      const retailRate = calculateRetailRate(wholesaleRate);
      const category = sanitizeBrandText(decodeHtmlEntities(String(service.category || "General")).trim()).slice(0, 300);
      const name = sanitizeBrandText(decodeHtmlEntities(String(service.name || "Service")).trim()).slice(0, 500);
      const description = cleanServiceDescription(service.description || service.desc).slice(0, 5000);
      const rawRefill = Boolean(service.refill === true || service.refill === "true" || service.refill === 1);
      const refillPolicy = extractRefillPolicy(name, description, rawRefill);
      const parsedMin = Number.parseInt(String(service.min || ""), 10);
      const parsedMax = Number.parseInt(String(service.max || ""), 10);
      const minimum = Number.isSafeInteger(parsedMin) && parsedMin > 0 ? parsedMin : 10;
      const maximum = Number.isSafeInteger(parsedMax) && parsedMax >= minimum ? parsedMax : Math.max(minimum, 100_000);

      return {
        service: Number(service.service),
        name,
        type: String(service.type || "Default").slice(0, 100),
        category,
        platform: detectPlatform(category, name),
        rate: retailRate,
        wholesale_rate: wholesaleRate,
        min: minimum,
        max: maximum,
        dripfeed: Boolean(service.dripfeed === true || service.dripfeed === "true"),
        refill: refillPolicy.hasRefill,
        refill_days: refillPolicy.days,
        refill_label: refillPolicy.label,
        refill_short: refillPolicy.shortLabel,
        cancel: Boolean(service.cancel === true || service.cancel === "true" || service.cancel === 1),
        average_time: String(service.average_time || "Timing varies by service and supplier capacity").slice(0, 200),
        description,
      };
    });

  cachedServices = sanitized;
  lastCacheTime = now;
  return sanitized;
}

export async function addProviderOrder(params: {
  serviceId: number | string;
  link: string;
  quantity?: number;
  comments?: string;
  usernames?: string;
  hashtags?: string;
  username?: string;
  answer_number?: number | string;
  runs?: number;
  interval?: number;
}): Promise<{ orderId?: number | string; error?: string }> {
  try {
    const response = await panelRequest("add", {
      service: params.serviceId,
      link: params.link,
      quantity: params.quantity,
      comments: params.comments,
      usernames: params.usernames,
      hashtags: params.hashtags,
      username: params.username,
      answer_number: params.answer_number,
      runs: params.runs,
      interval: params.interval,
    });
    if (response?.error) return { error: String(response.error) };
    if (response?.order === undefined || response?.order === null || response?.order === "") {
      return { error: "Supplier returned an invalid order response." };
    }
    return { orderId: response.order };
  } catch (error: any) {
    return { error: error?.message || "Supplier connection failed." };
  }
}

export async function checkOrderStatus(orderId: number | string): Promise<any> {
  return panelRequest("status", { order: orderId });
}

/** Batch status check — upstream accepts comma-separated order IDs (max 100) in one call. */
export async function checkOrderStatusMulti(orderIds: string): Promise<any> {
  return panelRequest("status", { order: orderIds });
}

/** Poll the status of a previously requested refill (standard v2 `refill_status` action). */
export async function checkRefillStatus(refillId: number | string): Promise<any> {
  return panelRequest("refill_status", { refill: refillId });
}

export async function requestOrderRefill(orderId: number | string): Promise<any> {
  return panelRequest("refill", { order: orderId });
}

export async function cancelProviderOrder(orderId: number | string): Promise<any> {
  return panelRequest("cancel", { order: orderId });
}

export async function getWholesaleBalance(): Promise<{ balance: number; currency: string }> {
  const data = await panelRequest("balance");
  return {
    balance: parseFloat(data?.balance) || 0,
    currency: String(data?.currency || "INR"),
  };
}
