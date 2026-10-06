import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(val: number | string | undefined | null): string {
  const num = typeof val === "string" ? parseFloat(val) : Number(val || 0);
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(val: number | string | undefined | null): string {
  const num = typeof val === "string" ? parseInt(val, 10) : Number(val || 0);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
}

/**
 * Universally decodes double-encoded HTML entities, decimal entities, hex entities,
 * and strips raw HTML tags like <br> from upstream SMM provider data.
 */
export function decodeHtmlEntities(raw: string | undefined | null): string {
  if (!raw) return "";
  let str = String(raw);

  // Replace HTML break tags with newlines
  str = str.replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");

  // Decode double encoded entities (&amp;#9888; -> &#9888;)
  str = str.replace(/&amp;/g, "&");

  // Decode decimal entities (e.g., &#9888; -> ⚠️, &#127757; -> 🌍)
  str = str.replace(/&#(\d+);/g, (_, dec) => {
    try {
      return String.fromCodePoint(Number(dec));
    } catch {
      return "";
    }
  });

  // Decode hex entities (e.g., &#x1F30D;)
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return "";
    }
  });

  // Common named entities
  str = str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

  return str;
}

/**
 * Universally sanitizes any upstream provider brand mentions (upstream-brand, upstream_brand, UpstreamProvider, upstream-brand.invalid, etc.)
 * replacing them with SMM UP across categories, package titles, and descriptions.
 */
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

/**
 * Cleans service descriptions:
 * 1. Decodes all HTML entities into clean Unicode characters.
 * 2. Cleanses upstream brand mentions (UpstreamProvider -> SMM UP).
 * 3. Removes redundant boilerplate warning banner lines (e.g. "⚠️ Please read before ordering").
 * 4. Trims leading/trailing whitespace and symbols.
 */
export function cleanServiceDescription(raw: string | undefined | null): string {
  if (!raw) return "Automated delivery requires a public target. Timing depends on the selected service and supplier capacity.";
  let str = decodeHtmlEntities(raw);
  str = sanitizeBrandText(str);

  // Strip redundant warning banner header like "⚠️ Please Read the Description" or "Please read before ordering"
  str = str.replace(/^[\s\S]*?(?:please read the description|please read before ordering[\.\:\!]?|important note[\.\:\!]?)/i, "");

  // Clean up leading newlines and symbols left behind
  str = str.replace(/^[\s\n\r\-\:\_]+/, "");

  return str.trim() || "Automated delivery requires a public target. Timing depends on the selected service and supplier capacity.";
}

export interface ServiceRefillPolicy {
  hasRefill: boolean;
  days: number;
  label: string; // e.g. "Lifetime Guaranteed", "365 Days Guaranteed", "30 Days Guaranteed", "7 Days Guaranteed", "No Refill"
  shortLabel: string; // e.g. "Lifetime", "365D Refill", "30D Refill", "7D Refill", "No Refill"
}

/**
 * Dynamically resolves the exact refill duration and guarantee policy for any SMM service.
 * Handles 7-day, 15-day, 30-day, 60-day, 90-day, 365-day, and Lifetime non-drop guarantees.
 */
export function parseRefillPolicy(service: any): ServiceRefillPolicy {
  if (!service) {
    return { hasRefill: false, days: 0, label: "No Refill", shortLabel: "No Refill" };
  }

  // 1. If backend already computed dynamic policy
  if (service.refill_label && service.refill_short !== undefined) {
    return {
      hasRefill: Boolean(service.refill),
      days: Number(service.refill_days) || (service.refill ? 30 : 0),
      label: service.refill_label,
      shortLabel: service.refill_short,
    };
  }

  const text = ((service.name || "") + " " + (service.description || "")).trim();

  // 2. Explicit No Refill
  if (/(?:⚠️\s*)?no\s*refill|without\s*refill|refill\s*none|non[\s\-]*refill/i.test(text)) {
    return { hasRefill: false, days: 0, label: "No Refill", shortLabel: "No Refill" };
  }

  // 3. Lifetime Guaranteed
  if (/lifetime|life\s*time|forever|permanent/i.test(text) || /♻️\s*lifetime/i.test(text)) {
    return { hasRefill: true, days: 9999, label: "Lifetime Guaranteed", shortLabel: "Lifetime" };
  }

  // 4. Explicit numeric days (e.g. 7 Days, 15 Days, 30 Days, 60 Days, 90 Days, 365 Days)
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

  // 5. Fallback: if provider flagged refill === true
  if (service.refill) {
    return { hasRefill: true, days: 30, label: "30 Days Guaranteed", shortLabel: "30D Refill" };
  }

  return { hasRefill: false, days: 0, label: "No Refill", shortLabel: "No Refill" };
}

