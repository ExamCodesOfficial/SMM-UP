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
