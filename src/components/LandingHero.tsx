import React from "react";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw,
  User,
} from "lucide-react";
import { formatINR } from "../lib/utils";
import Reveal from "./Reveal";
import {
  SmmUpLogo,
  ExecutiveOrderIcon,
  ExecutiveCatalogIcon,
  ExecutiveWalletIcon,
} from "./icons/ExecutiveIcons";
import {
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  FacebookIcon,
  TwitterXIcon,
  TikTokIcon,
  SpotifyIcon,
  DiscordIcon,
  LinkedInIcon,
  WhatsAppIcon,
} from "./icons/PlatformIcons";

interface LandingHeroProps {
  user: any;
  onNavigateTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenTerms: () => void;
  totalServices: number;
}

const FEATURED_PLATFORMS = [
  {
    name: "Telegram",
    icon: TelegramIcon,
    startRate: "₹0.04",
    unit: "1K Views",
    tag: "High-Speed",
    desc: "Instant channel members, auto post views & emojis reactions.",
  },
  {
    name: "Instagram",
    icon: InstagramIcon,
    startRate: "₹4.80",
    unit: "1K Likes",
    tag: "Non-Drop",
    desc: "Active Indian & global reach, reels views, followers & shares.",
  },
  {
    name: "YouTube",
    icon: YouTubeIcon,
    startRate: "₹45.00",
    unit: "1K Views",
    tag: "Monetizable",
    desc: "AdWords views, watch time, subscribers & live stream viewers.",
  },
  {
    name: "Twitter / X",
    icon: TwitterXIcon,
    startRate: "₹18.50",
    unit: "1K Engagements",
    tag: "Algorithmic",
    desc: "Retweets, quote retweets, poll votes & active impressions.",
  },
  {
    name: "TikTok",
    icon: TikTokIcon,
    startRate: "₹0.90",
    unit: "1K Plays",
    tag: "Viral Queue",
    desc: "High retention video plays, shares, saves & profile followers.",
  },
  {
    name: "Spotify",
    icon: SpotifyIcon,
    startRate: "₹38.00",
    unit: "1K Streams",
    tag: "Royalties Safe",
    desc: "Targeted playlist plays, artist followers & monthly listeners.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "INSTANT ACCESS",
    desc: "Register in under 10 seconds with username and password. No KYC, no phone verification, zero personal friction.",
    icon: User,
  },
  {
    num: "02",
    title: "DIRECT 0% UPI",
    desc: "Scan the auto-generated QR via any UPI app. Submit your 12-digit UTR for automated, zero-fee wallet credit.",
    icon: ExecutiveWalletIcon,
  },
  {
    num: "03",
    title: "DISPATCH ORDERS",
    desc: "Paste public handle or post link and confirm. Orders pass directly into high-velocity wholesale delivery queues.",
    icon: ExecutiveOrderIcon,
  },
];

/* Infinite marquee payload: every delivery network + starting rate */
const MARQUEE_ITEMS = [
  { name: "Telegram", icon: TelegramIcon, rate: "₹0.04 / 1K" },
  { name: "Instagram", icon: InstagramIcon, rate: "₹4.80 / 1K" },
  { name: "YouTube", icon: YouTubeIcon, rate: "₹45.00 / 1K" },
  { name: "Twitter / X", icon: TwitterXIcon, rate: "₹18.50 / 1K" },
  { name: "TikTok", icon: TikTokIcon, rate: "₹0.90 / 1K" },
  { name: "Spotify", icon: SpotifyIcon, rate: "₹38.00 / 1K" },
  { name: "Facebook", icon: FacebookIcon, rate: "₹12.00 / 1K" },
  { name: "Discord", icon: DiscordIcon, rate: "₹22.00 / 1K" },
  { name: "LinkedIn", icon: LinkedInIcon, rate: "₹95.00 / 1K" },
  { name: "WhatsApp", icon: WhatsAppIcon, rate: "₹55.00 / 1K" },
];

