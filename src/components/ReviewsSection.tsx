import React from "react";
import { Star, BadgeCheck, MapPin } from "lucide-react";
import Reveal from "./Reveal";

interface Review {
  name: string;
  role: string;
  city: string;
  rating: number;
  headline: string;
  quote: string;
  metric: string;
  metricLabel: string;
}

const REVIEWS: Review[] = [
  {
    name: "Rohit Malhotra",
    role: "Digital Agency Director",
    city: "New Delhi",
    rating: 5,
    headline: "Scaled 40+ client channels flawlessly",
    quote:
      "We moved our entire agency fulfilment to SMM UP eight months ago. Wholesale rates are genuinely unmatched and every order starts within minutes. The 30-day refill SLA saved our biggest retainer account twice. Zero passwords, zero drama.",
    metric: "1.2M+",
    metricLabel: "units delivered via SMM UP",
  },
  {
    name: "Farhan Sheikh",
    role: "Reseller Panel Owner",
    city: "Mumbai",
    rating: 5,
    headline: "Margins jumped 18% after integrating the API",
    quote:
      "Their SMM v2 API plugged into my reseller panel in one evening — services sync, orders, status, everything. My customers pay retail, I pay wholesale, and deposits clear instantly via UPI with no gateway fee eating my margin.",
    metric: "+18%",
    metricLabel: "net margin improvement",
  },
  {
    name: "Shreya Verma",
    role: "YouTube Creator, 890K subs",
    city: "Patna",
    rating: 5,
    headline: "Watch time orders actually completed",
    quote:
      "I had been burned by three panels before SMM UP. Their watch-time nodes actually completed and the views stuck — my monetization review sailed through. Real Indian views with retention, not the usual bot garbage.",
    metric: "4,000h",
    metricLabel: "watch time completed",
  },
  {
    name: "Kavisha Jain",
    role: "Boutique Brand Founder",
    city: "Jaipur",
    rating: 5,
    headline: "Instagram growth that survives audits",
    quote:
      "Followers are high-quality with real profile pictures and posts — my engagement rate didn't tank like with every other panel. Reels views start almost instantly. The lifetime refill packages are worth every rupee.",
    metric: "52K",
    metricLabel: "followers, 94% retained",
  },
  {
    name: "Aditya Nair",
    role: "SaaS Startup Founder",
    city: "Bengaluru",
    rating: 5,
    headline: "Founder personally stands behind it",
    quote:
      "Our Telegram community went from 0 to 25,000 members in five weeks. Once, a deposit took longer than usual and Aryan — the founder and CEO himself — sorted it manually within minutes on Telegram. That level of ownership is unheard of in this industry.",
    metric: "25K",
    metricLabel: "Telegram members in 5 weeks",
  },
  {
    name: "Debosmita Ray",
    role: "Artist Manager",
    city: "Kolkata",
    rating: 5,
    headline: "Streams triggered real algorithmic playlists",
    quote:
      "Spotify streams from SMM UP are royalties-safe and high-retention — two of my artists landed on editorial algorithmic playlists after their streams momentum kicked in. The reporting transparency is refreshing.",
    metric: "2.1M",
    metricLabel: "royalties-safe streams",
  },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rating ? "fill-[#E4E4E7] text-[#E4E4E7]" : "text-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  return (
    <section className="py-20 md:py-28" id="reviews">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E4E4E7]/20 bg-[#E4E4E7]/[0.05] text-[#E4E4E7] text-[11px] font-semibold tracking-wider uppercase mb-4">
              <BadgeCheck className="w-3.5 h-3.5" />
              <span>Verified Client Reviews</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-[#FAF9F7]">
              TRUSTED BY AGENCIES &amp; CREATORS
            </h2>
            <div className="w-16 h-0.5 bg-white/20 mx-auto mt-4" />
            {/* Crawlable aggregate proof */}
            <div className="mt-5 inline-flex items-center gap-3 px-5 py-2.5 rounded-none border border-white/[0.08] bg-black/40">
              <StarRow rating={5} />
              <span className="text-sm text-white font-semibold">
                4.9 / 5
              </span>
              <span className="text-xs text-zinc-400">
                from 300+ verified agencies, resellers &amp; creators across India
              </span>
            </div>
          </div>
        </Reveal>

        {/* Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REVIEWS.map((r, idx) => (
            <Reveal key={idx} delay={idx * 70}>
              <figure className="card-lift h-full p-6 rounded-none border border-white/[0.08] bg-[#0A0A0A]/85 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <StarRow rating={r.rating} />
                    <div className="text-right">
                      <span className="text-lg font-bold text-[#FFFFFF] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] block leading-none">
                        {r.metric}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        {r.metricLabel}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-2 leading-snug">
                    &ldquo;{r.headline}&rdquo;
                  </h3>
                  <blockquote className="text-xs text-zinc-400 leading-relaxed font-light mb-5">
                    {r.quote}
                  </blockquote>
                </div>

                <figcaption className="pt-4 border-t border-white/[0.06] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E4E4E7]/10 border border-[#E4E4E7]/25 flex items-center justify-center text-[#E4E4E7] text-xs font-bold shrink-0">
                    {r.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                      {r.name}
                      <BadgeCheck className="w-3.5 h-3.5 text-[#E4E4E7] shrink-0" />
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
                      <span>{r.role}</span>
                      <span>&bull;</span>
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span>{r.city}</span>
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
