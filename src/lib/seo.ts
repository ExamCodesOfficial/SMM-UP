/**
 * Per-route SEO registry — every page gets a unique, keyword-rich title
 * and meta description. Applied client-side on navigation.
 */

import { FAQS, RESPONSIBLE_GROWTH_FAQS } from "./faqs";
import { PLATFORM_PAGES } from "../components/pages/PlatformPage";

export interface PageMeta {
  title: string;
  description: string;
}

export const SITE = "SMM UP";
const SITE_ORIGIN = "https://smmup.co.in";
const BASE_DESC = "SMM UP (SMMUP) is India's wholesale SMM panel, founded and owned by Aryan (@thatonearyan), with 0% UPI deposit fee, 2,100+ services and refill guarantees.";

export const PAGE_META: Record<string, PageMeta> = {
  home: {
    title: "SMM UP — Wholesale SMM Panel India | 0% Direct UPI Fee",
    description: BASE_DESC,
  },
  order: {
    title: "Place an Order | SMM UP",
    description: "Order Telegram members, Instagram followers, YouTube views and 2,100+ SMM services at wholesale rates. Listed start times and refill terms, with UPI deposits at 0% platform fee.",
  },
  catalog: {
    title: "Services & Prices — 2,100+ SMM Services | SMM UP",
    description: "Browse the full SMM UP catalog: Telegram, Instagram, YouTube, TikTok, Spotify, X and more. Live wholesale rates per 1,000, min/max, refill guarantee and average delivery time.",
  },
  mass: {
    title: "Mass Order — Bulk SMM Orders | SMM UP",
    description: "Place bulk SMM orders in one go: paste multiple links with quantities, see current pricing and submit each order with a durable local record. Built for agencies and resellers.",
  },
  logs: {
    title: "Order History | SMM UP",
    description: "Track SMM orders with provider status checks, start count, remains, refill windows and full order details.",
  },
  checking: {
    title: "Checking Session | SMM UP",
    description: "Securely checking your SMM UP session.",
  },
  auth: {
    title: "Sign In or Create Free Account | SMM UP",
    description: "Sign in to SMM UP or create an account with verified email. No social-media password is required; Direct UPI wallet funding has a 0% platform fee.",
  },
  api: {
    title: "API Documentation for Resellers | SMM UP",
    description: "Standard SMM v2 API: add orders, check status, services list, balance, refill and cancel. Full docs with cURL, PHP and Python examples.",
  },
  playground: {
    title: "API Playground — Test Live Calls | SMM UP",
    description: "Test the SMM UP API right from your browser: balance, services, order status and more, with live JSON responses.",
  },
  reviews: {
    title: "Leave a Verified Buyer Review | SMM UP",
    description: "Purchased from SMM UP? Sign in and share one verified, editable review. Only accounts with a valid past order can publish feedback.",
  },
  account: {
    title: "My Account — Wallet, Activity & API Keys | SMM UP",
    description: "Manage your SMM UP account, wallet activity, order and deposit history, named API keys, sessions, account security and sign-out.",
  },
  "password-change": {
    title: "Complete Password Recovery | SMM UP",
    description: "Restricted SMM UP account-recovery step for creating a permanent password after owner-verified support recovery.",
  },
  "support-access": {
    title: "Owner Support Access | SMM UP",
    description: "Private owner-only exchange for time-limited, read-only customer support access.",
  },
  transactions: {
    title: "Deposit & Transaction History | SMM UP",
    description: "View your Direct UPI and Razorpay deposit history on SMM UP: amounts, references, verification status and wallet transaction records.",
  },
  "add-funds": {
    title: "Add Funds — Direct UPI or Razorpay | SMM UP",
    description: "Add money to your SMM UP wallet using 0% fee Direct UPI or the separate Razorpay Secure Checkout payment flow.",
  },
  faq: {
    title: "FAQ — Frequently Asked Questions | SMM UP",
    description: "Answers about UPI deposits, UTR verification, order speed, drops and refill guarantee, API usage and account security on SMM UP.",
  },
  support: {
    title: "Support & Contact | SMM UP",
    description: "Get help from the SMM UP Telegram support desk and find the references needed for order and payment review.",
  },
  about: {
    title: "Who Owns SMM UP? Aryan — Founder & Owner | SMMUP",
    description: "SMM UP (SMMUP) is founded, owned and operated by Aryan. His official Telegram identity is @thatonearyan. Learn about the owner and platform.",
  },
  "responsible-growth": {
    title: "Responsible Social Growth & Service Quality | SMM UP",
    description: "Learn the practical benefits of SMM UP: transparent wholesale rates, visible service terms, no-password ordering, refill protection, tracking, API tools and responsible-use standards.",
  },
  terms: {
    title: "Terms of Service | SMM UP",
    description: "Terms of Service for SMM UP: account rules, ordering, deposits and refunds, refill guarantee, acceptable use and liability.",
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
    description: "Conservative SMM UP service-status reference without unverified live-health claims.",
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
    description: "Browse Telegram channel-member, post-view and reaction services at current rates from SMM UP. Direct UPI has a 0% platform fee; listings show delivery estimates and refill terms.",
  },
  "p-instagram": {
    title: "Instagram SMM Panel India — Followers, Likes, Reels Views | SMM UP",
    description: "Browse Instagram follower, like, Reels-view and reach services at current rates from SMM UP, with a 0% Direct UPI platform fee and listing-specific terms.",
  },
  "p-youtube": {
    title: "YouTube SMM Panel India — Views, Watch Time, Subscribers | SMM UP",
    description: "Browse YouTube view, watch-time, subscriber and like services at current rates from SMM UP. Listings show service terms; YouTube retains final analytics and monetization authority.",
  },
  "p-twitter": {
    title: "Twitter / X SMM Panel India — Followers, Likes, Retweets | SMM UP",
    description: "Buy Twitter (X) followers, likes, retweets and impressions at wholesale rates from SMM UP. 0% UPI fee, listed start times and service-specific refill terms.",
  },
  "p-tiktok": {
    title: "TikTok SMM Panel India — Views, Followers, Likes | SMM UP",
    description: "Browse TikTok video-view, follower, like and share services at current rates from SMM UP, with a 0% Direct UPI platform fee and listing-specific delivery estimates.",
  },
  "p-spotify": {
    title: "Spotify SMM Panel India — Streams, Followers, Monthly Listeners | SMM UP",
    description: "Browse Spotify streams, artist followers, playlist plays and monthly-listener services at wholesale rates from SMM UP, with listing-specific delivery terms and 0% Direct UPI platform fee.",
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

  const privateTabs = new Set([
    "checking",
    "auth",
    "account",
    "password-change",
    "support-access",
    "transactions",
    "add-funds",
    "logs",
    "status",
    "notfound",
  ]);
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.setAttribute("name", "robots");
    document.head.appendChild(robots);
  }
  robots.setAttribute("content", privateTabs.has(tab) ? "noindex,nofollow" : "index,follow");

  const path = window.location.pathname === "/" ? "/" : window.location.pathname;
  const absUrl = "https://smmup.co.in" + path;

  // ── Canonical (self-referencing, one canonical per stripable URL) ──
  let canon = document.querySelector('link[rel="canonical"]');
  if (!canon) {
    canon = document.createElement("link");
    canon.setAttribute("rel", "canonical");
    document.head.appendChild(canon);
  }
  canon.setAttribute("href", absUrl);

  // ── og:url kept in sync per route for correct social previews ──
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute("content", absUrl);
  const setMetaContent = (selector: string, attribute: "name" | "property", key: string, content: string) => {
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  setMetaContent('meta[property="og:title"]', "property", "og:title", meta.title);
  setMetaContent('meta[property="og:description"]', "property", "og:description", meta.description);
  setMetaContent('meta[name="twitter:title"]', "name", "twitter:title", meta.title);
  setMetaContent('meta[name="twitter:description"]', "name", "twitter:description", meta.description);

  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || `${SITE_ORIGIN}/og-image.png`;
  setMetaContent('meta[name="twitter:image"]', "name", "twitter:image", ogImage);
}

/* ── Per-route JSON-LD structured data (injected/replaced on navigation) ── */

const JSONLD_ID = "dynamic-jsonld";

function injectJsonLd(payload: object | null) {
  let el = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!payload) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = JSONLD_ID;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
}

