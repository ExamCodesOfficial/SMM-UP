import React from "react";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw,
  Wallet,
  Play,
  CheckCircle2,
  Lock,
  Sparkles,
  Layers,
  Clock,
  User,
  ArrowUpRight,
} from "lucide-react";
import { formatINR } from "../lib/utils";
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
      {/* ── 1. CINEMATIC HERO SECTION (Expansive Whitespace & Negative Space) ── */}
      <section className="relative pt-20 pb-20 md:pt-28 md:pb-28 lg:pt-36 lg:pb-36 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Content Column (7 cols): Majestic Typography & Pacing (Centered on mobile, left-aligned on desktop) */}
            <div className="lg:col-span-7 text-center lg:text-left space-y-6">
              {/* Protocol Status Pill in ExamCodes Style */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/[0.08] bg-[#0E0D0B]/80 text-[#F5E8D0] text-[11px] font-mono tracking-wider uppercase shadow-[0_0_20px_rgba(245,232,208,0.06)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5E8D0] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5E8D0]" />
                </span>
                <span>Wholesale Protocol Initialized &bull; 0% UPI Clearing</span>
              </div>

              {/* Streamlined Monolithic Motto: SMM UP ENGINE with Centered Atmospheric Backlight */}
              <div className="relative inline-block py-2">
                {/* Atmospheric Backlight Bloom (Radiates softly from BEHIND the text) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[160%] bg-gradient-to-r from-transparent via-[#F5E8D0]/12 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-80 h-16 sm:h-28 bg-white/[0.08] rounded-full blur-2xl pointer-events-none -z-10" />

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.14em] sm:tracking-[0.18em] uppercase leading-tight text-white relative z-10">
                  <span className="text-[#FAF7F2] font-normal drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                    SMM UP ENGINE
                  </span>
                </h1>
              </div>

              {/* Spacious Subtitle with wide tracking (Centered on mobile, left on desktop) */}
              <p className="text-sm sm:text-base md:text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 font-light tracking-wide leading-relaxed pt-1">
                Institutional direct-to-node social marketing infrastructure. Direct 0% fee bank UPI clearing, 2,177+ wholesale channels, and automated 30-day retention refill protection.
              </p>

              {/* Action Buttons with Negative Space (Centered on mobile, left on desktop) */}
              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => onNavigateTab("store")}
                  className="px-8 py-4 rounded-xl bg-white text-black font-bold tracking-[0.14em] text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <ExecutiveOrderIcon size={16} />
                  <span>Launch Order Desk</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => onNavigateTab("services")}
                  className="px-8 py-4 rounded-xl border border-white/20 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/40 text-white font-semibold tracking-[0.12em] text-xs uppercase transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <ExecutiveCatalogIcon size={16} />
                  <span>Browse 2,177 Services</span>
                </button>
              </div>

              {/* Micro Trust Indicators (Centered on mobile, left on desktop) */}
              <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-zinc-400 font-light border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#F5E8D0]" />
                  <span>Zero Password Requirement</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#F5E8D0]" />
                  <span>30-Day Auto Refill SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#F5E8D0]" />
                  <span>Sub-Second API Provisioning</span>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Embedded Quick-Access Portal / Live Station */}
            <div className="lg:col-span-5">
              {user ? (
                /* Authenticated Operative Dashboard Card */
                <div className="p-8 sm:p-10 rounded-2xl border border-white/15 bg-[#0E0D0B]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#F5E8D0]/[0.03] rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#F5E8D0]">
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
                    <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded border border-white/10 bg-white/[0.02]">
                      SESSION ACTIVE
                    </span>
                  </div>

                  {/* Balance Display */}
                  <div className="p-5 rounded-xl border border-white/[0.08] bg-black/60 mb-6 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                        Available Balance
                      </span>
                      <span className="text-2xl font-bold text-[#FFFDF9] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                        {formatINR(user.balance)}
                      </span>
                    </div>
                    <button
                      onClick={onOpenWallet}
                      className="px-4 py-2 rounded-xl border border-[#F5E8D0]/30 bg-[#F5E8D0]/10 hover:bg-[#F5E8D0]/20 text-[#F5E8D0] font-semibold text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExecutiveWalletIcon size={14} />
                      <span>Deposit 0%</span>
                    </button>
                  </div>

                  {/* Fast Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={() => onNavigateTab("store")}
                      className="w-full py-3.5 px-6 rounded-xl bg-white text-black font-bold tracking-[0.12em] text-xs uppercase hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExecutiveOrderIcon size={15} />
                      <span>Enter New Order Desk</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("orders")}
                      className="w-full py-3 px-6 rounded-xl border border-white/10 hover:bg-white/[0.04] text-zinc-300 hover:text-white font-medium text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>View Live Order History</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Unauthenticated Quick-Access Auth Card */
                <div className="p-6 sm:p-8 rounded-2xl border border-white/15 bg-[#0E0D0B]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative">
                  {/* Card Tab Header */}
                  <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
                    <div className="flex items-center gap-2">
                      <SmmUpLogo size={28} />
                      <span className="text-xs font-semibold tracking-wider text-white uppercase">
                        Quick Access
                      </span>
                    </div>

                    <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          setAuthError("");
                          setAuthSuccess("");
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer ${
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
                        className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wider transition-all cursor-pointer ${
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
                        className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/60 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-white/40 transition-colors"
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
                          className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/60 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-white/40 transition-colors"
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
                        className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-black/60 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-white/40 transition-colors"
                      />
                    </div>

                    {authError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                        {authError}
                      </div>
                    )}

                    {authSuccess && (
                      <div className="p-3 rounded-xl bg-[#F5E8D0]/10 border border-[#F5E8D0]/20 text-[#FAF7F2] text-xs">
                        {authSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3 px-6 rounded-xl bg-white text-black font-bold tracking-[0.12em] text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 cursor-pointer"
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
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. LIVE TELEMETRY COUNTER BAR (ExamCodes LiveStatsBar) ── */}
      <section className="border-y border-white/[0.08] bg-[#0E0D0B]/80 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-black/40 text-center">
              <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-[#FAF7F2] block mb-1 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                {totalServices.toLocaleString()}+
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-zinc-400 font-bold uppercase">
                Active Wholesale Services
              </span>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-black/40 text-center">
              <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-[#F5E8D0] block mb-1 drop-shadow-[0_0_12px_rgba(245,232,208,0.25)]">
                0%
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-zinc-400 font-bold uppercase">
                Gateway Surcharge Fee
              </span>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-black/40 text-center">
              <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-white block mb-1 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                0 — 15m
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-zinc-400 font-bold uppercase">
                Average Start Speed
              </span>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-black/40 text-center">
              <span className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-white block mb-1 drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                99.98%
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-[0.25em] text-zinc-400 font-bold uppercase">
                Node Dispatch Uptime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. PLATFORM ECOSYSTEM SHOWCASE ── */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase block mb-2">
              Supported Delivery Networks
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-[#FAF7F2]">
              GLOBAL SOCIAL REACH CHANNELS
            </h2>
            <div className="w-16 h-0.5 bg-white/20 mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {FEATURED_PLATFORMS.map((platform, idx) => {
              const Icon = platform.icon;
              return (
                <div
                  key={idx}
                  onClick={() => onNavigateTab("services")}
                  className="p-3.5 sm:p-7 rounded-2xl border border-white/[0.08] bg-[#0E0D0B]/85 hover:border-[#F5E8D0]/30 transition-all duration-300 flex flex-col justify-between group shadow-[0_4px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 sm:mb-5">
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon size={18} className="sm:hidden" />
                        <Icon size={24} className="hidden sm:block" />
                      </div>
                      <span className="hidden sm:inline-block text-[10px] font-mono font-medium text-[#F5E8D0] px-2.5 py-1 rounded-full border border-[#F5E8D0]/20 bg-[#F5E8D0]/5">
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
                      <span className="text-xs sm:text-sm font-bold text-[#FFFDF9] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                        {platform.startRate} <span className="text-[9px] sm:text-[10px] text-[#F5E8D0] font-normal">/ {platform.unit}</span>
                      </span>
                    </div>

                    <div className="hidden sm:flex px-3 py-1 rounded-lg border border-white/15 bg-white/[0.02] group-hover:bg-white text-zinc-300 group-hover:text-black font-semibold text-xs tracking-wider transition-all items-center gap-1">
                      <span>Explore</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS (01, 02, 03 Step Cards in ExamCodes Style) ── */}
      <section className="py-16 md:py-24 border-t border-white/[0.08] bg-[#0E0D0B]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase block mb-2">
              Execution Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-[#FAF7F2]">
              THREE STEPS TO MASS SCALE
            </h2>
            <div className="w-16 h-0.5 bg-white/20 mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-2xl border border-white/[0.08] bg-[#0E0D0B]/85 hover:border-[#F5E8D0]/30 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-2xl sm:text-3xl font-light font-mono text-[#F5E8D0]">
                        {step.num}
                      </span>
                      <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-[#FAF7F2]">
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
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
