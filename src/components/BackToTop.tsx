import React from "react";
import { ArrowUp } from "lucide-react";

/**
 * Floating "back to top" control with a circular scroll-progress ring.
 * Appears once the visitor scrolls deep into the page and fades away near the top.
 */
export default function BackToTop() {
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const max = Math.max(
          1,
          document.documentElement.scrollHeight - window.innerHeight
        );
        setProgress(Math.min(1, scrollTop / max));
        setVisible(scrollTop > 600);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const R = 15.5;
  const CIRC = 2 * Math.PI * R;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll back to top"
      className={`fixed bottom-24 md:bottom-8 right-4 md:right-6 z-40 w-11 h-11 rounded-full border border-white/15 bg-[#0A0A0A]/90 backdrop-blur-xl text-zinc-300 hover:text-black hover:bg-white shadow-[0_6px_30px_rgba(0,0,0,0.6)] transition-all duration-500 cursor-pointer flex items-center justify-center ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-6 pointer-events-none"
      }`}
    >
      {/* Scroll progress ring */}
      <svg
        viewBox="0 0 36 36"
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
        aria-hidden="true"
      >
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
        />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.15s linear" }}
        />
      </svg>
      <ArrowUp className="w-4 h-4 relative z-10" />
    </button>
  );
}
