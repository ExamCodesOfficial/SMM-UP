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
      const eased = 1 - Math.pow(1 - progress, 3);
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
    { label: "VERIFIED SERVICES", value: servicesCounter.count.toLocaleString(), suffix: "+", ref: servicesCounter.ref },
    { label: "ORDERS DELIVERED", value: ordersCounter.count.toLocaleString(), suffix: "+", ref: ordersCounter.ref },
    { label: "AVERAGE DISPATCH", value: "INSTANT", suffix: "", ref: null },
    { label: "DIRECT UPI FEE", value: "0.00%", suffix: "", ref: null },
  ];

  return (
    <section className="border-y border-white/10 bg-black/80 backdrop-blur-md relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((item, idx) => (
            <div
              key={idx}
              ref={item.ref as any}
              className="flex flex-col items-center justify-center py-5 sm:py-6 px-4 rounded-2xl border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/20 transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            >
              <span
                className="text-2xl sm:text-3xl md:text-4xl font-light tracking-wider text-white"
                style={{ textShadow: "0 0 20px rgba(255,255,255,0.25)" }}
              >
                {item.value}
                {item.suffix}
              </span>
              <span className="text-[10px] sm:text-xs tracking-[0.25em] text-zinc-400 font-semibold uppercase mt-2">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
