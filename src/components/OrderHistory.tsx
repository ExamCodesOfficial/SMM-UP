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
} from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

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

  const handleRefill = async (order: Order) => {
    setActionLoadingId(order.id);
    setActionMsg(null);
    try {
      const res = await fetch("/api/orders/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ id: order.id, msg: "Refill Submitted!" });
      } else {
        setActionMsg({ id: order.id, msg: data.error || "Refill rejected", err: true });
      }
    } catch {
      setActionMsg({ id: order.id, msg: "Error", err: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStatusCheck = async (order: Order) => {
    setActionLoadingId(order.id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/orders/status?id=${order.id}`);
      const data = await res.json();
      if (res.ok && data.status) {
        setActionMsg({ id: order.id, msg: `Status: ${data.status}` });
        onRefresh();
      } else {
        setActionMsg({ id: order.id, msg: "Failed", err: true });
      }
    } catch {
      setActionMsg({ id: order.id, msg: "Error", err: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "Pending").toLowerCase();
    if (s.includes("completed")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> COMPLETED
        </span>
      );
    }
    if (s.includes("in progress") || s.includes("processing")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <Clock className="w-3 h-3 animate-spin" /> {s.toUpperCase()}
        </span>
      );
    }
    if (s.includes("partial")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" /> PARTIAL
        </span>
      );
    }
    if (s.includes("cancel")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
          <XCircle className="w-3 h-3" /> CANCELED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
        <Clock className="w-3 h-3" /> PENDING
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Search and Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-[0.14em] text-white flex items-center gap-2">
            <ListOrdered className="w-4 h-4" />
            <span>DISPATCHED ORDERS</span>
            <span className="text-[10px] text-white/40">❖</span>
          </h2>
          <p className="text-[11px] text-gray-500 font-mono tracking-wider">
            REAL-TIME PROVISIONING LEDGER
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID or link..."
              className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-8 pr-3 py-1.5 text-xs font-mono rounded-sm outline-none placeholder:text-gray-600"
            />
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 border border-white/15 hover:border-white/40 text-gray-300 hover:text-white rounded-sm transition-all cursor-pointer bg-white/[0.02]"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {["All", "Active", "Completed", "Partial", "Canceled"].map((tab) => {
          const isActive = filterTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1 rounded-sm text-xs font-mono tracking-wider transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-black font-semibold shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04] border border-white/5"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Orders Table */}
      <div className="border border-white/10 bg-white/[0.01] rounded-sm overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-black/80 border-b border-white/10 text-gray-500 uppercase tracking-widest text-[10px]">
              <tr>
                <th className="py-3 px-4">ORDER ID</th>
                <th className="py-3 px-4">SERVICE</th>
                <th className="py-3 px-4">TARGET LINK</th>
                <th className="py-3 px-4">QUANTITY</th>
                <th className="py-3 px-4">CHARGE</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-mono">
                    No orders found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      #{ord.orderId || ord.id.slice(-6)}
                      <div className="text-[9px] text-gray-600 font-normal">
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-gray-300">
                      <div className="truncate font-semibold">{ord.serviceName}</div>
                      <div className="text-[10px] text-gray-500 truncate">{ord.category}</div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <span className="truncate">{ord.link}</span>
                        <button
                          onClick={() => copyToClipboard(ord.link, ord.id)}
                          className="hover:text-white transition-colors cursor-pointer"
                          title="Copy Link"
                        >
                          {copiedId === ord.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-white whitespace-nowrap">
                      {formatNumber(ord.quantity)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      {formatINR(ord.charge)}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(ord.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Refill Button */}
                        {ord.refillAvailable && (
                          <button
                            onClick={() => handleRefill(ord)}
                            disabled={actionLoadingId === ord.id}
                            className="px-2 py-1 border border-white/10 hover:border-white/30 text-[10px] tracking-wider text-gray-300 hover:text-white rounded-sm transition-all flex items-center gap-1 cursor-pointer"
                            title="Request Refill"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>REFILL</span>
                          </button>
                        )}

                        {/* Status Check Button */}
                        <button
                          onClick={() => handleStatusCheck(ord)}
                          disabled={actionLoadingId === ord.id}
                          className="px-2 py-1 border border-white/10 hover:border-white/30 text-[10px] tracking-wider text-gray-400 hover:text-white rounded-sm transition-all flex items-center gap-1 cursor-pointer"
                          title="Recheck Live Status"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${actionLoadingId === ord.id ? "animate-spin" : ""}`} />
                        </button>
                      </div>

                      {actionMsg && actionMsg.id === ord.id && (
                        <div className={`text-[9px] font-mono mt-1 ${actionMsg.err ? "text-red-400" : "text-emerald-400"}`}>
                          {actionMsg.msg}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
