import React from "react";
import { ShieldCheck, Zap, RotateCcw, Lock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { ExecutiveWalletIcon, ExecutiveOrderIcon } from "./icons/ExecutiveIcons";

interface GuaranteesBentoProps {
  onNavigate?: (tab: string) => void;
  onOpenTerms?: () => void;
  onOpenWallet?: () => void;
}

export default function GuaranteesBento({ onOpenTerms, onOpenWallet, onNavigate }: GuaranteesBentoProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      {/* Section Header in ExamCodes Style */}
      <div className="text-center mb-10 md:mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E4E4E7] animate-pulse" />
          Platform Guarantees &amp; Architecture
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-[#FAF9F7]">
          BUILT FOR UNCOMPROMISING SCALE
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto mt-2.5 font-light">
          Built as a direct wholesale pipeline: no gateway fees, orders start within minutes, and every rupee is protected.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
        {/* Card 1: 0% UPI Clearing (Span 7) */}
        <div className="md:col-span-7 card-lift p-6 sm:p-8 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 hover:border-[#E4E4E7]/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#E4E4E7]/[0.02] rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-none border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-[#E4E4E7]">
              <ExecutiveWalletIcon size={24} />
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#E4E4E7] uppercase px-2.5 py-1 rounded-full border border-[#E4E4E7]/20 bg-[#E4E4E7]/5">
              0% Surcharges
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-medium tracking-wide text-white mb-2">
            Direct Bank-to-Bank UPI Deposits
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light mb-6">
            Traditional gateways levy 2% to 4% transaction friction. SMM UP bypasses processor surcharges through automated 12-digit UTR reconciliation, crediting 100% of your capital directly to your balance.
          </p>

          <div className="flex items-center gap-6 text-xs text-zinc-300 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#E4E4E7]" />
              <span>Zero gateway taxes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#E4E4E7]" />
              <span>Instant UTR verification</span>
            </div>
          </div>
        </div>

        {/* Card 2: Wholesale Speed (Span 5) */}
        <div className="md:col-span-5 card-lift p-6 sm:p-8 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 hover:border-[#E4E4E7]/30 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-none border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-[#FAF9F7] mb-6">
            <ExecutiveOrderIcon size={24} />
          </div>

          <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase block mb-1">
            Execution Velocity
          </span>
          <h3 className="text-lg sm:text-xl font-medium tracking-wide text-white mb-2">
            Wholesale Delivery Speed
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light mb-6">
            Orders pass straight from your desk to automated global delivery queues without manual review queues or throttling delays.
          </p>

          <div className="p-3 rounded-none border border-white/[0.06] bg-black/40 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Average Start Speed</span>
            <span className="font-semibold text-[#E4E4E7]">0 — 15 Minutes</span>
          </div>
        </div>

        {/* Card 3: Dynamic Multi-Tier Refill Guarantee (Span 5) */}
        <div className="md:col-span-5 card-lift p-6 sm:p-8 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 hover:border-[#E4E4E7]/30 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-none border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-[#E4E4E7] mb-6">
            <RotateCcw className="w-6 h-6" />
          </div>

          <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase block mb-1">
            Retention Protection
          </span>
          <h3 className="text-lg sm:text-xl font-medium tracking-wide text-white mb-2">
            Dynamic Refill Guarantees (7D to Lifetime)
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light mb-6">
            Eligible service channels feature guaranteed retention protection tailored to the package tier — from 7-day rapid replenishment to 30-day, 365-day, and Lifetime non-drop coverage with 1-click re-delivery.
          </p>

          {onOpenTerms && (
            <button
              onClick={onOpenTerms}
              className="text-xs text-[#E4E4E7] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer underline"
            >
              <span>Read Retention SLA Standards</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Card 4: Zero Password Architecture (Span 7) */}
        <div className="md:col-span-7 card-lift p-6 sm:p-8 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 hover:border-[#E4E4E7]/30 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-none border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-[#FAF9F7]">
              <Lock className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]">
              Zero-Credential Policy
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-medium tracking-wide text-white mb-2">
            Non-Intrusive Public Fulfillment
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light mb-6">
            We will never request your Instagram, Telegram, or YouTube login passwords, session cookies, or administrative permissions. Fulfillments are driven strictly through public target handles and post URLs.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 rounded-none border border-white/[0.06] bg-black/40">
              <span className="block text-[10px] text-zinc-500 uppercase mb-0.5">Password</span>
              <span className="font-semibold text-white">Never Needed</span>
            </div>
            <div className="p-3 rounded-none border border-white/[0.06] bg-black/40">
              <span className="block text-[10px] text-zinc-500 uppercase mb-0.5">Privacy</span>
              <span className="font-semibold text-white">100% Anonymized</span>
            </div>
            <div className="p-3 rounded-none border border-white/[0.06] bg-black/40">
              <span className="block text-[10px] text-zinc-500 uppercase mb-0.5">Security</span>
              <span className="font-semibold text-white">Client-Safe</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
