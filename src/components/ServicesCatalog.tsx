import React from "react";
import {
  Search,
  Clock,
  RotateCcw,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";
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
  GlobeTrafficIcon,
  SparklesAllIcon,
  getPlatformInfo,
} from "./icons/PlatformIcons";

interface Service {
  service: number | string;
  name: string;
  type: string;
  category: string;
  platform?: string;
  rate: number;
  min: number;
  max: number;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
  average_time: string;
  description: string;
}

interface ServicesCatalogProps {
  services: Service[];
  onSelectService: (serviceId: number | string) => void;
}

const PLATFORM_NAV = [
  { id: "All", name: "All Services", icon: SparklesAllIcon },
  { id: "Telegram", name: "Telegram", icon: TelegramIcon },
  { id: "Instagram", name: "Instagram", icon: InstagramIcon },
  { id: "YouTube", name: "YouTube", icon: YouTubeIcon },
  { id: "Facebook", name: "Facebook", icon: FacebookIcon },
  { id: "Twitter / X", name: "Twitter / X", icon: TwitterXIcon },
  { id: "TikTok", name: "TikTok", icon: TikTokIcon },
  { id: "Spotify", name: "Spotify", icon: SpotifyIcon },
  { id: "Discord", name: "Discord", icon: DiscordIcon },
  { id: "LinkedIn", name: "LinkedIn", icon: LinkedInIcon },
  { id: "WhatsApp", name: "WhatsApp", icon: WhatsAppIcon },
  { id: "Traffic", name: "Web Traffic", icon: GlobeTrafficIcon },
];

