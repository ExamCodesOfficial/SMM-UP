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
  Filter,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR, formatNumber } from "../lib/utils";

interface Service {
  service: number | string;
  name: string;
  type: string;
  category: string;
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
  preselectedServiceId?: number | string | null;
}

const PLATFORMS = [
  "All",
  "Telegram",
  "Instagram",
  "YouTube",
  "Facebook",
  "TikTok",
  "Twitter / X",
  "WhatsApp",
  "LinkedIn",
  "Other",
];

export default function NewOrder({
  services,
  user,
  onOrderSuccess,
  onOpenWallet,
  onOpenAuth,
  preselectedServiceId,
}: NewOrderProps) {
  const [selectedPlatform, setSelectedPlatform] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedServiceId, setSelectedServiceId] = React.useState<number | string>("");

  const [link, setLink] = React.useState("");
  const [quantity, setQuantity] = React.useState<number | string>("");
  const [comments, setComments] = React.useState("");
  const [answerNumber, setAnswerNumber] = React.useState("1");

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  // Filter services by platform
  const filteredServices = React.useMemo(() => {
    return services.filter((s) => {
      const matchPlatform =
        selectedPlatform === "All"
          ? true
          : selectedPlatform === "Twitter / X"
          ? /twitter| x |tweet/i.test(s.category + " " + s.name)
          : selectedPlatform === "Other"
          ? !/telegram|instagram|youtube|facebook|tiktok|twitter|whatsapp|linkedin/i.test(s.category + " " + s.name)
          : new RegExp(selectedPlatform, "i").test(s.category + " " + s.name);

      const matchSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.service) === searchQuery.trim();

      return matchPlatform && matchSearch;
    });
  }, [services, selectedPlatform, searchQuery]);

  // Categories present in current filter
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    filteredServices.forEach((s) => set.add(s.category));
    return Array.from(set).sort();
  }, [filteredServices]);

  // Auto-select category if none or invalid
  React.useEffect(() => {
    if (categories.length > 0 && (!selectedCategory || !categories.includes(selectedCategory))) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  // Services in current category
  const servicesInCategory = React.useMemo(() => {
    return filteredServices.filter((s) => s.category === selectedCategory);
  }, [filteredServices, selectedCategory]);

  // Active Service object
  const currentService = React.useMemo(() => {
    return services.find((s) => String(s.service) === String(selectedServiceId)) || servicesInCategory[0] || null;
  }, [services, selectedServiceId, servicesInCategory]);

  // Set initial selected service
  React.useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId);
      const target = services.find((s) => String(s.service) === String(preselectedServiceId));
      if (target) setSelectedCategory(target.category);
    } else if (servicesInCategory.length > 0 && !servicesInCategory.some((s) => String(s.service) === String(selectedServiceId))) {
      setSelectedServiceId(servicesInCategory[0].service);
    }
  }, [servicesInCategory, preselectedServiceId, services]);

  // Default quantity to service min
  React.useEffect(() => {
    if (currentService) {
      if (currentService.type !== "Custom Comments" && (!quantity || Number(quantity) < currentService.min)) {
        setQuantity(currentService.min);
      }
    }
  }, [currentService]);

  // Calculate live charge
  const calculatedCharge = React.useMemo(() => {
    if (!currentService) return 0;

    let effQty = 0;
    if (currentService.type === "Custom Comments") {
      const lines = comments.split("\n").filter((l) => l.trim().length > 0);
      effQty = lines.length;
    } else if (currentService.type === "Package") {
      effQty = 1;
    } else {
      effQty = parseInt(String(quantity), 10) || 0;
    }

    if (effQty <= 0) return 0;
    const charge = (currentService.rate * effQty) / 1000;
    return Math.max(0.10, Math.round(charge * 100) / 100);
  }, [currentService, quantity, comments]);

  const hasEnoughBalance = user ? (user.balance || 0) >= calculatedCharge : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!user) {
      onOpenAuth();
      return;
    }

    if (!link.trim()) {
      setErrorMsg("Please enter a target link or username.");
      return;
    }

    if (!currentService) {
      setErrorMsg("Please select a service.");
      return;
    }

    if (!hasEnoughBalance) {
      setErrorMsg(`Insufficient wallet balance. Required: ${formatINR(calculatedCharge)}, Available: ${formatINR(user.balance)}`);
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
        setErrorMsg(data.error || "Order failed. Please try again.");
      } else {
        setSuccessMsg(`Order #${data.providerOrderId || data.orderId} placed successfully!`);
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
        onOrderSuccess(data);
        setLink("");
      }
    } catch (err) {
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Platform Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {PLATFORMS.map((platform) => {
          const isActive = selectedPlatform === platform;
          return (
            <button
              key={platform}
              onClick={() => {
                setSelectedPlatform(platform);
                setSearchQuery("");
              }}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-medium tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-black font-semibold shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : "bg-white/[0.02] border border-white/10 text-gray-400 hover:text-white hover:border-white/30"
              }`}
            >
              {platform}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Order Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 border border-white/10 bg-white/[0.02] rounded-sm relative shadow-[0_0_30px_rgba(255,255,255,0.02)]">
            {/* Subtle corner brackets from ExamCodes */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/30 pointer-events-none" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/30 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/30 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/30 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-[0.14em] text-white flex items-center gap-2">
                  <span>DISPATCH ORDER</span>
                  <span className="text-[10px] text-white/40">❖</span>
                </h2>
                <p className="text-[11px] text-gray-500 font-mono tracking-wider">
                  INSTANT WHOLESALE SMM PROVISIONING
                </p>
              </div>
              <div className="text-[10px] font-mono text-gray-400 border border-white/10 px-2 py-1 bg-white/[0.02] rounded-sm">
                NODE: ASIA-CENTRAL
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Quick Search across 2174 services */}
              <div>
                <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                  QUICK FILTER / SEARCH
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search keywords or ID (e.g. Followers, Views, 1420)..."
                    className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-4 py-2.5 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                  CATEGORY ({categories.length})
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                  }}
                  className="w-full bg-black/80 border border-white/10 focus:border-white/40 text-white px-3 py-2.5 text-xs font-mono rounded-sm outline-none transition-all"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-neutral-900 text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Dropdown */}
              <div>
                <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                  SERVICE ({servicesInCategory.length} IN THIS CATEGORY)
                </label>
                <select
                  value={currentService?.service || ""}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-black/80 border border-white/10 focus:border-white/40 text-white px-3 py-2.5 text-xs font-mono rounded-sm outline-none transition-all truncate"
                >
                  {servicesInCategory.map((s) => (
                    <option key={s.service} value={s.service} className="bg-neutral-900 text-white">
                      #{s.service} — {s.name} ({formatINR(s.rate)}/1K)
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Link */}
              <div>
                <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                  TARGET LINK / USERNAME
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://instagram.com/p/... or @channel"
                    className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-4 py-2.5 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                    required
                  />
                  <Link2 className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Custom Comments vs Standard Quantity */}
              {currentService?.type === "Custom Comments" ? (
                <div>
                  <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                    CUSTOM COMMENTS (1 PER LINE)
                  </label>
                  <textarea
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Nice picture!&#10;Great work&#10;Love this post"
                    className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white p-3 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                    required
                  />
                  <div className="text-[10px] text-gray-500 font-mono mt-1">
                    Count: {comments.split("\n").filter((l) => l.trim().length > 0).length} comments
                  </div>
                </div>
              ) : currentService?.type === "Package" ? (
                <div className="p-3 border border-white/10 bg-white/[0.01] rounded-sm text-xs text-gray-400 font-mono">
                  Package Service: Fixed quantity provisioned on submission.
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] tracking-[0.2em] text-gray-400 font-bold">
                      QUANTITY
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Min: {formatNumber(currentService?.min)} — Max: {formatNumber(currentService?.max)}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={quantity}
                    min={currentService?.min || 10}
                    max={currentService?.max || 100000}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white px-4 py-2.5 text-xs font-mono rounded-sm outline-none transition-all"
                    required
                  />

                  {/* Quick-add chips */}
                  <div className="flex gap-1.5 mt-2">
                    {[100, 500, 1000, 5000].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setQuantity(chip)}
                        className="px-2 py-1 border border-white/10 hover:border-white/30 text-[10px] font-mono text-gray-400 hover:text-white rounded-sm transition-colors cursor-pointer"
                      >
                        +{chip}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuantity(currentService?.max || 10000)}
                      className="px-2 py-1 border border-white/10 hover:border-white/30 text-[10px] font-mono text-gray-400 hover:text-white rounded-sm transition-colors cursor-pointer"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              )}

              {/* Status & Alerts */}
              {errorMsg && (
                <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono rounded-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono rounded-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              {user ? (
                hasEnoughBalance ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? "PROVISIONING ORDER..." : `CONFIRM & SUBMIT ORDER (${formatINR(calculatedCharge)})`}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenWallet}
                    className="w-full py-3 border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                  >
                    <span>INSUFFICIENT FUNDS — ADD {formatINR(calculatedCharge - (user.balance || 0))}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  SIGN IN TO PLACE ORDER
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Service Intel & Cost Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cost Summary Box */}
          <div className="p-6 border border-white/10 bg-white/[0.02] rounded-sm relative">
            <h3 className="text-xs font-bold tracking-[0.16em] text-white uppercase mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>LIVE COST BREAKDOWN</span>
            </h3>

            <div className="space-y-3 font-mono text-xs border-b border-white/10 pb-4 mb-4">
              <div className="flex justify-between items-center text-gray-400">
                <span>Rate per 1,000</span>
                <span className="text-white font-semibold">{formatINR(currentService?.rate)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span>Quantity</span>
                <span className="text-white">
                  {currentService?.type === "Custom Comments"
                    ? `${comments.split("\n").filter((l) => l.trim().length > 0).length} lines`
                    : formatNumber(quantity)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span>Account Balance</span>
                <span className="text-white">{formatINR(user?.balance || 0)}</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline mb-4">
              <span className="text-xs font-bold tracking-wider text-gray-400">TOTAL CHARGE</span>
              <span className="text-2xl font-mono font-bold text-white tracking-tight">
                {formatINR(calculatedCharge)}
              </span>
            </div>

            <div className="text-[10px] text-gray-500 font-mono">
              * Charges are debited atomically upon wholesale verification.
            </div>
          </div>

          {/* Service Specifications Card */}
          {currentService && (
            <div className="p-6 border border-white/10 bg-white/[0.02] rounded-sm space-y-4">
              <h3 className="text-xs font-bold tracking-[0.16em] text-white uppercase flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>SERVICE SPECIFICATIONS</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 border border-white/[0.06] bg-black/40 rounded-sm">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">SERVICE ID</div>
                  <div className="text-white font-bold">#{currentService.service}</div>
                </div>
                <div className="p-3 border border-white/[0.06] bg-black/40 rounded-sm">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">AVG SPEED</div>
                  <div className="text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{currentService.average_time || "Instant"}</span>
                  </div>
                </div>
                <div className="p-3 border border-white/[0.06] bg-black/40 rounded-sm">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">REFILL</div>
                  <div className={currentService.refill ? "text-emerald-400 font-bold" : "text-gray-500"}>
                    {currentService.refill ? "GUARANTEED REFILL" : "NO REFILL"}
                  </div>
                </div>
                <div className="p-3 border border-white/[0.06] bg-black/40 rounded-sm">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">CANCELABLE</div>
                  <div className={currentService.cancel ? "text-emerald-400" : "text-gray-500"}>
                    {currentService.cancel ? "YES" : "NO"}
                  </div>
                </div>
              </div>

              {/* Service Description */}
              <div>
                <div className="text-[9px] font-mono tracking-widest text-gray-500 uppercase mb-1">
                  DESCRIPTION & INSTRUCTIONS
                </div>
                <div className="p-3 border border-white/[0.06] bg-black/60 text-gray-400 text-xs font-mono leading-relaxed rounded-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {currentService.description || "Instant high-speed delivery node. Account must be set to public."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
