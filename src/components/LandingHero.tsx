import React from "react";
import {
  ArrowRight,
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
  services: any[];
  onNavigateTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenTerms: () => void;
  totalServices: number;
}

interface PlatformCardDef {
  name: string;
  platformTab: string;
  icon: React.ComponentType<any>;
  regex: RegExp;
  unit: string;
  tag: string;
  desc: string;
}

const FEATURED_PLATFORMS: PlatformCardDef[] = [
  {
    name: "Telegram",
    platformTab: "p-telegram",
    icon: TelegramIcon,
    regex: /telegram|\btg\b/i,
    unit: "1K",
    tag: "High-Speed",
    desc: "Channel members, auto post views & reactions.",
  },
  {
    name: "Instagram",
    platformTab: "p-instagram",
    icon: InstagramIcon,
    regex: /instagram|\big\b|reels/i,
    unit: "1K",
    tag: "Non-Drop",
    desc: "Followers, reels views, likes & reach with refill.",
  },
  {
    name: "YouTube",
    platformTab: "p-youtube",
    icon: YouTubeIcon,
    regex: /youtube|\byt\b/i,
    unit: "1K",
    tag: "Monetizable",
    desc: "Watch time, views, subscribers & live viewers.",
  },
  {
    name: "Twitter / X",
    platformTab: "p-twitter",
    icon: TwitterXIcon,
    regex: /twitter|\bx\b|tweet/i,
    unit: "1K",
    tag: "Algorithmic",
    desc: "Followers, reposts, likes & impressions.",
  },
  {
    name: "TikTok",
    platformTab: "p-tiktok",
    icon: TikTokIcon,
    regex: /tiktok/i,
    unit: "1K",
    tag: "Viral Queue",
    desc: "Video views, followers, likes & shares.",
  },
  {
    name: "Spotify",
    platformTab: "p-spotify",
    icon: SpotifyIcon,
    regex: /spotify/i,
    unit: "1K",
    tag: "Royalties Safe",
    desc: "Streams, artist followers & monthly listeners.",
  },
];

const MARQUEE_PLATFORMS = [
  { name: "Telegram", icon: TelegramIcon, regex: /telegram|\btg\b/i },
  { name: "Instagram", icon: InstagramIcon, regex: /instagram|\big\b|reels/i },
  { name: "YouTube", icon: YouTubeIcon, regex: /youtube|\byt\b/i },
  { name: "Twitter / X", icon: TwitterXIcon, regex: /twitter|\bx\b|tweet/i },
  { name: "TikTok", icon: TikTokIcon, regex: /tiktok/i },
  { name: "Spotify", icon: SpotifyIcon, regex: /spotify/i },
  { name: "Facebook", icon: FacebookIcon, regex: /facebook|\bfb\b/i },
  { name: "Discord", icon: DiscordIcon, regex: /discord/i },
  { name: "LinkedIn", icon: LinkedInIcon, regex: /linkedin/i },
  { name: "WhatsApp", icon: WhatsAppIcon, regex: /whatsapp/i },
];

const STEPS = [
  {
    num: "01",
    title: "Create your account",
    desc: "Sign up in under 10 seconds with a username and password. No KYC, no phone verification, no personal documents.",
    icon: User,
  },
  {
    num: "02",
    title: "Add funds with 0% fee",
    desc: "Pay the QR with any UPI app and submit your 12-digit UTR number. Your balance credits automatically — every rupee you pay lands in your wallet.",
    icon: ExecutiveWalletIcon,
  },
  {
    num: "03",
    title: "Place orders",
    desc: "Paste a public link or username and confirm. Orders start fast and every service shows its real average delivery time upfront.",
    icon: ExecutiveOrderIcon,
  },
];

function minRateFor(services: any[], regex: RegExp): number | null {
  let min = Infinity;
  let found = false;
  for (const s of services) {
    if (regex.test(`${s.category} ${s.name}`)) {
      const r = Number(s.rate);
      if (!isNaN(r) && r > 0 && r < min) min = r;
      found = true;
    }
  }
  return found && min !== Infinity ? min : null;
}

