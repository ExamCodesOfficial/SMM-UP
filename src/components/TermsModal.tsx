import React from "react";
import { X, FileText, Shield, CheckCircle2, AlertCircle } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "1. ACCEPTANCE & SERVICE SCOPE",
    content:
      "By utilizing SMM UP, submitting orders, or depositing funds, you agree to be bound by these Terms of Service. SMM UP provides automated social media marketing infrastructure designed to accelerate audience reach and visibility across global networks.",
  },
  {
    title: "2. PUBLIC PROFILE REQUIREMENTS",
    content:
      "All target profiles, posts, channels, or content submitted for automated processing must remain strictly PUBLIC throughout the duration of the order. If an account is set to private, has age restrictions, or is deleted during fulfillment, the delivery nodes will fail to process and automated replenishment cannot be guaranteed.",
  },
  {
    title: "3. ORDER DISPATCH & PROCESSING",
    content:
      "Orders submitted through our platform are dispatched instantaneously to automated network nodes. Delivery speeds vary depending on platform queue volumes and channel specifications. Once an order has entered processing status, it cannot be manually paused or recalled unless explicitly supported by that specific service channel.",
  },
  {
    title: "4. WALLET & PAYMENT POLICY",
    content:
      "All wallet top-ups are processed via direct UPI clearing. Balances credited to user wallets remain available indefinitely for service orders. Wallet funds are account-bound and non-transferable between client accounts.",
  },
  {
    title: "5. REFILL & RETENTION GUARANTEES",
    content:
      "Services designated with the 'Refill' guarantee are covered by a 30-day retention policy. If natural drops occur within this period, clients can trigger automated refills directly from the Order History desk at zero cost. Refill guarantees do not apply if target handles are changed or content is removed.",
  },
  {
    title: "6. ACCOUNT INTEGRITY & ZERO-CREDENTIAL POLICY",
    content:
      "SMM UP will never request your social media passwords, two-factor authentication codes, or administrative permissions. You retain complete ownership and responsibility for your respective social accounts.",
  },
];

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl border border-white/10 bg-zinc-950/95 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.8)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                Terms of Service &amp; Policies
              </h2>
              <p className="text-xs text-zinc-400">Institutional Platform Standards &amp; Delivery Guarantees</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6 pr-1">
          {SECTIONS.map((sec, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-white/[0.06] bg-black/40 space-y-2">
              <h3 className="text-xs font-semibold tracking-wider text-white uppercase">
                {sec.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-light">
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            Official Policy &bull; Last updated {new Date().getFullYear()}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider hover:bg-zinc-200 transition-all cursor-pointer"
          >
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
}
