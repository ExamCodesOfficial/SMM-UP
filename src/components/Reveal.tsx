import React from "react";

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in milliseconds */
  delay?: number;
  className?: string;
  /** Render as a different element */
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * ExamCodes-grade scroll-reveal primitive.
 * Elements gracefully rise into view once they intersect the viewport.
 * Honors prefers-reduced-motion via the global stylesheet.
 */
export default function Reveal({ children, delay = 0, className = "", as }: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = (as || "div") as any;

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ ["--reveal-delay" as any]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
