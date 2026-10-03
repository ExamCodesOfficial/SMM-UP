import React from "react";
import { ChevronDown, HelpCircle, ShieldCheck, Zap } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    id: "1",
    question: "How quickly does delivery initiate after placing an order?",
    answer:
      "Most automated service channels initiate delivery within 5 to 30 minutes of order confirmation. High-speed network nodes dispatch in real-time, and you can monitor live provisioning progress directly from your Order History dashboard.",
  },
  {
    id: "2",
    question: "Do I ever need to share account passwords or login credentials?",
    answer:
      "Never. SMM UP operates entirely using public target links and usernames. We will never ask for your account password, two-factor authentication codes, or login access. Your security is 100% safeguarded.",
  },
  {
    id: "3",
    question: "What must I verify before submitting a target link?",
    answer:
      "Please ensure that your target account, post, or channel is set to completely Public before dispatching. Private accounts, age-restricted content, or accounts with geographical restrictions cannot receive automated delivery.",
  },
  {
    id: "4",
    question: "What is a Refill Guarantee and how does it work?",
    answer:
      "Services marked with our Refill guarantee include complimentary retention protection for up to 30 days. In the event of a natural drop, simply click the 'Refill' action button beside your order in the Order History tab for automated replenishment.",
  },
  {
    id: "5",
    question: "How does wallet balance allocation work?",
    answer:
      "You can add funds to your wallet balance at any time using instant UPI. Once your payment is verified, your balance is credited immediately and can be utilized across any of our verified service channels.",
  },
  {
    id: "6",
    question: "Can I connect SMM UP programmatically to my own panel or application?",
    answer:
      "Yes. Every registered client receives a dedicated personal API key with standard SMM v2 protocol compatibility. You can easily connect external bots, customer dashboards, and reseller systems for fully automated ordering.",
  },
];

function FaqItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-white/[0.08] last:border-b-0 transition-colors">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex justify-between items-center py-5 sm:py-6 text-left gap-4 cursor-pointer group"
      >
        <span className="text-sm sm:text-base font-semibold text-white group-hover:text-zinc-200 transition-colors leading-snug">
          {faq.question}
        </span>
        <div className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center shrink-0 group-hover:border-white/30 transition-all">
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${
              open ? "rotate-180 text-white" : ""
            }`}
          />
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-60 pb-5 sm:pb-6 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light tracking-wide pr-4">
          {faq.answer}
        </p>
      </div>
    </div>
  );
}

export default function FaqSection() {
  return (
    <section className="border-t border-white/[0.08] bg-gradient-to-b from-zinc-950 to-black relative z-10 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
            FREQUENTLY ASKED
          </h2>
          <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
          <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-xl mx-auto">
            Everything you need to know about our automated social growth infrastructure and fulfillment guarantees.
          </p>
        </div>

        {/* FAQ Accordion Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl px-6 sm:px-10 py-2 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
          {FAQS.map((faq) => (
            <FaqItem key={faq.id} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
