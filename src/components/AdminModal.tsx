import React from "react";
import { Shield, X, Users, ShoppingBag, Wallet, TrendingUp, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminModal({ isOpen, onClose }: AdminModalProps) {
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  // Manual Adjustment form
  const [targetEmail, setTargetEmail] = React.useState("");
  const [adjustAmount, setAdjustAmount] = React.useState("");
  const [adjustReason, setAdjustReason] = React.useState("");
  const [adjusting, setAdjusting] = React.useState(false);
  const [adjustMsg, setAdjustMsg] = React.useState<{ text: string; err?: boolean } | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (res.ok && data.stats) {
        setStats(data.stats);
      }
    } catch {}
    setLoading(false);
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustMsg(null);
    setAdjusting(true);

    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: targetEmail.trim(),
          amountAdjustment: parseFloat(adjustAmount),
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdjustMsg({ text: data.message });
        setTargetEmail("");
        setAdjustAmount("");
        setAdjustReason("");
        loadStats();
      } else {
        setAdjustMsg({ text: data.error || "Adjustment failed", err: true });
      }
    } catch {
      setAdjustMsg({ text: "Network error", err: true });
    } finally {
      setAdjusting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl border border-white/10 bg-zinc-950/95 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.8)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                Admin Control Desk
              </h2>
              <p className="text-xs text-zinc-400">Platform Analytics & Financial Oversight</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="p-2 rounded-xl border border-white/10 hover:border-white/30 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Platform KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Registered Users</div>
            <div className="text-xl font-bold text-white">{formatNumber(stats?.totalUsers || 0)}</div>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Orders Dispatched</div>
            <div className="text-xl font-bold text-white">{formatNumber(stats?.totalOrders || 0)}</div>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Gross Revenue</div>
            <div className="text-xl font-bold text-white">{formatINR(stats?.totalRevenue || 0)}</div>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Net Realized Profit</div>
            <div className="text-xl font-bold text-emerald-400">{formatINR(stats?.totalProfit || 0)}</div>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Verified UPI Deposits</div>
            <div className="text-xl font-bold text-white">{formatNumber(stats?.totalDeposits || 0)}</div>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">SMM Provider Balance</div>
            <div className="text-xl font-bold text-amber-400">{formatINR(stats?.wholesaleBalance || 0)}</div>
          </div>
        </div>

        {/* Manual User Balance Adjustment */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.015]">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-300 uppercase mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Manual User Balance Adjustment</span>
          </h3>

          <form onSubmit={handleAdjustBalance} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">User Email Address</label>
              <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="client@domain.com"
                required
                className="w-full bg-black/60 border border-white/10 focus:border-white/30 text-white px-3.5 py-2.5 text-xs rounded-xl outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Amount Adjustment (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. +100 or -50"
                  required
                  className="w-full bg-black/60 border border-white/10 focus:border-white/30 text-white px-3.5 py-2.5 text-xs rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Adjustment Note / Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. UPI dispute resolution"
                  className="w-full bg-black/60 border border-white/10 focus:border-white/30 text-white px-3.5 py-2.5 text-xs rounded-xl outline-none"
                />
              </div>
            </div>

            {adjustMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  adjustMsg.err
                    ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                    : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                }`}
              >
                {adjustMsg.err ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>{adjustMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={adjusting}
              className="py-2.5 px-5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {adjusting ? "Processing Adjustment..." : "Execute Balance Change"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
