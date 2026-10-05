import React from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";
import Reveal from "./Reveal";
import { pathFor } from "../lib/routes";

interface FooterProps {
  onNavigateTab: (tab: string) => void;
  onOpenTerms: () => void;
  onOpenWallet: () => void;
  onOpenSupport?: () => void;
}

const COLUMNS: { title: string; links: { tab: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { tab: "order", label: "Place an Order" },
      { tab: "catalog", label: "Services & Prices" },
      { tab: "mass", label: "Mass Order" },
      { tab: "logs", label: "Order History" },
      { tab: "auth", label: "Sign In / Join" },
      { tab: "faq", label: "FAQ" },
    ],
  },
  {
    title: "Platforms",
    links: [
      { tab: "p-telegram", label: "Telegram" },
      { tab: "p-instagram", label: "Instagram" },
      { tab: "p-youtube", label: "YouTube" },
      { tab: "p-twitter", label: "Twitter / X" },
      { tab: "p-tiktok", label: "TikTok" },
      { tab: "p-spotify", label: "Spotify" },
    ],
  },
  {
    title: "Developers",
    links: [
      { tab: "api", label: "API Documentation" },
      { tab: "playground", label: "API Playground" },
      { tab: "status", label: "System Status" },
      { tab: "changelog", label: "Changelog" },
    ],
  },
  {
    title: "Company & Legal",
    links: [
      { tab: "about", label: "About" },
      { tab: "reviews", label: "Reviews" },
      { tab: "support", label: "Support" },
      { tab: "terms", label: "Terms of Service" },
      { tab: "privacy", label: "Privacy Policy" },
      { tab: "refunds", label: "Refund Policy" },
      { tab: "security", label: "Security" },
    ],
  },
];

export default function Footer({ onNavigateTab, onOpenSupport }: FooterProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <footer className="border-t border-white/[0.08] bg-[#000000] text-zinc-400 relative z-10 pt-14 md:pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
        {/* ── Desktop: airy 5-column grid ── */}
        <div className="hidden md:grid lg:grid-cols-12 gap-10 lg:gap-14 pb-14 border-b border-white/[0.08]">
          <div className="lg:col-span-4 space-y-5">
            <a
              href={pathFor("home")}
              className="flex items-center gap-3 cursor-pointer group text-left"
              title="Back to home"
            >
              <SmmUpLogo size={36} />
              <span className="text-base sm:text-lg font-light tracking-[0.3em] text-[#FAF9F7] leading-none group-hover:text-white transition-colors">
                SMM UP
              </span>
            </a>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-sm">
              India's wholesale SMM panel, founded by Aryan. 0% fee UPI deposits, 2,100+ services
              with refill guarantees from 7 days to lifetime, and a standard reseller API.
            </p>
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-none border border-white/[0.1] bg-[#0A0A0A] text-zinc-300 text-[11px] font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              <span>All systems operational</span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="lg:col-span-2 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white font-mono">
                {col.title}
              </h4>
              <div className="flex flex-col space-y-2.5 text-xs">
                {col.links.map((l) => (
                  <a
                    key={l.tab}
                    href={pathFor(l.tab)}
                    className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Mobile: compact brand row + collapsible groups ── */}
        <div className="md:hidden pb-8 border-b border-white/[0.08]">
          <a
            href={pathFor("home")}
            className="flex items-center gap-3 mb-4 cursor-pointer"
            title="Back to home"
          >
            <SmmUpLogo size={30} />
            <span className="text-sm font-light tracking-[0.3em] text-[#FAF9F7] hover:text-white transition-colors">SMM UP</span>
          </a>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-5 max-w-xs">
            India's wholesale SMM panel — 0% fee UPI deposits, refill guarantees up to lifetime.
          </p>
          <div className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
            {COLUMNS.map((col) => {
              const isOpen = expanded === col.title;
              return (
                <div key={col.title}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : col.title)}
                    aria-expanded={isOpen}
                    className="w-full py-3.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-white font-mono cursor-pointer"
                  >
                    <span>{col.title}</span>
                    <span className={`text-zinc-500 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col space-y-2.5 pl-1 text-xs">
                        {col.links.map((l) => (
                          <a
                            key={l.tab}
                            href={pathFor(l.tab)}
                            className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {l.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Baseline bar ── */}
        <div className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-4 pr-12 sm:pr-0">
          <div className="text-[10px] sm:text-[11px] font-mono tracking-[0.18em] text-zinc-500 uppercase text-center sm:text-left">
            <span className="block">
              Founded &amp; Operated by <span className="text-zinc-300">Aryan</span> &bull; CEO &amp; Owner
            </span>
            <span className="block mt-1.5">
              &copy; 2026 SMM UP &bull; All rights reserved 
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={pathFor("support")}
              className="btn-up btn-up-ghost btn-up-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Support</span>
            </a>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="btn-up btn-up-ghost btn-up-sm"
              aria-label="Back to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Top</span>
            </button>
          </div>
        </div>
        </Reveal>
      </div>
    </footer>
  );
}
