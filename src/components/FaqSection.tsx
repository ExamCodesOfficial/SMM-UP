import React from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { FAQS } from "../lib/faqs";

interface FaqSectionProps {
  onSeeAll?: () => void;
}

/** Home teaser — shows the first 6 Q&As, links to the full /faq page. */
export default function FaqSection({ onSeeAll }: FaqSectionProps) {
  const [open, setOpen] = React.useState<number | null>(0);
  const preview = FAQS.slice(0, 6);

  return (
    <section className="py-20 md:py-28 border-t border-white/[0.08] bg-[#0a0a0a]/60">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2">
              Got questions?
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-white uppercase">
              Frequently asked
            </h2>
            <div className="w-16 h-px bg-white/20 mx-auto mt-4" />
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {preview.map((f, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="w-full py-4 flex items-center justify-between gap-4 text-left cursor-pointer group"
                >
                  <span className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-300 ${
                      open === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    open === i ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-zinc-400 leading-relaxed font-light pr-6">{f.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {onSeeAll && (
          <Reveal delay={200}>
            <div className="text-center mt-10">
              <button onClick={onSeeAll} className="btn-up btn-up-ghost btn-up-sm group">
                <span>Read all {FAQS.length} answers</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
