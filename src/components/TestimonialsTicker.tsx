import React from "react";
import { Star, ShieldCheck, CheckCircle2, Activity } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  volume: string;
  comment: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Apex Growth Agency",
    role: "Digital Marketing Agency",
    volume: "₹2.4L+ Processed",
    comment:
      "Direct 0% UPI clearing without gateway holds completely revolutionized our operational cashflow. Channel fills initiate in minutes and the 30-day refill guarantee is rock-solid.",
    rating: 5,
  },
  {
    name: "Vanguard Media Lab",
    role: "Telegram Network Operator",
    volume: "1.2M+ Reach",
    comment:
      "We tested over 7 different SMM panels before integrating SMM UP via the v2 API. Dispatch reliability and wholesale rates are unmatched anywhere in the Indian market.",
    rating: 5,
  },
  {
    name: "Nexus Creators Studio",
    role: "Artist Management",
    volume: "500K+ Engagements",
    comment:
      "Zero passwords required and absolute client privacy. The interface is remarkably sleek, fast, and does exactly what it promises with instantaneous fulfillment.",
    rating: 5,
  },
];

const LIVE_DISPATCHES = [
  "Dispatched 15,000 Telegram Channel Members • Status: In Progress",
  "Cleared ₹5,000 Wallet Deposit via Direct UPI (0% Fee) • Instant Settled",
  "Delivered 50,000 Instagram Profile Reach • 100% Completed",
  "Dispatched 8,000 YouTube Targeted Engagements • Average Speed: 12m",
  "Auto-Refilled 1,200 Telegram Post Views • Refill SLA Honored",
];

export default function TestimonialsTicker() {
  return (
    <section className="border-y border-white/[0.08] bg-[#0E0D0B]/60 py-12 md:py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Live Telemetry Ticker */}
        <div className="mb-10 p-3 sm:p-4 rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#F5E8D0] font-semibold tracking-wider uppercase shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5E8D0] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5E8D0]" />
            </span>
            <Activity className="w-3.5 h-3.5" />
            <span>Live Dispatch Telemetry</span>
          </div>

          <div className="overflow-hidden w-full text-xs text-zinc-300 font-mono">
            <div className="inline-block animate-marquee whitespace-nowrap">
              {LIVE_DISPATCHES.map((item, idx) => (
                <span key={idx} className="mr-8 inline-flex items-center gap-2">
                  <span className="text-[#F5E8D0]">&bull;</span>
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-400 uppercase block mb-2">
            Verified Deployments
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-light tracking-[0.08em] text-[#FAF7F2]">
            TRUSTED BY AGENCIES &amp; VOLUME OPERATORS
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-white/[0.08] bg-[#0E0D0B]/80 hover:border-[#F5E8D0]/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#F5E8D0] text-[#F5E8D0]" />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono font-medium text-[#F5E8D0] px-2 py-0.5 rounded border border-[#F5E8D0]/20 bg-[#F5E8D0]/5">
                    {t.volume}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed mb-6">
                  &ldquo;{t.comment}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>{t.name}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#F5E8D0]" />
                  </div>
                  <span className="text-[10px] text-zinc-400 block">{t.role}</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">VERIFIED</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
