import React from "react";
import { User, X, Key, Copy, Check, LogOut, Shield, Code, ExternalLink } from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

export default function ProfileModal({ isOpen, onClose, user, onLogout }: ProfileModalProps) {
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = React.useState(false);

  if (!isOpen || !user) return null;

  const handleCopyKey = () => {
    if (user.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyEndpoint = () => {
    const ep = `${window.location.origin}/api/v2`;
    navigator.clipboard.writeText(ep);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-lg border border-white/10 bg-zinc-950/95 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.8)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                {user.username}
              </h2>
              <p className="text-xs text-zinc-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Wallet Balance</div>
            <div className="text-base font-bold text-emerald-400 mt-1">{formatINR(user.balance)}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Spent</div>
            <div className="text-base font-bold text-white mt-1">{formatINR(user.total_spent || 0)}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Orders</div>
            <div className="text-base font-bold text-white mt-1">{formatNumber(user.total_orders || 0)}</div>
          </div>
        </div>

        {/* API Key Access Section */}
        <div className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.015] mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Reseller / Developer API Key</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Standard v2
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Use your personal API key to connect your Telegram bots, external panels, or automation scripts to SMM UP.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={user.apiKey || "Generating..."}
              className="flex-1 bg-black/70 border border-white/10 text-zinc-200 px-3.5 py-2.5 rounded-xl text-xs outline-none select-all font-mono"
            />
            <button
              onClick={handleCopyKey}
              className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedKey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>

          {/* API Endpoint Documentation Preview */}
          <div className="pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">API Endpoint:</span>
              <button
                onClick={handleCopyEndpoint}
                className="text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer font-mono text-[11px]"
              >
                <span>/api/v2</span>
                {copiedEndpoint ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="p-3 rounded-xl bg-black/50 border border-white/[0.05] text-[11px] text-zinc-400 font-mono space-y-1">
              <div>POST /api/v2</div>
              <div className="text-zinc-500">Parameters: key, action (services | add | status | balance)</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <div className="text-xs text-zinc-400">
            Role: <strong className="text-white capitalize">{user.role || "Standard"}</strong>
          </div>

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
