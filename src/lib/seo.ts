/**
 * Per-route SEO registry — every page gets a unique, keyword-rich title
 * and meta description. Applied client-side on navigation.
 */

export interface PageMeta {
  title: string;
  description: string;
}

export const SITE = "SMM UP";
const BASE_DESC = "SMM UP — India's wholesale SMM panel with 0% UPI deposit fee, 2,000+ services, instant start and refill guarantee.";

export const PAGE_META: Record<string, PageMeta> = {
  home: {
    title: "SMM UP — India's #1 Wholesale SMM Panel | 0% UPI Fee",
    description: BASE_DESC,
  },
  order: {
    title: "Place an Order | SMM UP",
    description: "Order Telegram members, Instagram followers, YouTube views and 2,000+ SMM services at wholesale rates. Instant start, refill guarantee, pay via UPI with 0% fee.",
  },
  catalog: {
    title: "Services & Prices — 2,000+ SMM Services | SMM UP",
    description: "Browse the full SMM UP catalog: Telegram, Instagram, YouTube, TikTok, Spotify, X and more. Live wholesale rates per 1,000, min/max, refill SLA and average delivery time.",
  },
  mass: {
    title: "Mass Order — Bulk SMM Orders | SMM UP",
    description: "Place bulk SMM orders in one go: paste multiple links with quantities, get instant pricing and dispatch. Built for agencies and resellers.",
  },
  logs: {
    title: "Order History | SMM UP",
    description: "Track all your SMM orders in real time: status, start count, remains, refill windows and full order details.",
  },
  auth: {
    title: "Sign In or Create Free Account | SMM UP",
    description: "Sign in to SMM UP or create a free account in 10 seconds. No KYC, no social media passwords, wallet top-up via UPI with 0% fee.",
  },
  api: {
    title: "API Documentation for Resellers | SMM UP",
    description: "Standard SMM v2 API: add orders, check status, services list, balance, refill and cancel. Full docs with cURL, PHP and Python examples.",
  },
  playground: {
    title: "API Playground — Test Live Calls | SMM UP",
    description: "Test the SMM UP API right from your browser: balance, services, order status and more, with live JSON responses.",
  },
  account: {
    title: "My Account | SMM UP",
    description: "Manage your SMM UP account: profile details, API key, session security.",
  },
  transactions: {
    title: "Deposit & Transaction History | SMM UP",
    description: "View your UPI deposits, UTR references and wallet transaction history on SMM UP.",
  },
  faq: {
    title: "FAQ — Frequently Asked Questions | SMM UP",
    description: "Answers about UPI deposits, UTR verification, order speed, drops and refill guarantee, API usage and account security on SMM UP.",
  },
  support: {
    title: "Support & Contact | SMM UP",
    description: "Get help from the SMM UP team: 24/7 Telegram support desk, response-time promise, and answers to common issues.",
  },
  about: {
    title: "About SMM UP — Founded by Aryan | SMM UP",
    description: "SMM UP is an Indian wholesale SMM panel founded and operated by Aryan. Learn why we charge 0% deposit fee and how our delivery works.",
  },
  terms: {
    title: "Terms of Service | SMM UP",
    description: "Terms of Service for SMM UP: account rules, ordering, deposits and refunds, refill SLA, acceptable use and liability.",
  },
  privacy: {
    title: "Privacy Policy | SMM UP",
    description: "How SMM UP collects, uses and protects your data: account information, UPI transaction references, cookies and retention.",
  },
  refunds: {
    title: "Refund & Cancellation Policy | SMM UP",
    description: "When orders are refunded, how partial orders are settled, refill windows from 7 days to lifetime, and how to cancel an order on SMM UP.",
  },
  "acceptable-use": {
    title: "Acceptable Use Policy | SMM UP",
    description: "What you may not order on SMM UP: illegal content, impersonation, spam, election manipulation and platform-rule violations.",
  },
  "cookie-policy": {
    title: "Cookie Policy | SMM UP",
    description: "Which cookies SMM UP uses and why: session authentication, security and preferences — no advertising trackers.",
  },
  security: {
    title: "Security | SMM UP",
    description: "How SMM UP protects your account and money: bcrypt password hashing, signed sessions, UPI handled over bank rails, no social passwords ever.",
  },
  abuse: {
    title: "Report Abuse | SMM UP",
    description: "Report an abusive order or content promoted through SMM UP. How we review and act on takedown requests.",
  },
  press: {
    title: "Press & Brand Kit | SMM UP",
    description: "SMM UP brand assets and press boilerplate: logo files, correct spelling, color palette and official description for partners and resellers.",
  },
  status: {
    title: "System Status | SMM UP",
    description: "Live operational status of SMM UP: ordering, UPI deposit clearing, API and provider networks, plus incident history.",
  },
  changelog: {
    title: "Changelog | SMM UP",
    description: "What's new on SMM UP: services added, delivery improvements and platform updates, newest first.",
  },
  sitemap: {
    title: "Sitemap | SMM UP",
    description: "Every page on SMM UP: services, platforms, help guides, legal policies and developer tools.",
  },
  "p-telegram": {
    title: "Telegram SMM Panel India — Members, Views, Reactions | SMM UP",
    description: "Buy Telegram channel members, post views and reactions at true wholesale rates from SMM UP — India's trusted Telegram SMM panel. 0% UPI fee, instant start, refill guarantee.",
  },
  "p-instagram": {
    title: "Instagram SMM Panel India — Followers, Likes, Reels Views | SMM UP",
    description: "Buy Instagram followers, likes, reels views and reach at wholesale prices from SMM UP — India's trusted Instagram SMM panel. 0% UPI fee, fast start, refill guarantee.",
  },
  "p-youtube": {
    title: "YouTube SMM Panel India — Views, Watch Time, Subscribers | SMM UP",
    description: "Buy YouTube views, 4000-hour watch time, subscribers and likes at wholesale rates from SMM UP — India's trusted YouTube SMM panel. Monetization-safe, refill guaranteed.",
  },
  "p-twitter": {
    title: "Twitter / X SMM Panel India — Followers, Likes, Retweets | SMM UP",
    description: "Buy Twitter (X) followers, likes, retweets and impressions at wholesale rates from SMM UP. 0% UPI fee, quick start and refill guarantee.",
  },
  "p-tiktok": {
    title: "TikTok SMM Panel India — Views, Followers, Likes | SMM UP",
    description: "Buy TikTok video views, followers, likes and shares at wholesale prices from SMM UP — India's trusted TikTok SMM panel. 0% UPI fee, instant start.",
  },
  "p-spotify": {
    title: "Spotify SMM Panel India — Streams, Followers, Monthly Listeners | SMM UP",
    description: "Buy Spotify streams, artist followers, playlist plays and monthly listeners at wholesale rates from SMM UP. Royalties-safe delivery, 0% UPI fee.",
  },
  notfound: {
    title: "Page Not Found | SMM UP",
    description: "This page does not exist on SMM UP. Browse services, read the FAQ or contact support.",
  },
};

export function applySeo(tab: string) {
  const meta = PAGE_META[tab] || PAGE_META.home;
  document.title = meta.title;
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", meta.description);
  let canon = document.querySelector('link[rel="canonical"]');
  if (!canon) {
    canon = document.createElement("link");
    canon.setAttribute("rel", "canonical");
    document.head.appendChild(canon);
  }
  canon.setAttribute("href", "https://smmup.co.in" + (window.location.pathname === "/" ? "/" : window.location.pathname));
}
