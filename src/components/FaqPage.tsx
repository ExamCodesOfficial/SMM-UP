import React from "react";
import { ChevronDown } from "lucide-react";
import ContentPage, { Callout } from "./ContentPage";
import { FAQS } from "../lib/faqs";

interface FaqPageProps {
  onNavigate: (tab: string) => void;
}

export default function FaqPage({ onNavigate }: FaqPageProps) {
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <ContentPage
      kicker="Help"
      title="Frequently Asked Questions"
      subtitle="Everything about deposits, orders, refills, the API and account security — answered straight."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Help" }, { label: "FAQ" }]}
      onNavigate={onNavigate}
      wide={false}
    >
      <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {FAQS.map((f, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="w-full py-4 flex items-center justify-between gap-4 text-left cursor-pointer group"
            >
              <span className="text-sm sm:text-[15px] font-semibold text-zinc-100 group-hover:text-white transition-colors">
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
                open === i ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-sm text-zinc-400 leading-relaxed font-light pr-4 sm:pr-10">{f.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Callout>
        Still stuck after reading? The{" "}
        <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Telegram support desk
        </button>{" "}
        answers 24/7 — send your username and order ID for the fastest fix.
      </Callout>
    </ContentPage>
  );
}
