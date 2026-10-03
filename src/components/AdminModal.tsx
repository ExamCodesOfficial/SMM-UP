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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl border border-amber-500/30 bg-black rounded-sm shadow-[0_0_50px_rgba(245,158,11,0.08)] p-6 sm:p-8 font-sans max-h-[90vh] overflow-y-auto">
        {/* Subtle corner brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-amber-500/40 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-amber-500/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-amber-500/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-amber-500/40 pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold tracking-widest text-white uppercase">
                ADMIN CONTROL CENTER
              </h2>
              <p className="text-[10px] text-gray-500 font-mono">FINANCIAL & PLATFORM AUDIT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="p-1.5 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white rounded-sm transition-all"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Platform KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 font-mono">
          <div className="p-3 border border-white/[0.08] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">TOTAL CLIENTS</div>
            <div className="text-lg font-bold text-white">{formatNumber(stats?.totalUsers || 0)}</div>
          </div>
          <div className="p-3 border border-white/[0.08] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">ORDERS PROVISIONED</div>
            <div className="text-lg font-bold text-white">{formatNumber(stats?.totalOrders || 0)}</div>
          </div>
          <div className="p-3 border border-white/[0.08] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">GROSS REVENUE</div>
            <div className="text-lg font-bold text-white">{formatINR(stats?.totalRevenue || 0)}</div>
          </div>
          <div className="p-3 border border-white/[0.08] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">NET PROFIT MARGIN</div>
            <div className="text-lg font-bold text-emerald-400">{formatINR(stats?.totalProfit || 0)}</div>
          </div>
          <div className="p-3 border border-white/[0.08] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">SETTLED DEPOSITS</div>
            <div className="text-lg font-bold text-white">{formatNumber(stats?.totalDeposits || 0)}</div>
          </div>
          <div className="p-3 border border-amber-500/20 bg-amber-500/5 rounded-sm">
            <div className="text-[9px] text-amber-400 uppercase tracking-wider mb-1">SMM PROVIDER FLOAT</div>
            <div className="text-lg font-bold text-amber-400">{formatINR(stats?.wholesaleBalance || 0)}</div>
          </div>
        </div>

        {/* Manual User Balance Adjustment */}
        <div className="p-5 border border-white/10 bg-white/[0.02] rounded-sm">
          <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-3 flex items-center gap-1.5 font-mono">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>MANUAL CLIENT BALANCE ADJUSTMENT</span>
          </h3>

          <form onSubmit={handleAdjustBalance} className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">CLIENT EMAIL</label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 rounded-sm outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-bold mb-1">
                  AMOUNT ADJUSTMENT (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 500 or -100"
                  className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 rounded-sm outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 font-bold mb-1">REASON / NOTE</label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Manual payment receipt verification or bonus"
                className="w-full bg-black/60 border border-white/10 text-white px-3 py-2 rounded-sm outline-none"
              />
            </div>

            {adjustMsg && (
              <div
                className={`p-2.5 border rounded-sm text-xs flex items-center gap-2 ${
                  adjustMsg.err
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {adjustMsg.err ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{adjustMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={adjusting}
              className="w-full py-2.5 bg-white text-black font-bold text-xs tracking-widest rounded-sm hover:bg-neutral-200 transition-all cursor-pointer disabled:opacity-50 mt-1"
            >
              {adjusting ? "COMMITTING ADJUSTMENT..." : "COMMIT BALANCE ADJUSTMENT"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
