import React from "react";
import {
  X,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
}

const TELEGRAM_HANDLE = "@aryan";
const TELEGRAM_URL = "https://t.me/aryan";
const TELEGRAM_CHANNEL_URL = "https://t.me/smmup_updates";

export default function SupportModal({ isOpen, onClose, user }: SupportModalProps) {
  const [copiedHandle, setCopiedHandle] = React.useState(false);

  if (!isOpen) return null;

  const copyHandle = () => {
    navigator.clipboard.writeText(TELEGRAM_HANDLE);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const getCustomTelegramUrl = (topic: string) => {
    const userEmail = user?.email || "Guest Client";
    const text = encodeURIComponent(
      `Hello SMM UP Support,\n\nI need assistance regarding: ${topic}\nAccount: ${userEmail}\nPlatform: SMM UP Wholesale Engine`
    );
    return `${TELEGRAM_URL}?text=${text}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-lg border border-white/10 bg-zinc-950/95 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.85)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#F5E8D0]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                Customer Support Desk
              </h2>
              <p className="text-xs text-zinc-400">
                Direct 1-on-1 Telegram Executive Helpdesk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Operational Status Banner */}
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-300">
              Live Telegram Support Online
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Avg Reply: &lt; 5 mins
          </div>
        </div>

        {/* Primary Telegram Action Card */}
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] text-center mb-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
          
          <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/15 flex items-center justify-center mx-auto mb-3 text-[#F5E8D0] shadow-[0_0_20px_rgba(245,232,208,0.1)]">
            <SmmUpLogo size={28} />
          </div>

          <h3 className="text-base font-bold text-white mb-1">
            Chat Directly on Telegram
          </h3>
          <p className="text-xs text-zinc-400 mb-4 max-w-sm mx-auto leading-relaxed">
            Need urgent payment verification, custom high-volume pricing, or order refill assistance? Our executive operations team is live on Telegram.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex-1 py-3 px-5 rounded-xl bg-white text-black text-xs font-bold tracking-wider uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Open Telegram Chat</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>

            <button
              onClick={copyHandle}
              className="w-full sm:w-auto py-3 px-4 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="Copy Username"
            >
              {copiedHandle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedHandle ? "Copied!" : TELEGRAM_HANDLE}</span>
            </button>
          </div>
        </div>

        {/* Quick Topic Shortcuts */}
        <div className="space-y-3 mb-6">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Select Inquiry Topic (Direct Pre-fill)
          </label>

          <a
            href={getCustomTelegramUrl("Deposit & UPI Verification")}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.05] hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">Deposit & UPI Reconciliation</div>
                <div className="text-[10px] text-zinc-400">Payment delayed or need manual approval</div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
          </a>

          <a
            href={getCustomTelegramUrl("Order Status & Refill Escalation")}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.05] hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">Order Status & Refills</div>
                <div className="text-[10px] text-zinc-400">Check stalled nodes or trigger manual refill</div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
          </a>

          <a
            href={getCustomTelegramUrl("API Integration & Reseller Wholesale")}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.05] hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-300 group-hover:text-white">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">Reseller Panels & High Volume API</div>
                <div className="text-[10px] text-zinc-400">Custom volume rates and bot integration</div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
          </a>
        </div>

        {/* Operational Guarantees */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-[11px] text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Real human operations</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#F5E8D0] shrink-0" />
            <span>24/7/365 active desk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
