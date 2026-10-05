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
    title: "2. PUBLIC PROFILE & METRIC COUNTER REQUIREMENTS",
    content:
      "All target profiles, posts, channels, or videos submitted for automated processing must remain strictly PUBLIC throughout the duration of the order. Subscriber, follower, like, and view counters must NOT be hidden in profile privacy settings. If an account is set to private, post deleted, or counters hidden during fulfillment, delivery nodes will be unable to confirm counts and automated replenishment cannot be granted.",
  },
  {
    title: "3. CONCURRENT ORDER RESTRICTION (COUNTER OVERLAP PREVENTION)",
    content:
      "Clients must NOT place more than one order for the exact same URL/link simultaneously until the active order reaches 'Completed' or 'Cancelled'. Automated delivery nodes record your initial start count at the time of execution. Placing concurrent orders on the same link leads to overlapping start counts and premature completion without full delivery.",
  },
  {
    title: "4. PARTIAL FULFILLMENT & AUTOMATIC BALANCE CREDITING",
    content:
      "If a delivery node encounters a network limit or platform restriction and can only deliver a portion of your requested quantity, the order status is marked as 'Partial'. SMM UP automatically calculates the unfulfilled units and credits 100% of the remaining amount back to your account wallet immediately.",
  },
  {
    title: "5. REFILL SLA SPECIFICATIONS & DYNAMIC FORMULA (7D TO LIFETIME)",
    content:
      "Services designated with a refill guarantee are covered by their explicitly specified retention SLA (e.g. 7-Day, 15-Day, 30-Day, 60-Day, 90-Day, 365-Day, or Lifetime non-drop protection as indicated on the service package). Refill calculations strictly follow the formula: [Start Count + Order Quantity = Target Count]. If the public count falls below the target count during the active guarantee window, a refill can be initiated via the Order History desk. Refills typically process within 24 to 72 hours. Note: Refills are voided if the target account changes username/handle or is switched to private.",
  },
  {
    title: "6. ORDER CANCELLATIONS & NON-WORKING LINKS",
    content:
      "Orders cannot be manually modified or canceled once submitted to automated processing unless the delivery node reports a permanent dispatch error. If a link is invalid, private, or deleted prior to processing, the order is automatically marked as 'Cancelled' and 100% of the charged amount is refunded to your wallet.",
  },
  {
    title: "7. PROHIBITED CONTENT & CONDUCT",
    content:
      "Orders targeting accounts or content involving extremism, political agitation, hate speech, adult/pornographic content, harassment, or illegal material are strictly prohibited. SMM UP reserves the right to terminate accounts and cancel orders violating community safety guidelines with zero liability.",
  },
  {
    title: "8. DIRECT 0% UPI CLEARING & WALLET POLICY",
    content:
      "All wallet deposits are cleared via direct bank UPI using automated 12-digit UTR reconciliation. Once credited, wallet balances do not expire and can be utilized across all wholesale catalog services. Balances are account-bound and non-transferable.",
  },
  {
    title: "9. ZERO-CREDENTIAL SECURITY GUARANTEE",
    content:
      "SMM UP will never request your social media passwords, two-factor authentication codes, or administrative permissions. You retain complete ownership and responsibility for your respective social accounts.",
  },
];

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-2xl border border-white/10 bg-[#0A0A0A] rounded-none shadow-[0_10px_50px_rgba(0,0,0,0.9)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6 sticky top-0 bg-[#0A0A0A] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#E4E4E7]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                Terms of Service &amp; SLA
              </h2>
              <p className="text-xs text-zinc-400">Institutional Platform Standards &amp; Delivery Policies</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-sm border border-white/10 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {SECTIONS.map((sec, idx) => (
            <div key={idx} className="p-4 sm:p-5 rounded-none border border-white/[0.06] bg-black/40">
              <h3 className="text-xs sm:text-sm font-bold tracking-wider text-[#FAF9F7] uppercase mb-2">
                {sec.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed font-light">
                {sec.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Shield className="w-4 h-4 text-[#E4E4E7]" />
            <span>Cryptographically Verified SLA</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-none bg-white text-black font-bold text-xs tracking-wider uppercase hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
