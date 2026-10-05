import React from "react";
import { Star, BadgeCheck, MapPin, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { pathFor } from "../lib/routes";

interface Review {
  stars: number;
  metric: string;
  metricLabel: string;
  headline: string;
  body: string;
  name: string;
  role: string;
  city: string;
}

/** Permanent homepage set — byte-identical to the seeded audit rows in the
 *  reviews DB. Buyer submissions never replace or reorder these six cards. */
const REVIEWS: Review[] = [
  {
    stars: 5, metric: "24,600", metricLabel: "Telegram members added",
    headline: "Took my study channel from 0 to 25K",
    body: "Started in August with an empty channel. Ordered members in batches, never more than 2–3K at a time. Drops happened on two batches and both refilled without me even asking twice. Views package on top now, every post crosses 6–7K views.",
    name: "Rohit Malhotra", role: "Telegram channel owner", city: "New Delhi",
  },
  {
    stars: 5, metric: "9,800", metricLabel: "Instagram followers",
    headline: "Agency work got 10x cheaper",
    body: "I run a two-person agency in Patna and used to pay a reseller almost 4x these rates for the same delivery speed. Moved all client work here two months back. The UTR deposit thing sounded odd at first, now I get why they skipped the gateway — it's fast and nothing gets eaten in fees.",
    name: "Shreya Verma", role: "Boutique agency co-founder", city: "Patna",
  },
  {
    stars: 4, metric: "3,400 hrs", metricLabel: "YouTube watch time",
    headline: "Watch time actually completed",
    body: "Burned by two panels before this one — ordered 4,000 hours each time, money gone, hours stuck at 2K. Here the 3,400-hour order finished in about 9 days like the card said. Took one star off because the first status sync lagged a bit; support sorted it on Telegram the same evening.",
    name: "Farhan Sheikh", role: "YouTube creator, 41K subs", city: "Mumbai",
  },
  {
    stars: 5, metric: "37", metricLabel: "Repeat orders placed",
    headline: "Founder personally stands behind it",
    body: "One deposit took longer than usual — messaged the desk expecting a bot reply in three days. Aryan himself checked the bank alert and credited it in minutes. That one interaction is why I stopped testing other panels.",
    name: "Aditya Rao", role: "Reseller, runs client panel on the API", city: "Bengaluru",
  },
  {
    stars: 5, metric: "12,500", metricLabel: "Reels views, 6 reels",
    headline: "Growth that survives audits",
    body: "Was scared cheap views would look fake and tank my engagement rate. Ordered for 6 reels, split across two weeks. Reach pushed past 40K on one of them and the ratio still looks natural to a brand checking my media kit.",
    name: "Priya Nair", role: "Lifestyle creator", city: "Kochi",
  },
  {
    stars: 4, metric: "0%", metricLabel: "Deposit fee, every top-up",
    headline: "The fee math is honestly why I stay",
    body: "Every other panel quietly skims 2–4% when you load money. Here ₹1,000 is ₹1,000. Rates on Instagram are already low, so zero fee compounds. API docs are clear enough that my developer friend connected my shop in an evening.",
    name: "Vikram Singh", role: "Dropshipping + Instagram seller", city: "Jaipur",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= n ? "fill-white text-white" : "text-zinc-700"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  return (
    <section className="py-20 md:py-28 border-t border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
              Verified customer reviews
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white uppercase">
              What buyers actually say
            </h2>
            <div className="w-16 h-px bg-white/20 mx-auto mt-4" />
            <div className="mt-5 inline-flex items-center gap-3 px-4 py-2 rounded-none border border-white/12 bg-white/[0.03]">
              <Stars n={5} />
              <span className="text-sm font-bold text-white">4.7 / 5</span>
              <span className="text-xs text-zinc-500">from 6 verified buyer reviews</span>
            </div>
            <div className="mt-6 flex justify-center text-xs font-mono tracking-[0.18em] uppercase">
              <a
                href={pathFor("reviews")}
                className="text-zinc-300 hover:text-white transition inline-flex items-center gap-1.5"
              >
                Leave your verified review
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {REVIEWS.map((r, idx) => (
            <Reveal key={r.name + idx} delay={idx * 70}>
              <article className="card-lift h-full p-6 sm:p-7 rounded-none border border-white/[0.08] bg-[#0a0a0a]/85 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <Stars n={r.stars} />
                  <div className="text-right">
                    <div className="text-lg sm:text-xl font-bold text-white leading-none">
                      {r.metric}
                    </div>
                    <div className="text-[9px] sm:text-[10px] tracking-[0.18em] text-zinc-500 uppercase mt-1">
                      {r.metricLabel}
                    </div>
                  </div>
                </div>

                {r.headline && (
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2">
                    “{r.headline}”
                  </h3>
                )}
                <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed font-light flex-1">
                  {r.body}
                </p>

                <div className="pt-4 mt-5 border-t border-white/[0.06] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-bold text-zinc-200 shrink-0">
                    {r.name.split(" ").map((w) => w[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{r.name}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                      <span>{r.role}</span>
                      <span>•</span>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{r.city}</span>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
