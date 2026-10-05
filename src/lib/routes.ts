/* ── Shared route table: tab id ↔ URL path (one entry per real page) ──
   Everything that renders a link imports from here, so hrefs can never drift. */

export const TAB_PATHS: Record<string, string> = {
  home: "/",
  order: "/order",
  catalog: "/catalog",
  mass: "/mass",
  logs: "/logs",
  auth: "/auth",
  api: "/api",
  playground: "/playground",
  account: "/account",
  transactions: "/transactions",
  faq: "/faq",
  reviews: "/review",
  support: "/support",
  about: "/about",
  "responsible-growth": "/responsible-growth",
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refunds",
  "acceptable-use": "/acceptable-use",
  "cookie-policy": "/cookie-policy",
  security: "/security",
  abuse: "/abuse",
  press: "/press",
  status: "/status",
  changelog: "/changelog",
  sitemap: "/sitemap",
  "p-telegram": "/telegram-smm-panel",
  "p-instagram": "/instagram-smm-panel",
  "p-youtube": "/youtube-smm-panel",
  "p-twitter": "/twitter-smm-panel",
  "p-tiktok": "/tiktok-smm-panel",
  "p-spotify": "/spotify-smm-panel",
};

export const PATH_TABS: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab]),
);

/** Absolute HTTPS URL for a tab (canonicals, JSON-LD, sitemap helpers). */
export function absoluteUrl(tab: string): string {
  return `https://smmup.co.in${TAB_PATHS[tab] || "/"}`;
}

/** URL path for a tab id (falls back to "/"). */
export function pathFor(tab: string): string {
  return TAB_PATHS[tab] || "/";
}
