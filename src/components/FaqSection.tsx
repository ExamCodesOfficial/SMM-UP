import React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import Reveal from "./Reveal";

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
      "Most wholesale automated service channels initiate delivery within 5 to 30 minutes of order confirmation. High-speed network nodes dispatch in real-time, and you can monitor live provisioning progress directly from your Order History dashboard.",
  },
  {
    id: "2",
    question: "What does a 'Partial' order status mean?",
    answer:
      "A 'Partial' status occurs when a delivery node fulfills a portion of your requested quantity and stops (e.g., delivering 650 out of 1,000 units due to a network cap or target account limit). When this happens, SMM UP automatically calculates the exact unfulfilled portion and refunds 100% of the remaining amount back to your wallet balance instantly.",
  },
  {
    id: "3",
    question: "How do the dynamic Refill Guarantees (7D to Lifetime) work?",
    answer:
      "Every service package clearly displays its exact refill duration: ranging from 7-day rapid replenishment to 30-day, 60-day, 90-day, 365-day, or Lifetime non-drop protection. Refill tracking follows the mathematical formula: [Start Count + Order Quantity = Target Count]. If natural algorithm drops bring the count below your target count during your active guarantee period, simply click 'Refill' in your Order History desk to trigger automated replenishment within 24 to 72 hours.",
  },
  {
    id: "4",
    question: "Why must I avoid placing multiple orders on the same link simultaneously?",
    answer:
      "Placing concurrent orders for the exact same URL causes starting counter overlap. The network reads your public counter at the exact moment of dispatch; if two orders run concurrently on the same link, both read the same starting count and report completion prematurely. Always wait for your active order to reach 'Completed' or 'Cancelled' before placing another order for that same link.",
  },
  {
    id: "5",
    question: "Why must my profile counters and posts remain public?",
    answer:
      "Automated delivery nodes require access to your public metrics counter to record your initial start count and confirm final completion. If your profile is set to private, post is deleted, or your subscriber/like counters are hidden in privacy settings, delivery cannot initiate and the order will be cancelled and refunded.",
  },
  {
    id: "6",
    question: "Can I change my username or handle while an order or refill is running?",
    answer:
      "No. If you modify your username/handle or convert your account to private after placing an order, the delivery node loses track of the original target URL. Refills and active tracking are strictly mapped to the exact handle submitted at order creation.",
  },
  {
    id: "7",
    question: "What happens if an order cannot be completed or the link is invalid?",
    answer:
      "If an order cannot proceed due to a broken link, private profile, or deleted post, our delivery node marks the task as 'Cancelled' and your payment is credited back to your SMM UP wallet balance automatically at zero deduction.",
  },
  {
    id: "8",
    question: "Do I ever need to share account passwords or login credentials?",
    answer:
      "Never. SMM UP operates entirely using public target links and usernames. We will never ask for your account password, two-factor authentication codes, or login access. Your security is 100% safeguarded.",
  },
  {
    id: "9",
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
        <div
          className={`w-7 h-7 rounded-sm border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 bg-white/10 text-white" : "text-zinc-400 group-hover:text-white"
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {open && (
        <div className="pb-6 text-xs sm:text-sm text-zinc-400 leading-relaxed font-light animate-fadeIn">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqSection() {
  return (
    <section className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[#E4E4E7] text-[11px] font-semibold tracking-wider uppercase mb-4">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Institutional Knowledge Base</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.08em] text-[#FAF9F7]">
          FREQUENTLY ASKED QUESTIONS
        </h2>
        <div className="w-16 h-0.5 bg-white/20 mx-auto mt-4" />
        <p className="mt-4 text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto font-light leading-relaxed">
          Comprehensive guidance on order execution, refill formulas, counter rules, and wallet clearing.
        </p>
      </div>

      {/* Accordion Container */}
      <Reveal>
        <div className="border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl rounded-none px-6 sm:px-8 py-2 divide-y divide-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {FAQS.map((faq) => (
            <FaqItem key={faq.id} faq={faq} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