export default function LandingHero({
  user,
  onNavigateTab,
  onOpenAuth,
  onOpenWallet,
  onOpenTerms,
  totalServices,
}: LandingHeroProps) {
  // Quick Embedded Auth State (for the home page login card)
  const [authMode, setAuthMode] = React.useState<"login" | "register">("login");
  const [authIdentifier, setAuthIdentifier] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState("");
  const [authSuccess, setAuthSuccess] = React.useState("");

  const handleEmbeddedAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { identifier: authIdentifier, password: authPassword }
          : { username: authIdentifier, email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        setAuthLoading(false);
        return;
      }

      setAuthSuccess(authMode === "login" ? "Welcome back!" : "Account created successfully!");
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="relative z-10">
      {/* ── 1. CINEMATIC HERO — fullscreen, centered, pure monochrome ── */}
      <section className="relative min-h-[92svh] md:min-h-[100svh] flex items-center justify-center overflow-hidden">
        {/* Architectural grid + fade mask */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid-fade pointer-events-none" />
        {/* White backlight bloom behind the headline */}
        <div className="animate-glow-breath absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] max-w-4xl h-[60%] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 sm:w-96 h-24 sm:h-36 bg-white/[0.05] rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-28 md:pb-20">
          {/* Protocol status pill — hairline, mono, white */}
          <div className="animate-hero-1 inline-flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-1.5 rounded-none border border-white/15 bg-white/[0.03] text-zinc-200 text-[9px] sm:text-[10px] font-mono tracking-[0.14em] sm:tracking-[0.2em] uppercase">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span>Wholesale Protocol Initialized &bull; 0% UPI Clearing</span>
          </div>

          {/* Two-line monolithic headline */}
          <h1 className="relative z-10 leading-[1.04] mt-8">
            <span className="animate-hero-2 block text-4xl sm:text-6xl md:text-7xl font-light tracking-[0.10em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-500">
              Scale Social
            </span>
            <span className="animate-hero-3 block mt-3 sm:mt-4 text-3xl sm:text-5xl md:text-6xl font-normal tracking-[0.22em] uppercase text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.42)]">
              SMM UP Engine
            </span>
          </h1>

          {/* Subtitle */}
          <p className="animate-hero-4 mt-8 text-sm sm:text-base md:text-lg text-zinc-400 max-w-2xl mx-auto font-light tracking-wide leading-relaxed">
            Institutional direct-to-node social marketing infrastructure.
            Direct 0% fee bank UPI clearing, 2,177+ wholesale channels, and
            automated retention refill protection (7D to Lifetime SLA).
          </p>

          {/* Sharp tactile CTAs */}
          <div className="animate-hero-5 mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <button
              onClick={() => onNavigateTab("store")}
              className="btn-up btn-up-solid group"
            >
              <ExecutiveOrderIcon size={16} />
              <span>Launch Order Desk</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateTab("services")}
              className="btn-up btn-up-ghost"
            >
              <ExecutiveCatalogIcon size={16} />
              <span>Browse 2,177 Services</span>
            </button>
          </div>

          {/* Micro trust indicators */}
          <div className="animate-hero-5 mt-10 sm:mt-12 pt-6 sm:pt-8 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-3 text-[11px] sm:text-xs text-zinc-500 font-light border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <span>Zero Password Requirement</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-zinc-400" />
              <span>Automated Node Refill SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-zinc-400" />
              <span>Sub-Second API Provisioning</span>
            </div>
          </div>
          </div>

        {/* Scroll cue — single drawing line */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-zinc-600 animate-hero-5">
          <div className="w-px h-10 bg-white/10 overflow-hidden">
            <div className="scroll-cue-line w-px h-full bg-white/70" />
          </div>
          <span className="text-[9px] tracking-[0.3em] uppercase font-mono">Scroll</span>
        </div>
      </section>

      {/* ── 1.5 QUICK ACCESS TERMINAL — below the hero, centered ── */}
      <section className="relative py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-md mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-8">
              <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
                Operator Terminal
              </span>
              <h2 className="text-xl sm:text-2xl font-light tracking-[0.10em] text-white uppercase">
                Quick Access
              </h2>
              <div className="w-12 h-px bg-white/20 mx-auto mt-4" />
            </div>
          </Reveal>

          <Reveal delay={120}>
            {user ? (
              /* Authenticated Operative Dashboard Card */
              <div className="p-8 sm:p-10 rounded-none border border-white/12 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.02] rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-none bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-200">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">
                        AUTHENTICATED OPERATIVE
                      </span>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {user.username}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-none border border-white/10 bg-white/[0.02]">
                    SESSION ACTIVE
                  </span>
                </div>

                {/* Balance Display */}
                <div className="p-5 rounded-none border border-white/[0.08] bg-black/60 mb-6 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                      Available Balance
                    </span>
                    <span className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                      {formatINR(user.balance)}
                    </span>
                  </div>
                  <button
                    onClick={onOpenWallet}
                    className="btn-up btn-up-ghost btn-up-sm"
                  >
                    <ExecutiveWalletIcon size={14} />
                    <span>Deposit 0%</span>
                  </button>
                </div>

                {/* Fast Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => onNavigateTab("store")}
                    className="btn-up btn-up-solid w-full"
                  >
                    <ExecutiveOrderIcon size={15} />
                    <span>Enter New Order Desk</span>
                  </button>
                  <button
                    onClick={() => onNavigateTab("orders")}
                    className="btn-up btn-up-ghost w-full"
                  >
                    <span>View Live Order History</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Unauthenticated Quick-Access Auth Card */
              <div className="p-6 sm:p-8 rounded-none border border-white/12 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative">
                {/* Card Tab Header */}
                <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
                  <div className="flex items-center gap-2">
                    <SmmUpLogo size={28} />
                    <span className="text-xs font-semibold tracking-wider text-white uppercase">
                      Sign In
                    </span>
                  </div>

                  <div className="flex items-center rounded-none bg-black/60 p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError("");
                        setAuthSuccess("");
                      }}
                      className={`px-3 py-1 rounded-none text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                        authMode === "login"
                          ? "bg-white text-black shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      SIGN IN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        setAuthError("");
                        setAuthSuccess("");
                      }}
                      className={`px-3 py-1 rounded-none text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                        authMode === "register"
                          ? "bg-white text-black shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      SIGN UP
                    </button>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleEmbeddedAuth} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                      {authMode === "login" ? "Username or Email" : "Username"}
                    </label>
                    <input
                      type="text"
                      required
                      value={authIdentifier}
                      onChange={(e) => setAuthIdentifier(e.target.value)}
                      placeholder={authMode === "login" ? "Enter username or email" : "Choose username"}
                      className="up-input"
                    />
                  </div>

                  {authMode === "register" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="client@domain.com"
                        className="up-input"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="up-input"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 rounded-none bg-white/[0.04] border border-white/15 text-zinc-200 text-xs">
                      {authError}
                    </div>
                  )}

                  {authSuccess && (
                    <div className="p-3 rounded-none bg-white/[0.06] border border-white/20 text-white text-xs">
                      {authSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="btn-up btn-up-solid w-full"
                  >
                    {authLoading
                      ? "Connecting..."
                      : authMode === "login"
                      ? "Sign In"
                      : "Create Free Account"}
                  </button>
                </form>

                <div className="pt-4 mt-4 border-t border-white/[0.06] text-center">
                  <p className="text-[11px] text-zinc-500">
                    100% Free &bull; No social media passwords ever needed.
                  </p>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── 2. PLATFORM RATE MARQUEE (Infinite Cinematic Ticker) ── */}
      <section className="border-y border-white/[0.06] bg-[#0a0a0a]/60 py-5 overflow-hidden marquee-mask select-none" aria-hidden="true">
        <div className="flex w-max animate-marquee items-center">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center shrink-0">
              {MARQUEE_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center gap-2.5 px-6 sm:px-8 shrink-0">
                    <Icon size={16} className="shrink-0" />
                    <span className="text-xs font-semibold tracking-wider text-zinc-300 uppercase whitespace-nowrap">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">
                      from {item.rate}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20 ml-6 shrink-0" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. LIVE TELEMETRY COUNTER BAR ── */}
      <section className="border-b border-white/[0.08] bg-[#0a0a0a]/80 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                value: `${totalServices.toLocaleString()}+`,
                label: "Active Wholesale Services",
              },
              {
                value: "0%",
                label: "Gateway Surcharge Fee",
              },
              {
                value: "0 — 15m",
                label: "Average Start Speed",
              },
              {
                value: "99.98%",
                label: "Node Dispatch Uptime",
              },
            ].map((stat, idx) => (
              <Reveal key={idx} delay={idx * 90}>
                <div className="card-lift p-5 sm:p-7 rounded-none border border-white/[0.06] bg-black/40 text-center h-full">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-white block mb-1.5 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                    {stat.value}
                  </span>
                  <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-zinc-500 font-bold uppercase">
                    {stat.label}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PLATFORM ECOSYSTEM SHOWCASE ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
                Supported Delivery Networks
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white">
                GLOBAL SOCIAL REACH CHANNELS
              </h2>
              <div className="w-16 h-px bg-white/20 mx-auto mt-4" />
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {FEATURED_PLATFORMS.map((platform, idx) => {
              const Icon = platform.icon;
              return (
                <Reveal key={idx} delay={idx * 70}>
                  <div
                    onClick={() => onNavigateTab("services")}
                    className="card-lift h-full p-3.5 sm:p-7 rounded-none border border-white/[0.08] bg-[#0a0a0a]/85 hover:border-white/25 flex flex-col justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 sm:mb-5">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-none border border-white/10 bg-white/[0.03] flex items-center justify-center group-hover:scale-105 transition-transform text-zinc-200">
                          <Icon size={18} className="sm:hidden" />
                          <Icon size={24} className="hidden sm:block" />
                        </div>
                        <span className="hidden sm:inline-block text-[10px] font-mono font-medium text-zinc-400 px-2.5 py-1 rounded-none border border-white/15 bg-white/[0.03]">
                          {platform.tag}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2 truncate">
                        {platform.name}
                      </h3>
                      <p className="hidden sm:block text-xs text-zinc-400 leading-relaxed font-light mb-6">
                        {platform.desc}
                      </p>
                    </div>

                    <div className="pt-2.5 sm:pt-4 border-t border-white/[0.06] flex items-center justify-between">
                      <div>
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-wider block">Starts</span>
                        <span className="text-xs sm:text-sm font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                          {platform.startRate} <span className="text-[9px] sm:text-[10px] text-zinc-500 font-normal">/ {platform.unit}</span>
                        </span>
                      </div>

                      <div className="hidden sm:flex px-3 py-1 rounded-none border border-white/15 bg-white/[0.02] group-hover:bg-white text-zinc-300 group-hover:text-black font-semibold text-xs tracking-wider transition-all items-center gap-1">
                        <span>Explore</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS (01, 02, 03 Step Cards) ── */}
      <section className="py-20 md:py-28 border-t border-white/[0.08] bg-[#0a0a0a]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
                Execution Workflow
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white">
                THREE STEPS TO MASS SCALE
              </h2>
              <div className="w-16 h-px bg-white/20 mx-auto mt-4" />
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <Reveal key={idx} delay={idx * 100}>
                  <div className="card-lift h-full p-8 rounded-none border border-white/[0.08] bg-[#0a0a0a]/85 hover:border-white/25 flex flex-col justify-between relative overflow-hidden">
                    {/* Oversized ghost numeral in the corner */}
                    <span className="absolute -top-3 -right-1 text-[92px] leading-none font-mono font-light text-white/[0.03] select-none pointer-events-none">
                      {step.num}
                    </span>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-2xl sm:text-3xl font-light font-mono text-zinc-400">
                          {step.num}
                        </span>
                        <div className="w-10 h-10 rounded-none border border-white/10 bg-white/[0.03] flex items-center justify-center text-zinc-200">
                          <Icon size={20} />
                        </div>
                      </div>
                      <h3 className="text-base font-bold tracking-wide text-white mb-3">
                        {step.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Terms link under the workflow (quiet compliance surface) */}
          {onOpenTerms && (
            <Reveal delay={300}>
              <div className="text-center mt-10">
                <button
                  onClick={onOpenTerms}
                  className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                >
                  Review Service Terms &amp; SLA Standards
                </button>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