/** BreadcrumbList matching the real crawl structure (Home → page), plus
 *  FAQPage schema on the FAQ page and every platform page. */
export function applyStructuredData(tab: string) {
  const pageName = (document.title || "SMM UP").split("|")[0].trim();

  const crumbs: any = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://smmup.co.in/" },
      ...(tab !== "home"
        ? [{
            "@type": "ListItem",
            position: 2,
            name: pageName,
            item: "https://smmup.co.in" + window.location.pathname,
          }]
        : []),
    ],
  };

  // FAQ rich results: shared FAQ page + all six platform pages
  if (tab === "faq") {
    const items = FAQS.map((f) => ({ q: f.q, a: f.a }));
    injectJsonLd({
      "@context": "https://schema.org",
      "@graph": [
        crumbs,
        {
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    });
  } else if (tab === "responsible-growth") {
    injectJsonLd({
      "@context": "https://schema.org",
      "@graph": [
        crumbs,
        {
          "@type": "FAQPage",
          mainEntity: RESPONSIBLE_GROWTH_FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      ],
    });
  } else if (tab.startsWith("p-")) {
    const cfg = PLATFORM_PAGES.find((pp) => pp.tab === tab);
    if (cfg && Array.isArray(cfg.faq) && cfg.faq.length) {
      injectJsonLd({
        "@context": "https://schema.org",
        "@graph": [
          crumbs,
          {
            "@type": "FAQPage",
            mainEntity: cfg.faq.map((f: any) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ],
      });
    } else {
      injectJsonLd(crumbs);
    }
  } else {
    injectJsonLd(crumbs);
  }
}
