import React from "react";
import { User, X, Key, Copy, Check, LogOut, Shield } from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
}

export default function ProfileModal({ isOpen, onClose, user, onLogout }: ProfileModalProps) {
  const [copiedKey, setCopiedKey] = React.useState(false);

  if (!isOpen || !user) return null;

  const handleCopyKey = () => {
    if (user.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-md border border-white/15 bg-black rounded-sm shadow-[0_0_50px_rgba(255,255,255,0.06)] p-6 sm:p-7 font-sans">
        {/* Subtle corner brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-white/20 bg-white/[0.04] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-widest text-white uppercase">
                {user.username || "CLIENT"}
              </h2>
              <p className="text-[10px] text-gray-500 font-mono">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center mb-6 font-mono">
          <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase">BALANCE</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">{formatINR(user.balance)}</div>
          </div>
          <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase">SPENT</div>
            <div className="text-sm font-bold text-white mt-1">{formatINR(user.total_spent || 0)}</div>
          </div>
          <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-sm">
            <div className="text-[9px] text-gray-500 uppercase">ORDERS</div>
            <div className="text-sm font-bold text-white mt-1">{formatNumber(user.total_orders || 0)}</div>
          </div>
        </div>

        {/* Reseller API Key */}
        <div className="p-4 border border-white/10 bg-white/[0.02] rounded-sm mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400 flex items-center gap-1.5 font-bold">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>RESELLER API KEY</span>
            </span>
            <span className="text-[9px] text-emerald-400 font-semibold">ACTIVE</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={user.apiKey || "API Key generated on sign-in"}
              className="w-full bg-black/80 border border-white/10 text-gray-300 px-3 py-1.5 text-xs font-mono rounded-sm outline-none"
            />
            <button
              onClick={handleCopyKey}
              className="p-2 border border-white/20 hover:border-white/50 text-white rounded-sm transition-all cursor-pointer bg-white/[0.04]"
              title="Copy API Key"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-500 font-mono">
            Use this API key to connect your Telegram bots or sub-panels to SMM UP.
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full py-2.5 border border-red-500/30 bg-red-500/10 hover:border-red-500/60 text-red-400 font-mono text-xs tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>TERMINATE SESSION</span>
        </button>
      </div>
    </div>
  );
}