export default function LandingHero({
  user,
  services,
  onNavigateTab,
  onOpenAuth,
  onOpenWallet,
  onOpenTerms,
}: LandingHeroProps) {
  // Quick-Access auth state
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

      setAuthSuccess(authMode === "login" ? "Signed in. Redirecting…" : "Account created. Redirecting…");
      setTimeout(() => {
        window.location.reload();
      }, 550);
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
        <div className="animate-glow-breath absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] max-w-4xl h-[60%] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-14 md:pb-20">
          {/* Status pill */}
          <div className="animate-hero-1 inline-flex items-center px-4 sm:px-5 py-2 rounded-full border border-white/[0.10] bg-white/[0.02] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(0,0,0,0.4)] text-zinc-300 text-[9px] sm:text-[10px] font-mono tracking-[0.18em] sm:tracking-[0.22em] uppercase">
            All systems live &bull; 0% deposit fee
          </div>

          {/* Two-line headline */}
          <h1 className="relative z-10 leading-[1.04] mt-8">
            <span className="animate-hero-2 block text-4xl sm:text-6xl md:text-7xl font-light tracking-[0.10em] uppercase text-zinc-400">
              Scale social
            </span>
            <span className="animate-hero-3 block mt-3 sm:mt-4 text-5xl sm:text-7xl md:text-8xl font-normal tracking-[0.22em] uppercase text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.42)]">
              SMM UP
            </span>
          </h1>

          {/* Subtitle */}
          <p className="animate-hero-4 mt-8 text-sm sm:text-base md:text-lg text-zinc-400 max-w-2xl mx-auto font-light tracking-wide leading-relaxed">
            India's wholesale SMM panel. Direct 0% fee UPI deposits,{" "}
            {services.length > 0 ? services.length.toLocaleString() : "2,000"}+ services
            with refill guarantees from 7 days to lifetime, and a standard reseller API.
          </p>

          {/* CTAs */}
          <div className="animate-hero-5 mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <button
              onClick={() => onNavigateTab("order")}
              className="btn-up btn-up-solid group"
            >
              <ExecutiveOrderIcon size={16} />
              <span>Place an Order</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigateTab("catalog")}
              className="btn-up btn-up-ghost"
            >
              <ExecutiveCatalogIcon size={16} />
              <span>Browse Services &amp; Prices</span>
            </button>
          </div>

        </div>
      </section>

      {/* ── 2. QUICK ACCESS — left blank (reserved), card right-aligned ── */}
      <section className="relative py-16 md:py-24 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-14 items-start">
            {/* Left column intentionally empty — reserved for the upcoming live board */}
            <div className="hidden lg:block" aria-hidden="true" />

            {/* Right: Quick Access card */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
              <Reveal>
                <div className="text-center lg:text-left mb-7">
                  <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
                    Member Access
                  </span>
                  <h2 className="text-xl sm:text-2xl font-light tracking-[0.10em] text-white uppercase">
                    Quick Access
                  </h2>
                  <div className="w-12 h-px bg-white/20 mt-4 mx-auto lg:mx-0" />
                </div>
              </Reveal>

              <Reveal delay={120}>
                {user ? (
                  <div className="p-8 sm:p-10 rounded-none border border-white/12 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
                    <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-none bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-200">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">
                            SIGNED IN
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

                    <div className="p-5 rounded-none border border-white/[0.08] bg-black/60 mb-6 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                          Wallet Balance
                        </span>
                        <span className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                          {formatINR(user.balance)}
                        </span>
                      </div>
                      <button onClick={onOpenWallet} className="btn-up btn-up-ghost btn-up-sm">
                        <ExecutiveWalletIcon size={14} />
                        <span>Add Funds</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={() => onNavigateTab("order")}
                        className="btn-up btn-up-solid w-full"
                      >
                        <ExecutiveOrderIcon size={15} />
                        <span>Place New Order</span>
                      </button>
                      <button
                        onClick={() => onNavigateTab("logs")}
                        className="btn-up btn-up-ghost w-full"
                      >
                        <span>View Order History</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 rounded-none border border-white/12 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative">
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

                    <form key={authMode} onSubmit={handleEmbeddedAuth} className="space-y-4 form-swap">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                          {authMode === "login" ? "Username or Email" : "Username"}
                        </label>
                        <input
                          type="text"
                          required
                          value={authIdentifier}
                          onChange={(e) => setAuthIdentifier(e.target.value)}
                          placeholder={authMode === "login" ? "Enter username or email" : "Choose a unique username"}
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
                            placeholder="you@example.com"
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
                          ? "Connecting…"
                          : authMode === "login"
                          ? "Sign In"
                          : "Create Free Account"}
                      </button>
                    </form>

                    <div className="pt-4 mt-4 border-t border-white/[0.06] text-center">
                      <p className="text-[11px] text-zinc-500">
                        100% free &bull; No social media passwords ever needed.
                      </p>
                    </div>
                  </div>
                )}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. LIVE RATE MARQUEE (dynamic from catalog) ── */}
      <section className="border-y border-white/[0.06] bg-[#0a0a0a]/60 py-5 overflow-hidden marquee-mask select-none" aria-hidden="true">
        <div className="flex w-max animate-marquee items-center">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center shrink-0">
              {MARQUEE_PLATFORMS.map((item, idx) => {
                const Icon = item.icon;
                const rate = minRateFor(services, item.regex);
                return (
                  <div key={idx} className="flex items-center gap-2.5 px-6 sm:px-8 shrink-0">
                    <Icon size={16} className="shrink-0" />
                    <span className="text-xs font-semibold tracking-wider text-zinc-300 uppercase whitespace-nowrap">
                      {item.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">
                      {rate !== null ? `from ${formatINR(rate)} / 1K` : "live rates"}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20 ml-6 shrink-0" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. LIVE NUMBERS (real data only) ── */}
      <section className="border-b border-white/[0.08] bg-[#0a0a0a]/80 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                value: services.length > 0 ? `${services.length.toLocaleString()}+` : "2,000+",
                label: "Live Services",
              },
              {
                value: "10",
                label: "Platforms Covered",
              },
              {
                value: "0%",
                label: "Deposit Fee",
              },
              {
                value: "7D — ∞",
                label: "Refill Windows",
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

      {/* ── 5. PLATFORM SHOWCASE (dynamic minimum rates) ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
                Platforms
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white">
                SUPPORTED SOCIAL PLATFORMS
              </h2>
              <div className="w-16 h-px bg-white/20 mx-auto mt-4" />
              <p className="text-xs sm:text-sm text-zinc-500 mt-4 max-w-xl mx-auto font-light">
                Starting rates below are live — the true current minimum from the catalog.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {FEATURED_PLATFORMS.map((platform, idx) => {
              const Icon = platform.icon;
              const liveMin = minRateFor(services, platform.regex);
              return (
                <Reveal key={idx} delay={idx * 70}>
                  <div
                    onClick={() => onNavigateTab(platform.platformTab)}
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
                        {liveMin !== null ? (
                          <span className="text-xs sm:text-sm font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                            {formatINR(liveMin)} <span className="text-[9px] sm:text-[10px] text-zinc-500 font-normal">/ {platform.unit}</span>
                          </span>
                        ) : (
                          <span className="inline-block skeleton h-4 w-16 rounded-none" />
                        )}
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

      {/* ── 6. HOW IT WORKS ── */}
      <section className="py-20 md:py-28 border-t border-white/[0.08] bg-[#0a0a0a]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
                Getting started
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white">
                HOW IT WORKS
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

          {onOpenTerms && (
            <Reveal delay={300}>
              <div className="text-center mt-10">
                <button
                  onClick={() => onNavigateTab("terms")}
                  className="text-xs text-zinc-500 hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
                >
                  Read the Terms of Service &amp; refill rules
                </button>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
