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
  cancel: boolean;
  average_time: string;
  description: string;
}

const PANEL_URL = process.env.PANEL_URL || "https://upstream-provider.invalid/api/v2";
const PANEL_KEY = process.env.PANEL_KEY || "***REMOVED_PANEL_KEY***";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Markup multipliers (Tier 1: < 20 INR -> 7.5x; Tier 2: >= 20 INR -> 2.0x)
export const TIER1_MARKUP = parseFloat(process.env.TIER1_MARKUP || "7.5");
export const TIER2_MARKUP = parseFloat(process.env.TIER2_MARKUP || "2.0");

export function calculateRetailRate(wholesaleRate1k: number, t1 = TIER1_MARKUP, t2 = TIER2_MARKUP): number {
  const wRate = Number(wholesaleRate1k) || 1.0;
  if (wRate < 20.0) {
    const retail = wRate * t1;
    return Math.max(1.0, Math.round(retail * 100) / 100);
  } else {
    const retail = wRate * t2;
    return Math.round(retail * 100) / 100;
  }
}

export function calculateOrderTotal(wholesaleRate1k: number, quantity: number, t1 = TIER1_MARKUP, t2 = TIER2_MARKUP): { totalCharge: number; wholesaleCost: number; profit: number } {
  const retail1k = calculateRetailRate(wholesaleRate1k, t1, t2);
  let totalCharge = (retail1k * quantity) / 1000.0;
  totalCharge = Math.max(0.10, Math.round(totalCharge * 100) / 100);

  const wholesaleCost = Math.round(((Number(wholesaleRate1k) * quantity) / 1000.0) * 100) / 100;
  const profit = Math.max(0, Math.round((totalCharge - wholesaleCost) * 100) / 100);

  return { totalCharge, wholesaleCost, profit };
}

// In-memory catalog cache (TTL: 5 minutes)
let cachedServices: SMMService[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

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

export function cleanServiceDescription(raw: string | undefined | null): string {
  if (!raw) return "Instant automated delivery node. Ensure target account is completely PUBLIC.";
  let str = decodeHtmlEntities(raw);
  str = str.replace(/^[\s\S]*?(?:please read the description|please read before ordering[\.\:\!]?|important note[\.\:\!]?)/i, "");
  str = str.replace(/^[\s\n\r\-\:\_]+/, "");
  return str.trim() || "Instant automated delivery node. Ensure target account is completely PUBLIC.";
}

export async function fetchAllServices(forceRefresh = false): Promise<SMMService[]> {
  const now = Date.now();
  if (!forceRefresh && cachedServices && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedServices;
  }

  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "services");

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch services from provider (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid provider response format");
  }

  const sanitized: SMMService[] = data.map((s: any) => {
    const wRate = parseFloat(s.rate) || 0;
    const retailRate = calculateRetailRate(wRate);
    const category = decodeHtmlEntities(String(s.category || "General")).trim();
    const name = decodeHtmlEntities(String(s.name || "Service")).trim();
    const description = cleanServiceDescription(s.description || s.desc);

    return {
      service: Number(s.service),
      name: name,
      type: String(s.type || "Default"),
      category: category,
      platform: detectPlatform(category, name),
      rate: retailRate,
      wholesale_rate: wRate,
      min: parseInt(s.min, 10) || 10,
      max: parseInt(s.max, 10) || 100000,
      dripfeed: Boolean(s.dripfeed === true || s.dripfeed === "true"),
      refill: Boolean(s.refill === true || s.refill === "true" || s.refill === 1),
      cancel: Boolean(s.cancel === true || s.cancel === "true" || s.cancel === 1),
      average_time: String(s.average_time || "Instant"),
      description: description,
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
  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "add");
  formData.append("service", String(params.serviceId));
  formData.append("link", params.link);

  if (params.quantity !== undefined) formData.append("quantity", String(params.quantity));
  if (params.comments) formData.append("comments", params.comments);
  if (params.usernames) formData.append("usernames", params.usernames);
  if (params.hashtags) formData.append("hashtags", params.hashtags);
  if (params.username) formData.append("username", params.username);
  if (params.answer_number) formData.append("answer_number", String(params.answer_number));
  if (params.runs) formData.append("runs", String(params.runs));
  if (params.interval) formData.append("interval", String(params.interval));

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const resJson = await response.json();
  if (resJson.error) {
    return { error: String(resJson.error) };
  }
  return { orderId: resJson.order };
}

export async function checkOrderStatus(orderId: number | string): Promise<any> {
  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "status");
  formData.append("order", String(orderId));

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  return await response.json();
}

export async function requestOrderRefill(orderId: number | string): Promise<any> {
  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "refill");
  formData.append("order", String(orderId));

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  return await response.json();
}

export async function cancelProviderOrder(orderId: number | string): Promise<any> {
  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "cancel");
  formData.append("order", String(orderId));

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  return await response.json();
}

export async function getWholesaleBalance(): Promise<{ balance: number; currency: string }> {
  const formData = new URLSearchParams();
  formData.append("key", PANEL_KEY);
  formData.append("action", "balance");

  const response = await fetch(PANEL_URL, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await response.json();
  return {
    balance: parseFloat(data.balance) || 0,
    currency: String(data.currency || "INR"),
  };
}
