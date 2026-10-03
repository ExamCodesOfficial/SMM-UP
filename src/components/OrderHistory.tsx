import React from "react";
import {
  ListOrdered,
  Search,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { formatINR, formatNumber, sanitizeBrandText, parseRefillPolicy } from "../lib/utils";
import { getPlatformInfo } from "./icons/PlatformIcons";

interface Order {
  id: string;
  orderId: number | string;
  serviceId: number;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  refillAvailable: boolean;
  refillDays?: number;
  refillLabel?: string;
  cancelAvailable: boolean;
  createdAt: string;
}

interface OrderHistoryProps {
  orders: Order[];
  onRefresh: () => void;
  loading: boolean;
}

export default function OrderHistory({ orders, onRefresh, loading }: OrderHistoryProps) {
  const [filterTab, setFilterTab] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [actionMsg, setActionMsg] = React.useState<{ id: string; msg: string; err?: boolean } | null>(null);

  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const matchFilter =
        filterTab === "All"
          ? true
          : filterTab === "Active"
          ? /pending|processing|in progress/i.test(o.status)
          : new RegExp(filterTab, "i").test(o.status);

      const matchSearch =
        !searchQuery ||
        String(o.orderId).includes(searchQuery) ||
        o.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.link.toLowerCase().includes(searchQuery.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [orders, filterTab, searchQuery]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRefill = async (orderId: string) => {
    setActionLoadingId(orderId);
    setActionMsg(null);
    try {
      const res = await fetch("/api/orders/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ id: orderId, msg: "Refill requested successfully" });
      } else {
        setActionMsg({ id: orderId, msg: data.error || "Refill failed", err: true });
      }
    } catch {
      setActionMsg({ id: orderId, msg: "Network error", err: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckStatus = async (orderId: string) => {
    setActionLoadingId(orderId);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/orders/status?id=${orderId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ id: orderId, msg: `Live status: ${data.status}` });
        onRefresh();
      } else {
        setActionMsg({ id: orderId, msg: data.error || "Failed to query status", err: true });
      }
    } catch {
      setActionMsg({ id: orderId, msg: "Network error", err: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("completed")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed</span>
        </span>
      );
    }
    if (s.includes("in progress") || s.includes("processing")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>Processing</span>
        </span>
      );
    }
    if (s.includes("pending")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          <span>Pending</span>
        </span>
      );
    }
    if (s.includes("cancel") || s.includes("refund")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          <span>Canceled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-zinc-300 border border-white/20">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
      {/* Title Section */}
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
          ORDER LOGS
        </h2>
        <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
        <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-xl mx-auto">
          Review real-time provisioning progress, automated refills, and delivery logs.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 p-4 rounded-2xl border border-white/[0.08] bg-zinc-950/60 backdrop-blur-xl">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {["All", "Active", "Completed", "Canceled"].map((tab) => {
            const isActive = filterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.25)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {tab.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID or target link..."
              className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-10 pr-4 py-2 rounded-xl text-xs outline-none transition-all placeholder:text-zinc-500"
            />
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all bg-white/[0.02] cursor-pointer"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/90 border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-4 px-5">Order ID</th>
                <th className="py-4 px-5">Platform &amp; Service</th>
                <th className="py-4 px-5">Target Link</th>
                <th className="py-4 px-5">Quantity</th>
                <th className="py-4 px-5">Charge</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-400">
                    <ListOrdered className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <span>No orders found matching the filter.</span>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const sanitizedName = sanitizeBrandText(ord.serviceName);
                  const sanitizedCategory = sanitizeBrandText(ord.category);
                  const platformInfo = getPlatformInfo(sanitizedCategory, sanitizedName);
                  const PlatformIcon = platformInfo.icon;

                  return (
                    <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Order ID */}
                      <td className="py-4 px-5 font-semibold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>#{ord.orderId || ord.id.slice(-6)}</span>
                          <button
                            onClick={() => copyToClipboard(String(ord.orderId || ord.id), ord.id)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Copy ID"
                          >
                            {copiedId === ord.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-normal mt-0.5">
                          {new Date(ord.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Platform & Service */}
                      <td className="py-4 px-5 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <PlatformIcon size={16} />
                          <span className="text-[11px] font-semibold text-zinc-300 uppercase">
                            {platformInfo.name}
                          </span>
                        </div>
                        <div className="font-medium text-white truncate">{sanitizedName}</div>
                        <div className="mt-1">
                          {(() => {
                            const policy = parseRefillPolicy({
                              name: sanitizedName,
                              category: sanitizedCategory,
                              refill: ord.refillAvailable,
                              refill_label: ord.refillLabel,
                              refill_days: ord.refillDays,
                            });
                            return policy.hasRefill ? (
                              <span className="text-[10px] text-[#F5E8D0] font-medium flex items-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" />
                                {policy.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-medium">No Refill</span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Target Link */}
                      <td className="py-4 px-5 max-w-[200px]">
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <span className="truncate">{ord.link}</span>
                          <button
                            onClick={() => copyToClipboard(ord.link, ord.id + "_link")}
                            className="text-zinc-500 hover:text-white transition-colors shrink-0"
                            title="Copy link"
                          >
                            {copiedId === ord.id + "_link" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-5 font-semibold text-white whitespace-nowrap">
                        {formatNumber(ord.quantity)}
                      </td>

                      {/* Charge */}
                      <td className="py-4 px-5 font-bold text-[#F5E8D0] whitespace-nowrap text-sm">
                        {formatINR(ord.charge)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {getStatusBadge(ord.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleCheckStatus(ord.id)}
                            disabled={actionLoadingId === ord.id}
                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                          >
                            Status
                          </button>

                          {ord.refillAvailable && (
                            <button
                              onClick={() => handleRefill(ord.id)}
                              disabled={actionLoadingId === ord.id}
                              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium transition-all cursor-pointer flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Refill</span>
                            </button>
                          )}
                        </div>

                        {actionMsg?.id === ord.id && (
                          <div
                            className={`text-[10px] mt-1 ${
                              actionMsg.err ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {actionMsg.msg}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
