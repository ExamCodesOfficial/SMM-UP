import React from "react";
import { readApiPayload } from "../lib/apiResponse";
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
  Heart,
  BookmarkPlus,
  Trash2,
  Layers,
  CornerDownRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { SkeletonOrderForm } from "./Skeleton";
import { formatINR, formatNumber, cleanServiceDescription, sanitizeBrandText, parseRefillPolicy, matchesServiceSearch, formatAverageTime } from "../lib/utils";
import { pathFor } from "../lib/routes";

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !query.trim()) return text;
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (tokens.length === 0) return text;
  const regex = new RegExp(`(${tokens.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="text-white font-semibold bg-white/20 px-0.5 rounded-xs">
        {part}
      </span>
    ) : (
      part
    )
  );
}
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
  refill_days?: number;
  refill_label?: string;
  refill_short?: string;
  cancel: boolean;
  average_time: string;
  description: string;
}

interface NewOrderProps {
  services: Service[];
  user: any;
  onOrderSuccess: (order: any) => void;
  onOpenAuth: () => void;
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
  onOpenAuth,
  preselectedServiceId,
}: NewOrderProps) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("All");
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedServiceId, setSelectedServiceId] = React.useState<number | string>("");

  // Universal Omni-Search State (Global search across all 2000+ services)
  const [omniSearch, setOmniSearch] = React.useState("");
  const [omniOpen, setOmniOpen] = React.useState(false);
  const omniRef = React.useRef<HTMLDivElement>(null);
  const omniInputRef = React.useRef<HTMLInputElement>(null);
  const omniListRef = React.useRef<HTMLDivElement>(null);
  const targetLinkInputRef = React.useRef<HTMLInputElement>(null);

  // Custom Popover States (Replacing clunky native HTML selects)
  const [catPickerOpen, setCatPickerOpen] = React.useState(false);
  const [catSearch, setCatSearch] = React.useState("");
  const [servicePickerOpen, setServicePickerOpen] = React.useState(false);
  const [serviceSearch, setServiceSearch] = React.useState("");
  const [pickerSearchAll, setPickerSearchAll] = React.useState(false);

  const catPickerRef = React.useRef<HTMLDivElement>(null);
  const servicePickerRef = React.useRef<HTMLDivElement>(null);
  // Drawer scroll memory — reopen exactly where the previous selection sits
  const catListRef = React.useRef<HTMLDivElement>(null);
  const serviceListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (catPickerOpen && catListRef.current) {
      const list = catListRef.current;
      const selected = list.querySelector('[data-selected="true"]') as HTMLElement | null;
      requestAnimationFrame(() => {
        if (selected) {
          list.scrollTop = selected.offsetTop - list.offsetHeight / 2 + selected.offsetHeight / 2;
        }
      });
    }
  }, [catPickerOpen]);

  React.useEffect(() => {
    if (servicePickerOpen && serviceListRef.current) {
      const list = serviceListRef.current;
      const selected = list.querySelector('[data-selected="true"]') as HTMLElement | null;
      requestAnimationFrame(() => {
        if (selected) {
          list.scrollTop = selected.offsetTop - list.offsetHeight / 2 + selected.offsetHeight / 2;
        }
      });
    }
  }, [servicePickerOpen]);

  const [link, setLink] = React.useState("");
  const [quantity, setQuantity] = React.useState<number | string>("");
  const [comments, setComments] = React.useState("");
  const [answerNumber, setAnswerNumber] = React.useState("1");

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [templates, setTemplates] = React.useState<Array<{ id: string; name: string; serviceId: string; quantity: number | null }>>([]);
  const [templateName, setTemplateName] = React.useState("");
  const [presetBusy, setPresetBusy] = React.useState("");

  React.useEffect(() => {
    if (!user) {
      setFavorites([]);
      setTemplates([]);
      return;
    }
    let active = true;
    fetch("/api/presets/list", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await readApiPayload(response) }))
      .then(({ ok, data }) => {
        if (!active || !ok) return;
        setFavorites(Array.isArray(data.favorites) ? data.favorites.map(String) : []);
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.userId]);

  // Close dropdowns on outside click or Escape key (keyboard accessibility)
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (catPickerRef.current && !catPickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
      }
      if (servicePickerRef.current && !servicePickerRef.current.contains(e.target as Node)) {
        setServicePickerOpen(false);
      }
      if (omniRef.current && !omniRef.current.contains(e.target as Node)) {
        setOmniOpen(false);
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCatPickerOpen(false);
        setServicePickerOpen(false);
        setOmniOpen(false);
      }
      // Global shortcut for omni search (/ or ⌘K / Ctrl+K)
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOmniOpen(true);
        omniInputRef.current?.focus();
      } else if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        setOmniOpen(true);
        omniInputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeydown);
    };
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
    platformFiltered.forEach((s) => set.add(sanitizeBrandText(s.category)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [platformFiltered]);

  // Category service counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    platformFiltered.forEach((s) => {
      const cat = sanitizeBrandText(s.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
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
    return platformFiltered.filter(
      (s) => sanitizeBrandText(s.category) === selectedCategory || s.category === selectedCategory
    );
  }, [platformFiltered, selectedCategory]);

  // Sync selected service
  React.useEffect(() => {
    if (preselectedServiceId && services.length > 0) {
      const match = services.find((s) => Number(s.service) === Number(preselectedServiceId));
      if (match) {
        setSelectedCategory(match.category);
        setSelectedServiceId(match.service);
        setLink("");
        setQuantity("");
        setComments("");
        setErrorMsg("");
        return;
      }
      setSelectedServiceId("");
      setLink("");
      setQuantity("");
      setErrorMsg("That previous service is currently unavailable. Choose a current service before ordering again.");
      return;
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

  // Global Omni-Search across all 2000+ services
  const omniResults = React.useMemo(() => {
    if (!omniSearch.trim()) return [];
    const query = omniSearch.trim();
    const results: typeof services = [];
    for (const s of services) {
      if (matchesServiceSearch(s, query)) {
        results.push(s);
        if (results.length >= 60) break;
      }
    }
    return results;
  }, [services, omniSearch]);

  const handleSelectOmniService = (service: (typeof services)[0]) => {
    setSelectedPlatform("All");
    setSelectedCategory(sanitizeBrandText(service.category));
    setSelectedServiceId(service.service);
    setOmniOpen(false);
    setOmniSearch("");
    setTimeout(() => {
      targetLinkInputRef.current?.focus();
    }, 50);
  };

  // Filtered categories for picker search
  const filteredCategoriesForPicker = React.useMemo(() => {
    if (!catSearch.trim()) return categories;
    const term = catSearch.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(term));
  }, [categories, catSearch]);

  // Direct services matching category search term (for instant 1-click select inside category picker)
  const directServicesInCategorySearch = React.useMemo(() => {
    if (!catSearch.trim() || catSearch.trim().length < 2) return [];
    const term = catSearch.trim();
    const list: typeof services = [];
    for (const s of platformFiltered) {
      if (matchesServiceSearch(s, term)) {
        list.push(s);
        if (list.length >= 8) break;
      }
    }
    return list;
  }, [platformFiltered, catSearch]);

  // Filtered services for package picker search
  const filteredServicesForPicker = React.useMemo(() => {
    if (!serviceSearch.trim()) return servicesInCategory;
    return servicesInCategory.filter((s) => matchesServiceSearch(s, serviceSearch));
  }, [servicesInCategory, serviceSearch]);

  // Count matching services across ALL categories when current category returns 0
  const matchingAllCategoriesCount = React.useMemo(() => {
    if (!serviceSearch.trim() || filteredServicesForPicker.length > 0) return 0;
    let count = 0;
    for (const s of platformFiltered) {
      if (matchesServiceSearch(s, serviceSearch)) {
        count++;
      }
    }
    return count;
  }, [platformFiltered, serviceSearch, filteredServicesForPicker.length]);

  const handleSearchAcrossAllCategories = () => {
    const match = platformFiltered.find((s) => matchesServiceSearch(s, serviceSearch));
    if (match) {
      setSelectedCategory(sanitizeBrandText(match.category));
      setSelectedServiceId(match.service);
    }
  };

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
  const currentServiceIsFavorite = currentService ? favorites.includes(String(currentService.service)) : false;

  const applySavedService = (serviceId: string, savedQuantity?: number | null) => {
    const match = services.find((service) => String(service.service) === String(serviceId));
    if (!match) {
      setErrorMsg("That saved service is currently unavailable. Choose a current service.");
      return;
    }
    setSelectedPlatform("All");
    setSelectedCategory(sanitizeBrandText(match.category));
    setSelectedServiceId(match.service);
    setLink("");
    setComments("");
    setQuantity(savedQuantity ?? "");
    setErrorMsg("");
    setSuccessMsg("Saved service applied. Enter a current target before ordering.");
  };

  const toggleFavorite = async () => {
    if (!user) return onOpenAuth();
    if (!currentService) return;
    const serviceId = String(currentService.service);
    setPresetBusy(`favorite:${serviceId}`);
    setErrorMsg("");
    try {
      const response = await fetch("/api/presets/toggle-favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Unable to update favourites.");
      setFavorites((current) => data.favorite ? Array.from(new Set([...current, serviceId])) : current.filter((id) => id !== serviceId));
      setSuccessMsg(data.favorite ? "Service added to favourites." : "Service removed from favourites.");
    } catch (favoriteError: any) {
      setErrorMsg(favoriteError?.message || "Unable to update favourites.");
    } finally {
      setPresetBusy("");
    }
  };

  const saveTemplate = async () => {
    if (!user) return onOpenAuth();
    if (!currentService || templateName.trim().length < 2) {
      setErrorMsg("Enter a template name and select a service.");
      return;
    }
    setPresetBusy("template-save");
    setErrorMsg("");
    try {
      const response = await fetch("/api/presets/save-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          serviceId: String(currentService.service),
          quantity: currentService.type === "Package" || currentService.type === "Custom Comments" ? null : quantity,
        }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Unable to save template.");
      setTemplates((current) => [data.template, ...current]);
      setTemplateName("");
      setSuccessMsg(data.message || "Template saved.");
    } catch (templateError: any) {
      setErrorMsg(templateError?.message || "Unable to save template.");
    } finally {
      setPresetBusy("");
    }
  };

  const deleteTemplate = async (templateId: string) => {
    setPresetBusy(`template-delete:${templateId}`);
    setErrorMsg("");
    try {
      const response = await fetch("/api/presets/delete-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Unable to delete template.");
      setTemplates((current) => current.filter((item) => item.id !== templateId));
      setSuccessMsg("Template deleted.");
    } catch (templateError: any) {
      setErrorMsg(templateError?.message || "Unable to delete template.");
    } finally {
      setPresetBusy("");
    }
  };

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

      const data = await readApiPayload(res);
      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Order execution failed. Please verify target link.");
      } else {
        setSuccessMsg(`Order #${data.providerOrderId || data.orderId} placed successfully!`);
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
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
          PLACE AN ORDER
        </h1>
        <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
        <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-xl mx-auto">
          Pick a service, paste a public target, and confirm. Start and completion timing follows the selected service and current supplier capacity.
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-none text-xs font-medium tracking-wider whitespace-nowrap transition-all duration-300 cursor-pointer ${
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

      {services.length === 0 ? (
        /* Shimmer layout that mirrors the desk while the wholesale catalog streams in */
        <SkeletonOrderForm />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Clean Order Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            <h3 className="text-base sm:text-lg font-semibold tracking-wide text-white mb-6 flex items-center justify-between">
              <span>Order Configuration</span>
              <span className="text-xs font-medium text-[#E4E4E7] bg-[#E4E4E7]/[0.08] border border-[#E4E4E7]/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E4E4E7] animate-pulse" />
                Live Wholesale Node
              </span>
            </h3>

            {/* UNIVERSAL OMNI-SEARCH BAR (Global Search Across All 2,000+ Services) */}
            <div className="relative mb-6" ref={omniRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E4E4E7]" />
                  <span>Universal Quick Search</span>
                </label>
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span className="hidden sm:inline">Press</span>
                  <kbd className="px-1.5 py-0.5 rounded-none bg-white/10 border border-white/20 text-[10px] text-zinc-300 font-mono">
                    /
                  </kbd>
                  <span className="hidden sm:inline">or</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-none bg-white/10 border border-white/20 text-[10px] text-zinc-300 font-mono">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  ref={omniInputRef}
                  type="text"
                  value={omniSearch}
                  onFocus={() => setOmniOpen(true)}
                  onChange={(e) => {
                    setOmniSearch(e.target.value);
                    if (!omniOpen) setOmniOpen(true);
                  }}
                  placeholder="Instant search 2,000+ services (e.g. 'Telegram members non drop', '2664', 'Instagram reels')..."
                  className="w-full bg-black/60 border border-white/20 focus:border-[#E4E4E7] focus:ring-1 focus:ring-[#E4E4E7]/30 text-white pl-11 pr-10 py-3 text-xs sm:text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                />
                {omniSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setOmniSearch("");
                      setOmniOpen(false);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Omni-Search Results Floating Flyout */}
              {omniOpen && omniSearch.trim().length > 0 && (
                <div
                  ref={omniListRef}
                  className="absolute top-full left-0 right-0 mt-2 z-40 rounded-none border border-white/20 bg-zinc-950/98 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.95)] p-2 space-y-1 max-h-96 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-400 border-b border-white/[0.08]">
                    <span>Found {omniResults.length} matching service{omniResults.length === 1 ? "" : "s"} across catalog</span>
                    <span className="text-[10px] text-zinc-500">1-click auto-selects &amp; focuses target link</span>
                  </div>

                  {omniResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      No services match &ldquo;{omniSearch}&rdquo; across the entire catalog.
                    </div>
                  ) : (
                    omniResults.map((s) => {
                      const isSelected = Number(s.service) === Number(selectedServiceId);
                      const sInfo = getPlatformInfo(s.category, s.name);
                      const SIcon = sInfo.icon;
                      const policy = parseRefillPolicy(s);

                      return (
                        <button
                          key={s.service}
                          type="button"
                          onClick={() => handleSelectOmniService(s)}
                          className={`w-full p-2.5 rounded-none text-left transition-all cursor-pointer border flex flex-col gap-1 ${
                            isSelected
                              ? "bg-white/10 border-[#E4E4E7]/50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                              : "bg-black/40 border-white/[0.06] hover:border-white/30 hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-5 h-5 rounded-xs flex items-center justify-center bg-white/[0.05] border border-white/10 shrink-0">
                                <SIcon size={12} />
                              </div>
                              <span className="px-1.5 py-0.2 rounded-xs bg-white/[0.08] text-[10px] font-mono text-zinc-300">
                                #{s.service}
                              </span>
                              <span className="text-[11px] text-zinc-400 truncate">
                                {sanitizeBrandText(s.category)}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-white shrink-0">
                              {formatINR(s.rate)} <span className="text-[10px] text-[#E4E4E7] font-normal">/ 1K</span>
                            </span>
                          </div>

                          <div className="text-xs font-medium text-white truncate pl-7">
                            {highlightMatch(sanitizeBrandText(s.name), omniSearch)}
                          </div>

                          <div className="flex items-center gap-3 pl-7 text-[10px] text-zinc-400">
                            <span>Min: {formatNumber(s.min)} &bull; Max: {formatNumber(s.max)}</span>
                            {policy.hasRefill ? (
                              <span className="text-[#E4E4E7] font-medium flex items-center gap-0.5">
                                <RotateCcw className="w-2.5 h-2.5" /> {policy.shortLabel}
                              </span>
                            ) : (
                              <span className="text-zinc-500">No Refill</span>
                            )}
                            {s.average_time && (
                              <span className="text-zinc-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-zinc-500" />
                                {formatAverageTime(s.average_time)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

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
                  className="w-full flex items-center justify-between p-3.5 rounded-none border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    <div className="w-7 h-7 rounded-sm bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
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
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 rounded-none border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.9)] p-3 space-y-2 max-h-96 flex flex-col">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={catSearch}
                        onChange={(e) => setCatSearch(e.target.value)}
                        placeholder="Search category or service keyword (e.g. Followers, Views, 2664)..."
                        autoFocus
                        className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs rounded-none outline-none"
                      />
                    </div>

                    {/* Direct Services Matching Category Query */}
                    {directServicesInCategorySearch.length > 0 && (
                      <div className="p-2 border border-[#E4E4E7]/20 bg-white/[0.02] space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#E4E4E7] flex items-center gap-1 px-1 mb-1">
                          <CornerDownRight className="w-3 h-3" />
                          <span>Direct Services Matching &ldquo;{catSearch}&rdquo;</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {directServicesInCategorySearch.map((srv) => (
                            <button
                              key={srv.service}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(sanitizeBrandText(srv.category));
                                setSelectedServiceId(srv.service);
                                setCatPickerOpen(false);
                                setCatSearch("");
                                setTimeout(() => targetLinkInputRef.current?.focus(), 50);
                              }}
                              className="w-full text-left p-1.5 rounded-none bg-black/60 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 transition-all flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="truncate">
                                <span className="text-[10px] text-zinc-400 font-mono mr-1">#{srv.service}</span>
                                <span className="text-xs text-white">{highlightMatch(srv.name, catSearch)}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-[#FFFFFF] shrink-0">
                                {formatINR(srv.rate)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div ref={catListRef} className="overflow-y-auto space-y-1 pr-1 flex-1">
                      {filteredCategoriesForPicker.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-4">No categories match your search.</div>
                      ) : (
                        filteredCategoriesForPicker.map((cat) => {
                          const isSelected = selectedCategory === cat;
                          const catInfo = getPlatformInfo(cat, cat);
                          const CatIcon = catInfo.icon;
                          const count = categoryCounts[cat] || 0;
                          return (
                            <button
                              key={cat}
                              type="button"
                              data-selected={isSelected || undefined}
                              onClick={() => {
                                setSelectedCategory(cat);
                                setCatPickerOpen(false);
                                setCatSearch("");
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-xs font-medium text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white text-black font-semibold shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                                  : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate pr-2">
                                <div
                                  className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 border ${
                                    isSelected
                                      ? "bg-black/10 border-black/20 text-black"
                                      : "bg-white/[0.04] border-white/10 text-[#E4E4E7]"
                                  }`}
                                >
                                  <CatIcon size={14} />
                                </div>
                                <span className="truncate">{highlightMatch(cat, catSearch)}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none border ${
                                    isSelected
                                      ? "bg-black/10 border-black/20 text-black"
                                      : "bg-white/[0.04] border-white/10 text-zinc-400"
                                  }`}
                                >
                                  {count}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-black" />}
                              </div>
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
                  className="w-full flex items-center justify-between p-3.5 rounded-none border border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30 transition-all text-left cursor-pointer group"
                >
                  <div className="truncate pr-2">
                    {currentService ? (
                      <div>
                        <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-sm bg-white/[0.08] text-[11px] font-medium text-zinc-300">
                            #{currentService.service}
                          </span>
                          <span className="truncate">{currentService.name}</span>
                        </div>
                        <div className="text-xs text-[#FFFFFF] font-semibold mt-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                          {formatINR(currentService.rate)} <span className="text-[10px] text-[#E4E4E7] font-normal">/ 1,000 units</span>
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
                  <div className="absolute top-full left-0 right-0 mt-2 z-30 rounded-none border border-white/15 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.9)] p-3 space-y-2 max-h-96 flex flex-col">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search service name, ID (e.g. 2664), or speed..."
                        autoFocus
                        className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs rounded-none outline-none"
                      />
                    </div>

                    <div ref={serviceListRef} className="overflow-y-auto space-y-2 pr-1 flex-1">
                      {filteredServicesForPicker.length === 0 ? (
                        <div className="text-xs text-zinc-400 text-center py-6 space-y-3">
                          <div>No services match &ldquo;{serviceSearch}&rdquo; in this category.</div>
                          {matchingAllCategoriesCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSearchAcrossAllCategories();
                                setServicePickerOpen(false);
                                setServiceSearch("");
                              }}
                              className="px-3.5 py-2 bg-white text-black font-semibold text-xs tracking-wider rounded-none hover:bg-zinc-200 transition-all cursor-pointer inline-flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Search Across All Categories ({matchingAllCategoriesCount} found)</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredServicesForPicker.map((s) => {
                          const isSelected = Number(s.service) === Number(selectedServiceId);
                          return (
                            <button
                              key={s.service}
                              type="button"
                              data-selected={isSelected || undefined}
                              onClick={() => {
                                setSelectedServiceId(s.service);
                                setServicePickerOpen(false);
                                setServiceSearch("");
                              }}
                              className={`w-full p-3 rounded-none text-left transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-white/[0.08] border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                  : "bg-black/40 border-white/[0.06] hover:border-white/20 hover:bg-white/[0.03]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-xs font-semibold text-white leading-snug line-clamp-2">
                                  #{highlightMatch(String(s.service), serviceSearch)} — {highlightMatch(s.name, serviceSearch)}
                                </span>
                                <span className="text-xs font-semibold text-[#FFFFFF] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] shrink-0">
                                  {formatINR(s.rate)} <span className="text-[10px] text-[#E4E4E7] font-normal">/ 1K</span>
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                                <span>Min: {formatNumber(s.min)} &bull; Max: {formatNumber(s.max)}</span>
                                {(() => {
                                  const policy = parseRefillPolicy(s);
                                  return policy.hasRefill ? (
                                    <span className="text-[#E4E4E7] font-medium flex items-center gap-0.5">
                                      <RotateCcw className="w-2.5 h-2.5" /> {policy.shortLabel}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600 font-normal">No Refill</span>
                                  );
                                })()}
                                {s.average_time && (
                                  <span className="text-zinc-400 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-zinc-500" />
                                    {formatAverageTime(s.average_time)}
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

              <div className="p-3.5 border border-white/[0.08] bg-black/30 space-y-3" aria-label="Saved services and templates">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={toggleFavorite} disabled={!currentService || presetBusy.startsWith("favorite:")} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40" aria-pressed={currentServiceIsFavorite}>
                    <Heart className={`w-3.5 h-3.5 ${currentServiceIsFavorite ? "fill-current" : ""}`} /> {currentServiceIsFavorite ? "Favourited" : "Add favourite"}
                  </button>
                  {favorites.length > 0 && (
                    <select
                      aria-label="Choose a favourite service"
                      defaultValue=""
                      onChange={(event) => { if (event.target.value) applySavedService(event.target.value); event.currentTarget.value = ""; }}
                      className="bg-black/70 border border-white/10 px-3 py-2 text-[11px] text-zinc-300 outline-none"
                    >
                      <option value="">Open favourite…</option>
                      {favorites.map((serviceId) => {
                        const service = services.find((item) => String(item.service) === serviceId);
                        return <option key={serviceId} value={serviceId}>#{serviceId} {service?.name || "Unavailable service"}</option>;
                      })}
                    </select>
                  )}
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                  <label className="sr-only" htmlFor="template-name">Template name</label>
                  <input id="template-name" type="text" maxLength={60} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name (target is never saved)" className="bg-black/60 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-white/30" />
                  <button type="button" onClick={saveTemplate} disabled={!currentService || presetBusy === "template-save"} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40"><BookmarkPlus className="w-3.5 h-3.5" /> Save template</button>
                </div>

                {templates.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">Saved templates</p>
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <button type="button" onClick={() => applySavedService(template.serviceId, template.quantity)} className="min-w-0 text-left text-zinc-300 hover:text-white truncate">{template.name} · #{template.serviceId}{template.quantity ? ` · ${formatNumber(template.quantity)}` : ""}</button>
                        <button type="button" onClick={() => deleteTemplate(template.id)} disabled={presetBusy === `template-delete:${template.id}`} aria-label={`Delete template ${template.name}`} className="p-1 text-zinc-600 hover:text-red-300 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-zinc-600">For privacy, templates save only the current service and optional quantity—not target links, usernames or comments.</p>
              </div>

              {/* 3. Target Link */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  3. Target Link or Username
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    ref={targetLinkInputRef}
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://t.me/channel or https://instagram.com/p/..."
                    required
                    className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
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
                    className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white p-4 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>
              ) : currentService?.type === "Package" ? (
                <div className="p-4 rounded-none border border-white/10 bg-white/[0.02] text-sm text-zinc-300">
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
                      onChange={(e) => {
                        // Live clamp: only allow values within this service's min/max
                        const raw = e.target.value;
                        if (raw === "") { setQuantity(""); return; }
                        const n = parseInt(raw, 10);
                        if (isNaN(n)) return;
                        const hi = currentService?.max ?? 2147483647;
                        // Live-clamp max only; min snaps on blur so multi-digit typing works
                        setQuantity(Math.min(hi, n));
                      }}
                      onBlur={(e) => {
                        // Snap to nearest bound on blur
                        const n = parseInt(e.target.value, 10);
                        if (isNaN(n)) { setQuantity(currentService?.min ?? 1); return; }
                        const lo = currentService?.min ?? 1;
                        const hi = currentService?.max ?? 2147483647;
                        setQuantity(Math.min(hi, Math.max(lo, n)));
                      }}
                      min={currentService?.min || 1}
                      max={currentService?.max || 2147483647}
                      placeholder={currentService ? `${formatNumber(currentService.min)} – ${formatNumber(currentService.max)}` : "1000"}
                      required
                      className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              )}

              {/* Transparent Financial Calculation in Plain, Simple Language */}
              <div className="p-5 rounded-none border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Total Order Cost</span>
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {formatINR(calculatedCharge)}
                  </span>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/[0.06] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Current Wallet Balance:</span>
                    {user ? (
                      <span className="font-semibold text-[#FFFFFF]">
                        {formatINR(userBalance)}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Sign in to check</span>
                    )}
                  </div>

                  {user && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                      <span className="text-zinc-400">Balance Left After Order:</span>
                      <span
                        className={`font-semibold ${
                          userBalance >= calculatedCharge
                            ? "text-[#FAF9F7] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                            : "text-zinc-100"
                        }`}
                      >
                        {userBalance >= calculatedCharge
                          ? formatINR(userBalance - calculatedCharge)
                          : `Short by ${formatINR(calculatedCharge - userBalance)}`}
                      </span>
                    </div>
                  )}
                </div>

                {user && userBalance < calculatedCharge && (
                  <div className="pt-2">
                    <a
                      href={pathFor("add-funds")}
                      className="w-full py-2.5 rounded-none border border-white/15 bg-white/[0.06] text-zinc-100 font-semibold text-xs tracking-wider hover:bg-white/[0.06] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExecutiveWalletIcon size={15} />
                      <span>Wallet Low — Add Funds</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {errorMsg && (
                <div role="alert" className="p-4 rounded-none bg-white/[0.06] border border-white/15 text-zinc-100 text-xs sm:text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-zinc-100" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div role="status" aria-live="polite" className="p-4 rounded-none bg-[#E4E4E7]/10 border border-[#E4E4E7]/30 text-[#FAF9F7] text-xs sm:text-sm flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-[#E4E4E7]" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-[0.12em] text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Transmitting to Wholesale Node...</span>
                  </>
                ) : (
                  <>
                    <ExecutiveOrderIcon size={16} />
                    <span>Confirm &amp; Place Order</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Service Intelligence & Rules */}
        <div className="lg:col-span-5 space-y-6">
          {currentService && platformInfo ? (
            <div className="p-6 sm:p-8 rounded-none border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
              {/* Header with SVG */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-none flex items-center justify-center border border-white/10 bg-white/[0.03]">
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
                <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Wholesale Rate</span>
                  <span className="text-base font-bold text-[#FFFFFF] drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
                    {formatINR(currentService.rate)} <span className="text-xs text-[#E4E4E7] font-normal">/ 1K</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Average Time</span>
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    {formatAverageTime(currentService.average_time)}
                  </span>
                </div>

                {(() => {
                  const policy = parseRefillPolicy(currentService);
                  return (
                    <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Refill Policy</span>
                      <span className={`text-sm font-semibold flex items-center gap-1.5 ${policy.hasRefill ? "text-[#E4E4E7]" : "text-zinc-500"}`}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        {policy.label}
                      </span>
                    </div>
                  );
                })()}

                <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
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
                <div className="p-4 rounded-none border border-white/[0.06] bg-black/30 text-xs text-zinc-300 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                  {cleanServiceDescription(currentService.description)}
                </div>
              </div>

              {/* Guarantees */}
              <div className="space-y-2.5 pt-4 border-t border-white/[0.06] text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#E4E4E7] shrink-0" />
                  <span>Account privacy strictly maintained. Never requires passwords.</span>
                </div>
                <a
                  href={pathFor("terms")}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs"
                >
                  <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="underline">Review Service Terms &amp; Policies</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-none border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl text-center">
              <Sparkles className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Select a category and service to inspect specifications.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
