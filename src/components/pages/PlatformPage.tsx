import React from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, RotateCcw, ChevronDown } from "lucide-react";
import { pathFor } from "../../lib/routes";
import ContentPage, { H2, P, Callout } from "../ContentPage";
import Reveal from "../Reveal";
import { formatINR } from "../../lib/utils";
import {
  TelegramIcon,
  InstagramIcon,
  YouTubeIcon,
  TwitterXIcon,
  TikTokIcon,
  SpotifyIcon,
} from "../icons/PlatformIcons";

export interface PlatformConfig {
  tab: string;
  slug: string;
  name: string;
  icon: React.ComponentType<any>;
  regex: RegExp;
  headline: string;
  intro: string;
  services: string[];
  why: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
}

export const PLATFORM_PAGES: PlatformConfig[] = [
  {
    tab: "p-telegram",
    slug: "telegram-smm-panel",
    name: "Telegram",
    icon: TelegramIcon,
    regex: /telegram|\btg\b/i,
    headline: "Telegram SMM Panel for Channels & Groups",
    intro:
      "SMM UP is a Telegram-focused SMM panel built for Indian channel owners, resellers and agencies. Order channel members, group members, post views and reactions at current displayed rates — paid through Direct UPI with a 0% platform fee, with service-specific delivery estimates and refill terms shown before ordering.",
    services: [
      "Channel & group members (Indian and global mixes)",
      "Auto post views — future posts included",
      "Reactions (positive emoji packs)",
      "Poll votes for public votes",
      "Post shares & forwards",
      "Premium-quality members with longer retention",
    ],
    why: [
      { title: "Visible current rate", desc: "The current catalog rate and full order charge are shown before confirmation." },
      { title: "Listing-specific terms", desc: "Compare the description, delivery estimate and any refill window before choosing a service." },
      { title: "Future-post options", desc: "When a listing supports auto-views, its description defines which future posts and duration are covered." },
    ],
    faq: [
      { q: "Is buying Telegram members safe for my channel?", a: "SMM UP needs only the supported public target and never asks for channel admin credentials. Delivery pattern and platform risk vary by service; Telegram retains control over moderation and authenticity enforcement." },
      { q: "Do members drop after delivery?", a: "Drops can occur. A service that includes refill coverage shows its window in the listing; use Order History to submit a request and follow the supplier-confirmed status." },
      { q: "Can you add members to a private group?", a: "SMM UP accepts only the public target formats supported by the selected listing. Do not submit private or inaccessible targets." },
      { q: "How fast do post views start?", a: "Timing varies by auto-view package and supplier load. Review the current estimate on the service card and track the resulting order status." },
    ],
  },
  {
    tab: "p-instagram",
    slug: "instagram-smm-panel",
    name: "Instagram",
    icon: InstagramIcon,
    regex: /instagram|\big\b|reels/i,
    headline: "Instagram SMM Panel — Followers, Likes & Reels Views",
    intro:
      "Grow Instagram profiles with wholesale-rate followers, likes, reels views, story views and saves. SMM UP is an Indian Instagram SMM panel with UPI deposits at 0% fee, current service-specific delivery estimates and any applicable refill terms.",
    services: [
      "Followers (standard, high-quality and non-drop tiers)",
      "Post likes — service-specific delivery patterns",
      "Reels & video views with reach",
      "Story views (all active stories)",
      "Saves, shares, comments and impressions",
      "Profile visits and reach boosters",
    ],
    why: [
      { title: "Comparable listings", desc: "Use the visible description, limits, estimate and refill terms to compare service tiers." },
      { title: "Visible refill terms", desc: "Eligible listings show their refill window; submit and track the request from Order History." },
      { title: "Service-specific timing", desc: "Start and completion patterns depend on the selected listing and current supplier capacity." },
    ],
    faq: [
      { q: "Will Instagram ban my account?", a: "We never ask for your Instagram password, which protects account credentials. No third-party service can guarantee zero moderation risk; follow Instagram rules and review each listing before ordering." },
      { q: "What's the difference between follower tiers?", a: "Tier labels and characteristics vary by listing. Compare the exact description, rate, delivery estimate and refill window rather than assuming a label guarantees engagement or retention." },
      { q: "Do reels views count as monetisable reach?", a: "Views register on the reel like organic reach, but Instagram's monetization eligibility follows its own rules. No panel can promise payouts." },
      { q: "How do refills work on Instagram?", a: "If the listing includes refill coverage, submit a request from Order History. Supplier eligibility and completion are reflected in the resulting status." },
    ],
  },
  {
    tab: "p-youtube",
    slug: "youtube-smm-panel",
    name: "YouTube",
    icon: YouTubeIcon,
    regex: /youtube|\byt\b/i,
    headline: "YouTube SMM Panel — Views, Watch Time & Subscribers",
    intro:
      "SMM UP lists YouTube views, watch-time, subscriber, like and live-viewer services with current rates and Direct UPI funding at a 0% platform fee. YouTube alone decides monetization, analytics validity and moderation outcomes.",
    services: [
      "Watch-time hours (long-form, monetization-oriented)",
      "Video views — standard and high-retention",
      "Subscribers (stable, refill-guaranteed)",
      "Likes and comment likes",
      "Live stream concurrent viewers",
      "Shorts views",
    ],
    why: [
      { title: "Listing-specific delivery", desc: "Each watch-time listing states its quantity model and current supplier delivery estimate." },
      { title: "Terms shown before purchase", desc: "Review the service description, limits, delivery estimate and refill terms before confirming." },
      { title: "Completion honesty", desc: "If a service cannot finish, its final counts are reviewed for the eligible wallet adjustment — never a blind retry." },
    ],
    faq: [
      { q: "Is buying YouTube watch time safe for monetization?", a: "No panel can guarantee analytics acceptance or monetization approval. YouTube makes those decisions after reviewing the channel, content and traffic. Review the exact listing and use only campaigns that comply with YouTube rules." },
      { q: "How long does 4,000 hours take?", a: "Timing varies by service and supplier capacity. Use the current estimate on the selected service card and track the accepted order." },
      { q: "Do subscribers drop?", a: "Subscriber counts can change during platform audits. If the selected listing includes refill coverage, submit a request within its stated window and track the supplier response." },
      { q: "Can I boost a live stream?", a: "Yes — concurrent-viewer services run for the duration you order. Order shortly before going live." },
    ],
  },
  {
    tab: "p-twitter",
    slug: "twitter-smm-panel",
    name: "Twitter / X",
    icon: TwitterXIcon,
    regex: /twitter|\bx\b|tweet/i,
    headline: "Twitter (X) SMM Panel — Followers, Likes & Impressions",
    intro:
      "Grow X profiles with wholesale followers, likes, reposts and impressions. SMM UP serves Indian crypto, trading, and creator communities on X with 0% UPI deposit fee and measured start times.",
    services: [
      "Followers — standard and high-quality",
      "Post likes",
      "Reposts / retweets",
      "Impressions and profile visits",
      "Bookmarks",
      "Poll votes",
    ],
    why: [
      { title: "Visible service terms", desc: "Compare each listing's description, estimate and any refill window before ordering." },
      { title: "Metric-specific listings", desc: "Choose among followers, likes, reposts, impressions and other supported public metrics." },
      { title: "Indian payment rails", desc: "Direct UPI has a 0% platform fee; Razorpay is a separate option when configured." },
    ],
    faq: [
      { q: "Are X followers risky right now?", a: "X runs frequent authenticity sweeps, which is why drop-refill tiers exist. Choose refill-guaranteed services for important accounts." },
      { q: "Do impressions count toward payouts?", a: "Impressions register publicly, but X's monetization rules are its own — eligibility is decided by X, not by any panel." },
      { q: "How fast do likes start?", a: "Timing varies by service and supplier load. Review the current estimate on the service card." },
    ],
  },
  {
    tab: "p-tiktok",
    slug: "tiktok-smm-panel",
    name: "TikTok",
    icon: TikTokIcon,
    regex: /tiktok/i,
    headline: "TikTok SMM Panel — Views, Followers & Likes",
    intro:
      "SMM UP is a TikTok SMM panel with wholesale-rate video views, followers, likes and shares for Indian creators. Direct UPI deposits with a 0% platform fee and listing-specific delivery information.",
    services: [
      "Video views (listing-specific limits and timing)",
      "Followers",
      "Post likes",
      "Shares and saves",
      "Live stream viewers",
    ],
    why: [
      { title: "Visible pricing", desc: "Current rate, minimum and maximum quantities are displayed before purchase." },
      { title: "Current delivery estimate", desc: "The selected listing shows its supplier-provided timing; actual timing varies with capacity." },
      { title: "Trackable orders", desc: "Accepted orders can be checked from Order History; TikTok retains control of recommendation outcomes." },
    ],
    faq: [
      { q: "Do TikTok views help a video go viral?", a: "No service can guarantee recommendation or virality. TikTok controls the For You system; content quality, audience behavior and platform rules remain decisive." },
      { q: "Is TikTok available in India?", a: "TikTok is geo-restricted in India; these services serve creators in TikTok-active regions and NRIs targeting those audiences." },
      { q: "Do TikTok followers drop?", a: "Like all platforms, TikTok purges bots periodically — refill-guaranteed options cover drops within the window." },
    ],
  },
  {
    tab: "p-spotify",
    slug: "spotify-smm-panel",
    name: "Spotify",
    icon: SpotifyIcon,
    regex: /spotify/i,
    headline: "Spotify SMM Panel — Streams, Followers & Listeners",
    intro:
      "SMM UP lists Spotify streams, artist followers, playlist plays and monthly-listener services with current rates and Direct UPI funding at a 0% platform fee. Spotify controls anti-fraud, analytics, royalties and recommendation decisions.",
    services: [
      "Track streams (listing-specific delivery terms)",
      "Artist followers",
      "Monthly listeners",
      "Playlist plays & playlist followers",
      "Saves",
    ],
    why: [
      { title: "Listing-specific timing", desc: "Review the selected service's delivery estimate and limits before ordering." },
      { title: "No placement promise", desc: "Service delivery does not guarantee Discover Weekly, Release Radar or editorial placement." },
      { title: "Honest limits", desc: "We print exactly what each service does; no 'guaranteed editorial playlist' fantasies." },
    ],
    faq: [
      { q: "Are Spotify streams safe?", a: "No third party can guarantee account safety, analytics acceptance or royalty eligibility. Review the listing and use only campaigns consistent with Spotify rules." },
      { q: "Do streams pay royalties?", a: "Spotify controls analytics, anti-fraud and royalty eligibility. A delivered service is not a payout promise." },
      { q: "Can you get me on editorial playlists?", a: "No — anyone promising editorial placement is scamming you. No volume guarantees algorithmic or editorial placement." },
    ],
  },
];

