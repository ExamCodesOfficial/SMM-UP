import React from "react";
import { ArrowUpRight, ShieldCheck, Zap, RotateCcw, ChevronUp, FileText, Lock, MessageCircle, Terminal } from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";
import {
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  TwitterXIcon,
  TikTokIcon,
  SpotifyIcon,
  FacebookIcon,
} from "./icons/PlatformIcons";

interface FooterProps {
  onNavigateTab: (tab: string) => void;
  onOpenTerms: () => void;
  onOpenWallet: () => void;
  onOpenSupport?: () => void;
}

const PLATFORMS = [
  { name: "Telegram", icon: TelegramIcon, rate: "From ₹0.04" },
  { name: "Instagram", icon: InstagramIcon, rate: "From ₹4.80" },
  { name: "YouTube", icon: YouTubeIcon, rate: "From ₹45.00" },
  { name: "Twitter / X", icon: TwitterXIcon, rate: "From ₹18.50" },
  { name: "TikTok", icon: TikTokIcon, rate: "From ₹0.90" },
  { name: "Spotify", icon: SpotifyIcon, rate: "From ₹38.00" },
  { name: "Facebook", icon: FacebookIcon, rate: "From ₹12.00" },
];

export default function Footer({
  onNavigateTab,
  onOpenTerms,
  onOpenWallet,
  onOpenSupport,
}: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-white/[0.08] bg-[#000000] text-zinc-400 relative z-10 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Multi-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 pb-16 border-b border-white/[0.08]">
          {/* Column 1: Brand & Node Identity (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="flex items-center gap-3">
              <SmmUpLogo size={36} />
              <div>
                <span className="text-base sm:text-lg font-light tracking-[0.2em] text-[#FAF7F2] block leading-none">
                  SMM UP
                </span>
                <span className="text-[9px] tracking-[0.25em] text-[#8E877B] uppercase font-mono mt-1 block">
                  Wholesale Infrastructure
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-sm">
              Institutional direct-node social media marketing engine. Bank-direct 0% fee UPI instant clearing, 2,177+ wholesale channels, sub-second API dispatch, and automated multi-tier retention refill protection (7D to Lifetime SLA).
            </p>

            {/* Realtime Live Operational Status Pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/[0.1] bg-[#0E0D0B] text-[#F5E8D0] text-[11px] font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5E8D0] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5E8D0]" />
              </span>
              <span>All Delivery Nodes Operational &bull; 99.98% SLA</span>
            </div>
          </div>

          {/* Column 2: Supported Delivery Networks (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Supported Networks
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {PLATFORMS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      onNavigateTab("services");
                      scrollToTop();
                    }}
                    className="flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                        <Icon size={12} className="text-[#F5E8D0]" />
                      </div>
                      <span className="group-hover:translate-x-0.5 transition-transform">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#F5E8D0]/80">
                      {p.rate}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Platform Navigation (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Terminal Desk
            </h4>
            <div className="flex flex-col space-y-2.5 text-xs">
              <button
                onClick={() => {
                  onNavigateTab("home");
                  scrollToTop();
                }}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Home Terminal
              </button>
              <button
                onClick={() => {
                  onNavigateTab("store");
                  scrollToTop();
                }}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Order Desk
              </button>
              <button
                onClick={() => {
                  onNavigateTab("services");
                  scrollToTop();
                }}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Wholesale Catalog
              </button>
              <button
                onClick={() => {
                  onNavigateTab("mass");
                  scrollToTop();
                }}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Mass Order Engine
              </button>
              <button
                onClick={() => {
                  onNavigateTab("api");
                  scrollToTop();
                }}
                className="text-left text-[#F5E8D0] hover:text-white transition-colors cursor-pointer font-medium flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5 text-[#F5E8D0]" />
                <span>Developer API</span>
              </button>
              <button
                onClick={() => {
                  onOpenWallet();
                }}
                className="text-left text-[#F5E8D0] hover:text-white transition-colors cursor-pointer font-medium"
              >
                Wallet Top-Up (0% UPI)
              </button>
              {onOpenSupport && (
                <button
                  onClick={onOpenSupport}
                  className="text-left text-[#F5E8D0] hover:text-white transition-colors cursor-pointer font-medium flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#F5E8D0]" />
                  <span>24/7 Telegram Support</span>
                </button>
              )}
              <button
                onClick={() => {
                  onNavigateTab("orders");
                  scrollToTop();
                }}
                className="text-left text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Live Order Logs
              </button>
            </div>
          </div>

          {/* Column 4: SLA & Guarantees (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white font-mono">
              Policies &amp; Support
            </h4>
            <div className="space-y-3 text-xs">
              <button
                onClick={onOpenTerms}
                className="w-full text-left p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#F5E8D0]" />
                  <span className="text-white font-medium">Terms of Service &amp; SLA</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </button>

              {onOpenSupport && (
                <button
                  onClick={onOpenSupport}
                  className="w-full text-left p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">Chat on Telegram Desk</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
                </button>
              )}

              <div className="space-y-2 pt-1 text-[11px] text-zinc-400 font-light">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F5E8D0] shrink-0" />
                  <span>Direct 0% UPI Clearing Policy</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-[#F5E8D0] shrink-0" />
                  <span>Automated Node Refill SLA (7D to Lifetime)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#F5E8D0] shrink-0" />
                  <span>Zero Social Passwords Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#F5E8D0] shrink-0" />
                  <span>Standard SMM v2 API Protocol</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar (ExamCodes & thatonearyan-sh style) */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-[10px] sm:text-[11px] tracking-[0.2em] text-zinc-600 font-mono uppercase text-center sm:text-left">
            &copy; 2026 SMM UP &bull; ALL PROTOCOLS ENFORCED &bull; DIRECT BANK UPI CLEARING
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white text-[11px] font-mono tracking-wider transition-colors cursor-pointer"
          >
            <span>BACK TO TOP</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
