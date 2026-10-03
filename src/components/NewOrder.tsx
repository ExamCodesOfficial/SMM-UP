import React from "react";
import {
  Send,
  Zap,
  Info,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Link2,
  Hash,
  MessageSquare,
  Search,
  Wallet,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Flame,
  Sparkles,
  Check,
  SlidersHorizontal,
  X,
  FileText,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR, formatNumber, cleanServiceDescription } from "../lib/utils";
import {
  ExecutiveOrderIcon,
  ExecutiveWalletIcon,
  ExecutiveCatalogIcon,
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

interface NewOrderProps {
  services: Service[];
  user: any;
  onOrderSuccess: (order: any) => void;
  onOpenWallet: () => void;
  onOpenAuth: () => void;
  onOpenTerms?: () => void;
  preselectedServiceId?: number | string | null;
}

const PLATFORMS = [
  { id: "All", name: "All Platforms", icon: SparklesAllIcon },
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

export default function NewOrder({
  services,
  user,
  onOrderSuccess,
  onOpenWallet,
  onOpenAuth,
  onOpenTerms,
  preselectedServiceId,
}: NewOrderProps) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("All");
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedServiceId, setSelectedServiceId] = React.useState<number | string>("");

  // Custom Popover States (Replacing clunky native HTML selects)
  const [catPickerOpen, setCatPickerOpen] = React.useState(false);
  const [catSearch, setCatSearch] = React.useState("");
  const [servicePickerOpen, setServicePickerOpen] = React.useState(false);
  const [serviceSearch, setServiceSearch] = React.useState("");

  const catPickerRef = React.useRef<HTMLDivElement>(null);
  const servicePickerRef = React.useRef<HTMLDivElement>(null);

  const [link, setLink] = React.useState("");
  const [quantity, setQuantity] = React.useState<number | string>("");
  const [comments, setComments] = React.useState("");
  const [answerNumber, setAnswerNumber] = React.useState("1");

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
      }
      if (servicePickerRef.current && !servicePickerRef.current.contains(e.target as Node)) {
        setServicePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filter services by platform
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

  // Categories in platform
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    platformFiltered.forEach((s) => set.add(s.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [platformFiltered]);

  // Keep category in sync
  React.useEffect(() => {
    if (categories.length > 0) {
      if (!selectedCategory || !categories.includes(selectedCategory)) {
        setSelectedCategory(categories[0]);
      }
    } else {
      setSelectedCategory("");
    }
  }, [categories, selectedCategory]);

  // Filtered services in category
  const servicesInCategory = React.useMemo(() => {
    if (!selectedCategory) return [];
    return platformFiltered.filter((s) => s.category === selectedCategory);
  }, [platformFiltered, selectedCategory]);

  // Sync selected service
  React.useEffect(() => {
    if (preselectedServiceId) {
      const match = services.find((s) => Number(s.service) === Number(preselectedServiceId));
      if (match) {
        setSelectedCategory(match.category);
        setSelectedServiceId(match.service);
        return;
      }
    }

    if (servicesInCategory.length > 0) {
      const currentExists = servicesInCategory.some(
        (s) => Number(s.service) === Number(selectedServiceId)
      );
      if (!currentExists) {
        setSelectedServiceId(servicesInCategory[0].service);
      }
    } else {
      setSelectedServiceId("");
    }
  }, [servicesInCategory, preselectedServiceId]);

  // Current active service object
  const currentService = React.useMemo(() => {
    return services.find((s) => Number(s.service) === Number(selectedServiceId)) || null;
  }, [services, selectedServiceId]);

  // Filtered categories for picker search
  const filteredCategoriesForPicker = React.useMemo(() => {
    if (!catSearch.trim()) return categories;
    return categories.filter((c) => c.toLowerCase().includes(catSearch.toLowerCase()));
  }, [categories, catSearch]);

  // Filtered services for package picker search
  const filteredServicesForPicker = React.useMemo(() => {
    if (!serviceSearch.trim()) return servicesInCategory;
    const term = serviceSearch.toLowerCase();
    return servicesInCategory.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        String(s.service).includes(term) ||
        s.category.toLowerCase().includes(term)
    );
  }, [servicesInCategory, serviceSearch]);

  // Calculation of charge
  const calculatedCharge = React.useMemo(() => {
    if (!currentService) return 0;
    if (currentService.type === "Custom Comments") {
      const lines = comments.split("\n").filter((l) => l.trim().length > 0);
      return (currentService.rate * lines.length) / 1000;
    }
    if (currentService.type === "Package") {
      return currentService.rate;
    }
    const q = parseFloat(String(quantity));
    if (isNaN(q) || q <= 0) return 0;
    return (currentService.rate * q) / 1000;
  }, [currentService, quantity, comments]);

  const userBalance = user?.balance ?? 0;
  const hasEnoughBalance = user ? userBalance >= calculatedCharge : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!user) {
      onOpenAuth();
      return;
    }

    if (!currentService) {
      setErrorMsg("Please select a service from the catalog.");
      return;
    }

    if (!link.trim()) {
      setErrorMsg("Please enter the target link or public username.");
      return;
    }

    if (currentService.type === "Custom Comments") {
      const lines = comments.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length < currentService.min || lines.length > currentService.max) {
        setErrorMsg(`Comments count must be between ${currentService.min} and ${currentService.max}.`);
        return;
      }
    } else if (currentService.type !== "Package") {
      const q = parseInt(String(quantity), 10);
      if (isNaN(q) || q < currentService.min || q > currentService.max) {
        setErrorMsg(`Quantity must be between ${formatNumber(currentService.min)} and ${formatNumber(currentService.max)}.`);
        return;
      }
    }

    if (!hasEnoughBalance) {
      setErrorMsg(`Insufficient wallet balance. Required: ${formatINR(calculatedCharge)}, Available: ${formatINR(userBalance)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: currentService.service,
          link: link.trim(),
          quantity: currentService.type === "Custom Comments" ? undefined : quantity,
          comments: currentService.type === "Custom Comments" ? comments : undefined,
          answer_number: currentService.type === "Poll" ? answerNumber : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Order execution failed. Please verify target link.");
      } else {
        setSuccessMsg(`Order #${data.providerOrderId || data.orderId} dispatched successfully!`);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        onOrderSuccess(data);
        setLink("");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const platformInfo = currentService ? getPlatformInfo(currentService.category, currentService.name) : null;
  const ActivePlatformIcon = platformInfo ? platformInfo.icon : SparklesAllIcon;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
      {/* Title Section */}
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
          DISPATCH ORDER
        </h2>
        <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
        <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-xl mx-auto">
          Deploy instant growth across any platform with wholesale delivery.
        </p>
      </div>

      {/* Platform Tabs with SVGs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = selectedPlatform === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPlatform(p.id);
                setCatPickerOpen(false);
                setServicePickerOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium tracking-wider whitespace-nowrap transition-all duration-300 cursor-pointer ${
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Clean Order Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-2xl border border-white/[0.08] bg-[#0E0D0B]/85 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            <h3 className="text-base sm:text-lg font-semibold tracking-wide text-white mb-6 flex items-center justify-between">
              <span>Order Configuration</span>
              <span className="text-xs font-medium text-[#F5E8D0] bg-[#F5E8D0]/[0.08] border border-[#F5E8D0]/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5E8D0] animate-pulse" />
                Live Wholesale Node
              </span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. CUSTOM CATEGORY PICKER (No native select boxes!) */}
              <div className="relative" ref={catPickerRef}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  1. Select Category {categories.length > 0 ? `(${categories.length} available)` : "(Loading...)"}
                </label>

                {/* Trigger Pill Button */}
                <button
                  type="button"
                  onClick={() => {
                    setCatPickerOpen(!catPickerOpen);
                    setServicePickerOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                      <ActivePlatformIcon size={16} />
                    </div>
                    <span className="text-sm font-semibold text-white truncate">
                      {selectedCategory || (categories.length === 0 ? "Loading wholesale catalog..." : "Choose a category")}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      catPickerOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>

                {/* Floating Command Popover */}
                {catPickerOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.9)] p-3 space-y-2 max-h-80 flex flex-col">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="Search category (e.g. Followers, Views, Reels)..."
                        autoFocus
                        className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs rounded-xl outline-none"
                      />
                    </div>

                    <div className="overflow-y-auto space-y-1 pr-1 flex-1">
                      {filteredCategoriesForPicker.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-4">No categories match your search.</div>
                      ) : (
                        filteredCategoriesForPicker.map((cat) => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setCatPickerOpen(false);
                                setCatSearch("");
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white text-black font-semibold shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                                  : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                              }`}
                            >
                              <span className="truncate pr-2">{cat}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. CUSTOM SERVICE PACKAGE PICKER (No native select boxes!) */}
              <div className="relative" ref={servicePickerRef}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  2. Select Service Package
                </label>

                {/* Trigger Pill Button */}
                <button
                  type="button"
                  onClick={() => {
                    setServicePickerOpen(!servicePickerOpen);
                    setCatPickerOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all text-left cursor-pointer group"
                >
                  <div className="truncate pr-2">
                    {currentService ? (
                      <div>
                        <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-[11px] font-medium text-zinc-300">
                            #{currentService.service}
                          </span>
                          <span className="truncate">{currentService.name}</span>
                        </div>
                        <div className="text-xs text-[#FFFDF9] font-semibold mt-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                          {formatINR(currentService.rate)} <span className="text-[10px] text-[#F5E8D0] font-normal">/ 1,000 units</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">Loading service nodes...</span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      servicePickerOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>

                {/* Floating Service Popover */}
                {servicePickerOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.9)] p-3 space-y-2 max-h-96 flex flex-col">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search service name, ID (e.g. 2664), or speed..."
                        autoFocus
                        className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs rounded-xl outline-none"
                      />
                    </div>

                    <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                      {filteredServicesForPicker.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-4">No services match your search in this category.</div>
                      ) : (
                        filteredServicesForPicker.map((s) => {
                          const isSelected = Number(s.service) === Number(selectedServiceId);
                          return (
                            <button
                              key={s.service}
                              type="button"
                              onClick={() => {
                                setSelectedServiceId(s.service);
                                setServicePickerOpen(false);
                                setServiceSearch("");
                              }}
                              className={`w-full p-3 rounded-xl text-left transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-white/[0.08] border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                  : "bg-black/40 border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-xs font-semibold text-white leading-snug line-clamp-2">
                                  #{s.service} — {s.name}
                                </span>
                                <span className="text-xs font-semibold text-[#FFFDF9] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] shrink-0">
                                  {formatINR(s.rate)} <span className="text-[10px] text-[#F5E8D0] font-normal">/ 1K</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                                <span>Min: {formatNumber(s.min)} &bull; Max: {formatNumber(s.max)}</span>
                                {s.refill && (
                                  <span className="text-[#F5E8D0] font-medium flex items-center gap-0.5">
                                    <RotateCcw className="w-2.5 h-2.5" /> 30D Refill
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Target Link */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  3. Target Link or Username
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://t.me/channel or https://instagram.com/p/..."
                    required
                    className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-xl outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>
              </div>

              {/* 4. Quantity or Custom Comments */}
              {currentService?.type === "Custom Comments" ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                    Comments (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Nice work!&#10;Great video!&#10;Keep it up!"
                    className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white p-4 text-sm rounded-xl outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>
              ) : currentService?.type === "Package" ? (
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] text-sm text-zinc-300">
                  Fixed Package: 1 Complete Delivery Unit
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      4. Quantity
                    </label>
                    {currentService && (
                      <span className="text-xs text-zinc-400">
                        Min: <strong className="text-white">{formatNumber(currentService.min)}</strong> — Max: <strong className="text-white">{formatNumber(currentService.max)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min={currentService?.min || 1}
                      max={currentService?.max || 1000000}
                      placeholder={currentService ? `e.g. ${currentService.min}` : "1000"}
                      required
                      className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-xl outline-none transition-all placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Charge Summary Card */}
              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Total Cost</span>
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {formatINR(calculatedCharge)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-white/[0.06]">
                  <span className="text-zinc-400">Your Wallet Balance:</span>
                  {user ? (
                    <span className={`font-semibold ${userBalance >= calculatedCharge ? "text-[#FFFDF9] drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]" : "text-rose-400"}`}>
                      {formatINR(userBalance)}
                    </span>
                  ) : (
                    <span className="text-zinc-500">Sign in to check</span>
                  )}
                </div>

                {user && userBalance < calculatedCharge && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenWallet}
                      className="w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold text-xs tracking-wider hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExecutiveWalletIcon size={15} />
                      <span>Wallet Low — Add Funds via UPI</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-4 rounded-xl bg-[#F5E8D0]/10 border border-[#F5E8D0]/30 text-[#FAF7F2] text-xs sm:text-sm flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-[#F5E8D0]" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Dispatch Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl bg-white text-black font-bold tracking-[0.12em] text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Transmitting to Wholesale Node...</span>
                  </>
                ) : (
                  <>
                    <ExecutiveOrderIcon size={16} />
                    <span>Confirm &amp; Dispatch Order</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Service Intelligence & Rules */}
        <div className="lg:col-span-5 space-y-6">
          {currentService && platformInfo ? (
            <div className="p-6 sm:p-8 rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
              {/* Header with SVG */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 bg-white/[0.03]">
                  <ActivePlatformIcon size={26} />
                </div>
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    {platformInfo.name} Channel
                  </span>
                  <h4 className="text-base font-bold text-white leading-tight">
                    Service #{currentService.service}
                  </h4>
                </div>
              </div>

              {/* Title */}
              <h5 className="text-sm font-semibold text-white leading-snug mb-4">
                {currentService.name}
              </h5>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Wholesale Rate</span>
                  <span className="text-base font-bold text-[#FFFDF9] drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
                    {formatINR(currentService.rate)} <span className="text-xs text-[#F5E8D0] font-normal">/ 1K</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Start Speed</span>
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    {currentService.average_time || "Instant"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Refill Policy</span>
                  <span className={`text-sm font-semibold flex items-center gap-1.5 ${currentService.refill ? "text-[#F5E8D0]" : "text-zinc-500"}`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    {currentService.refill ? "30 Days Guaranteed" : "No Refill"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Cancel Option</span>
                  <span className="text-sm font-semibold text-zinc-300">
                    {currentService.cancel ? "Supported" : "Immediate Lock"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block">
                  Service Description &amp; Instructions
                </span>
                <div className="p-4 rounded-xl border border-white/[0.06] bg-black/30 text-xs text-zinc-300 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                  {cleanServiceDescription(currentService.description)}
                </div>
              </div>

              {/* Guarantees */}
              <div className="space-y-2.5 pt-4 border-t border-white/[0.06] text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#F5E8D0] shrink-0" />
                  <span>Account privacy strictly maintained. Never requires passwords.</span>
                </div>
                {onOpenTerms && (
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs"
                  >
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="underline">Review Service Terms &amp; Policies</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl text-center">
              <Sparkles className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Select a category and service to inspect specifications.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