interface PlatformPageProps {
  config: PlatformConfig;
  services: any[];
  onNavigate: (tab: string) => void;
}

export default function PlatformPage({ config, services, onNavigate }: PlatformPageProps) {
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);
  const Icon = config.icon;

  // Live data for this platform
  const platformServices = React.useMemo(
    () =>
      services.filter((s) => config.regex.test(`${s.category} ${s.name}`)),
    [services, config]
  );
  const minRate = React.useMemo(() => {
    if (!platformServices.length) return null;
    return Math.min(...platformServices.map((s) => s.rate));
  }, [platformServices]);
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    platformServices.forEach((s) => set.add(s.category));
    return Array.from(set).sort().slice(0, 8);
  }, [platformServices]);
  // Live price list: the 8 cheapest live SKUs on this platform — answers the
  // "X price per 1,000" searches with real numbers instead of one floor stat.
  const priceList = React.useMemo(() => {
    return platformServices
      .filter((s) => s.rate > 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);
  }, [platformServices]);

  return (
    <ContentPage
      kicker={`${config.name} Services`}
      title={config.headline}
      subtitle={config.intro}
      crumbs={[{ label: "Home", tab: "home" }, { label: "Platforms" }, { label: config.name }]}
      onNavigate={onNavigate}
    >
      {/* Live rate strip */}
      <Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <div className="p-4 rounded-none border border-white/12 bg-white/[0.03] flex items-start gap-3">
            <Icon size={26} className="shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-white leading-tight">
                {minRate !== null ? `from ${formatINR(minRate)}` : "—"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">per 1,000 • live minimum</div>
            </div>
          </div>
          <div className="p-4 rounded-none border border-white/12 bg-white/[0.03] flex items-start gap-3">
            <Zap className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-white leading-tight">0 – 60 min</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">typical start</div>
            </div>
          </div>
          <div className="p-4 rounded-none border border-white/12 bg-white/[0.03] flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-white leading-tight">7D – Lifetime</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">refill windows</div>
            </div>
          </div>
          <div className="p-4 rounded-none border border-white/12 bg-white/[0.03] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-lg font-bold text-white leading-tight">0% fee</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">UPI deposits</div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Live price list — straight from the catalog, per 1,000 units */}
      {priceList.length > 0 && (
        <Reveal>
          <div className="mb-10">
            <div className="flex items-end justify-between gap-3 mb-3">
              <H2>{config.name} price list, live</H2>
              <span className="hidden sm:block text-[10px] font-mono tracking-[0.2em] uppercase text-zinc-600 shrink-0">
                Per 1,000 • synced from catalog
              </span>
            </div>
            <div className="rounded-none border border-white/12 bg-white/[0.02] overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_120px_150px] gap-4 px-4 py-2.5 border-b border-white/[0.08] text-[9px] font-mono tracking-[0.22em] uppercase text-zinc-500">
                <span>Service</span>
                <span>Rate / 1K</span>
                <span>Min – Max</span>
              </div>
              {priceList.map((s, i) => (
                <div
                  key={`${s.name}-${i}`}
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_150px] gap-2 sm:gap-4 px-4 py-3 items-center ${
                    i !== priceList.length - 1 ? "border-b border-white/[0.05]" : ""
                  }`}
                >
                  <span className="text-xs sm:text-sm text-zinc-300 leading-snug line-clamp-2">
                    {s.name}
                  </span>
                  <span className="text-sm font-bold text-white text-right sm:text-left">
                    {formatINR(s.rate)}
                  </span>
                  <span className="hidden sm:block text-[11px] font-mono text-zinc-500">
                    {s.min.toLocaleString()} – {s.max.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-zinc-600 font-light">
              Cheapest {Math.min(8, priceList.length)} of {platformServices.length} live services.{" "}
              <a href={pathFor("catalog")} className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400 transition">
                See the full {config.name} catalog
              </a>
              {" "}— every SKU, every tier.
            </p>
          </div>
        </Reveal>
      )}

      <H2>{config.name} services available</H2>
      <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
        {config.services.map((s) => (
          <div key={s} className="flex items-center gap-2.5 p-3.5 rounded-none border border-white/10 bg-white/[0.02] text-sm text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>{s}</span>
          </div>
        ))}
      </div>
      {categories.length > 0 && (
        <p className="text-xs text-zinc-500 font-mono mb-10">
          LIVE CATEGORIES: {categories.join(" • ")}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 my-8">
        <a href={pathFor("order")} className="btn-up btn-up-solid group">
          <span>Order {config.name} services</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
        <a href={pathFor("catalog")} className="btn-up btn-up-ghost">
          <span>See full catalog</span>
        </a>
      </div>

      <H2>Why {config.name} buyers choose SMM UP</H2>
      <div className="grid sm:grid-cols-3 gap-3 mb-10">
        {config.why.map((w) => (
          <div key={w.title} className="p-5 rounded-none border border-white/10 bg-white/[0.02]">
            <h3 className="text-sm font-bold text-white mb-1.5">{w.title}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{w.desc}</p>
          </div>
        ))}
      </div>

      <H2>{config.name} SMM panel — FAQ</H2>
      <div className="divide-y divide-white/[0.06] border-y border-white/[0.06] mb-10">
        {config.faq.map((f, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full py-4 flex items-center justify-between gap-4 text-left cursor-pointer group"
            >
              <span className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                {f.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-300 ${
                  openFaq === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ${
                openFaq === i ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-sm text-zinc-400 leading-relaxed font-light pr-6">{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Callout>
        All {config.name} orders need only a public link — never a password. Direct UPI deposits use exact memo and receipt matching with a 0% platform fee. Questions? The{" "}
        <a href={pathFor("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          support desk
        </a>{" "}
        is the direct review route.
      </Callout>
    </ContentPage>
  );
}
