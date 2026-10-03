import React from "react";

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  React.useEffect(() => {
    if (!started || target === 0) return;
    let raf: number;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setCount(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return { count, ref };
}

export default function HeroStats({ totalServices = 2174 }: { totalServices?: number }) {
  const servicesCounter = useCountUp(totalServices);
  const ordersCounter = useCountUp(185420);

  const stats = [
    { label: "LIVE SERVICES", value: servicesCounter.count.toLocaleString(), suffix: "+", ref: servicesCounter.ref },
    { label: "ORDERS DELIVERED", value: ordersCounter.count.toLocaleString(), suffix: "+", ref: ordersCounter.ref },
    { label: "AVERAGE START", value: "INSTANT", suffix: "", ref: null },
    { label: "GATEWAY FEE", value: "0% UPI", suffix: "", ref: null },
  ];

  return (
    <div className="border-y border-white/10 bg-white/[0.01]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          {stats.map((s, idx) => (
            <div
              key={idx}
              ref={s.ref as any}
              className="p-4 sm:p-5 border border-white/[0.06] bg-black/40 rounded-sm flex flex-col items-center justify-center text-center hover:border-white/20 transition-all shadow-[0_0_20px_rgba(255,255,255,0.02)]"
            >
              <div
                className="text-xl sm:text-2xl lg:text-3xl font-light text-white font-mono tracking-tight"
                style={{ textShadow: "0 0 15px rgba(255,255,255,0.2)" }}
              >
                {s.value}
                {s.suffix}
              </div>
              <div className="text-[9px] sm:text-[10px] tracking-[0.22em] text-gray-400 font-bold uppercase mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