export default function ServicesCatalog({ services, onSelectService }: ServicesCatalogProps) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("All");
  const [selectedCat, setSelectedCat] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");
  const [copiedId, setCopiedId] = React.useState<number | string | null>(null);

  // Platform filtering logic
  const platformFiltered = React.useMemo(() => {
    if (selectedPlatform === "All") return services;

    return services.filter((s) => {
      if (s.platform && s.platform === selectedPlatform) return true;
      const combined = (s.category + " " + s.name).toLowerCase();
      if (selectedPlatform === "Telegram") return /telegram|\btg\b/i.test(combined);
      if (selectedPlatform === "Instagram") return /instagram|\big\b|reels/i.test(combined);
      if (selectedPlatform === "YouTube") return /youtube|\byt\b/i.test(combined);
      if (selectedPlatform === "Facebook") return /facebook|\bfb\b/i.test(combined);
      if (selectedPlatform === "Twitter / X") return /twitter|\bx\b|tweet/i.test(combined);
      if (selectedPlatform === "TikTok") return /tiktok/i.test(combined);
      if (selectedPlatform === "Spotify") return /spotify/i.test(combined);
      if (selectedPlatform === "Discord") return /discord/i.test(combined);
      if (selectedPlatform === "LinkedIn") return /linkedin/i.test(combined);
      if (selectedPlatform === "WhatsApp") return /whatsapp/i.test(combined);
      if (selectedPlatform === "Traffic") return /traffic|website|visitor|seo/i.test(combined);
      return false;
    });
  }, [services, selectedPlatform]);

  // Categories within active platform
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    platformFiltered.forEach((s) => set.add(s.category));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [platformFiltered]);

  // Reset category if not available in current platform
  React.useEffect(() => {
    if (selectedCat !== "All" && !categories.includes(selectedCat)) {
      setSelectedCat("All");
    }
  }, [selectedPlatform, categories]);

  // Final filtered list
  const filtered = React.useMemo(() => {
    return platformFiltered.filter((s) => {
      const matchCat = selectedCat === "All" || s.category === selectedCat;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.service) === search.trim() ||
        s.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [platformFiltered, selectedCat, search]);

  const copyServiceId = (id: number | string) => {
    navigator.clipboard.writeText(String(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
      {/* Title Section */}
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
          SERVICES DIRECTORY
        </h2>
        <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
        <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-2xl mx-auto">
          Explore {services.length.toLocaleString()} verified wholesale channels with real-time provisioning & zero retail markups.
        </p>
      </div>

      {/* Platform Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
        {PLATFORM_NAV.map((p) => {
          const Icon = p.icon;
          const isActive = selectedPlatform === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlatform(p.id);
                setSelectedCat("All");
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium tracking-wider whitespace-nowrap transition-all duration-300 cursor-pointer ${
                isActive
                  ? "bg-white text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.02]"
                  : "bg-white/[0.02] border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.05] hover:border-white/20"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 p-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 backdrop-blur-xl">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search across ${platformFiltered.length} ${selectedPlatform === "All" ? "" : selectedPlatform} services...`}
            className="w-full bg-black/60 border border-white/10 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all placeholder:text-zinc-500"
          />
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="bg-black/80 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-medium outline-none focus:border-white/40 max-w-xs cursor-pointer truncate"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-zinc-900 text-white">
                {c === "All" ? `All Categories (${categories.length - 1})` : c}
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex items-center border border-white/10 rounded-xl bg-black/50 p-1 shrink-0">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "cards" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "table" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6 px-1">
        <span className="text-xs tracking-wider text-zinc-400 font-semibold uppercase">
          Showing {filtered.length} available service nodes
        </span>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* ── CARD GRID VIEW ────────────────────────────────────── */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.slice(0, 90).map((s) => {
            const platformInfo = getPlatformInfo(s.category, s.name);
            const PlatformIcon = platformInfo.icon;

            return (
              <div
                key={s.service}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/20 transition-all duration-300 p-6 flex flex-col justify-between shadow-[0_4px_25px_rgba(0,0,0,0.5)] group relative"
              >
                <div>
                  {/* Top Bar: Platform SVG + ID */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 bg-white/[0.03] shrink-0">
                        <PlatformIcon size={20} />
                      </div>
                      <span className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">
                        {platformInfo.name}
                      </span>
                    </div>

                    <button
                      onClick={() => copyServiceId(s.service)}
                      className="px-2.5 py-1 rounded-lg border border-white/10 bg-black/40 text-[11px] font-medium text-zinc-400 hover:text-white hover:border-white/30 transition-all cursor-pointer flex items-center gap-1"
                      title="Copy Service ID"
                    >
                      {copiedId === s.service ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <span>#{s.service}</span>
                      )}
                    </button>
                  </div>

                  {/* Service Title */}
                  <h3 className="text-sm font-semibold text-white leading-relaxed mb-2.5 group-hover:text-zinc-100 transition-colors line-clamp-2">
                    {s.name}
                  </h3>

                  {/* Category Pill */}
                  <div className="mb-4">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-400 max-w-full truncate">
                      {s.category}
                    </span>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/40 border border-white/[0.05] mb-5 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Min / Max</span>
                      <span className="text-zinc-300 font-medium">
                        {formatNumber(s.min)} – {formatNumber(s.max)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Dispatch Speed</span>
                      <span className="text-zinc-300 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        {s.average_time || "Instant"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Price + Dispatch Button */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Price per 1,000</span>
                    <span className="text-base font-bold text-emerald-400 tracking-wide">
                      {formatINR(s.rate)}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectService(s.service)}
                    className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CLEAN TABLE VIEW ─────────────────────────────────── */}
      {viewMode === "table" && (
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/60 backdrop-blur-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/90 border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-4 px-5">ID</th>
                  <th className="py-4 px-5">Platform</th>
                  <th className="py-4 px-5">Service Name</th>
                  <th className="py-4 px-5">Rate / 1K</th>
                  <th className="py-4 px-5">Min / Max</th>
                  <th className="py-4 px-5">Guarantees</th>
                  <th className="py-4 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.slice(0, 100).map((s) => {
                  const platformInfo = getPlatformInfo(s.category, s.name);
                  const PlatformIcon = platformInfo.icon;

                  return (
                    <tr key={s.service} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 font-medium text-zinc-400 whitespace-nowrap">
                        #{s.service}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <PlatformIcon size={18} />
                          <span className="text-zinc-300 font-medium">{platformInfo.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 max-w-md">
                        <div className="font-medium text-white line-clamp-1">{s.name}</div>
                        <div className="text-[11px] text-zinc-500 truncate">{s.category}</div>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-emerald-400 whitespace-nowrap text-sm">
                        {formatINR(s.rate)}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-300 whitespace-nowrap">
                        {formatNumber(s.min)} – {formatNumber(s.max)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {s.refill ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" /> Refill
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">No Refill</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectService(s.service)}
                          className="px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Order</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Note */}
      {filtered.length > 90 && (
        <div className="text-center text-xs text-zinc-400 mt-8">
          Showing top {viewMode === "cards" ? 90 : 100} of {filtered.length} services. Use platform filters or keyword search to narrow down.
        </div>
      )}
    </div>
  );
}
