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
 * Cleans service descriptions:
 * 1. Decodes all HTML entities into clean Unicode characters.
 * 2. Removes redundant boilerplate warning banner lines (e.g. "⚠️ Please read before ordering").
 * 3. Trims leading/trailing whitespace and symbols.
 */
export function cleanServiceDescription(raw: string | undefined | null): string {
  if (!raw) return "Instant automated delivery node. Ensure target account is completely PUBLIC.";
  let str = decodeHtmlEntities(raw);

  // Strip redundant warning banner header like "⚠️ Please Read the Description" or "Please read before ordering"
  str = str.replace(/^[\s\S]*?(?:please read the description|please read before ordering[\.\:\!]?|important note[\.\:\!]?)/i, "");

  // Clean up leading newlines and symbols left behind
  str = str.replace(/^[\s\n\r\-\:\_]+/, "");

  return str.trim() || "Instant automated delivery node. Ensure target account is completely PUBLIC.";
}
