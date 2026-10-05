import React from "react";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import Reveal from "./Reveal";

interface ContentPageProps {
  /** Short mono kicker above the title, e.g. "Legal" */
  kicker: string;
  title: string;
  subtitle?: string;
  updated?: string;
  crumbs: Crumb[];
  onNavigate: (tab: string) => void;
  /** Narrow measure for prose pages; wide for data pages */
  wide?: boolean;
  children: React.ReactNode;
}

/** Shared layout for every static/content page on SMM UP. */
export default function ContentPage({
  kicker,
  title,
  subtitle,
  updated,
  crumbs,
  onNavigate,
  wide = false,
  children,
}: ContentPageProps) {
  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
      <Reveal>
        <Breadcrumbs items={crumbs} onNavigate={onNavigate} />
        <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
          {kicker}
        </span>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.06em] text-white uppercase">
          {title}
        </h1>
        <div className="w-16 h-px bg-white/20 mt-4" />
        {subtitle && (
          <p className="mt-4 text-sm sm:text-base text-zinc-400 font-light leading-relaxed">{subtitle}</p>
        )}
        {updated && (
          <p className="mt-2 text-[11px] font-mono text-zinc-600 tracking-wider uppercase">
            Last updated: {updated}
          </p>
        )}
      </Reveal>
      <div className="mt-10">{children}</div>
    </div>
  );
}

/** Prose block used inside content pages */
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-400 leading-relaxed font-light mb-4">{children}</p>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base sm:text-lg font-bold tracking-wide text-white mt-10 mb-3 flex items-center gap-2.5">
      <span className="w-4 h-px bg-white/30 inline-block" />
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold tracking-wide text-zinc-200 mt-6 mb-2">{children}</h3>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="text-sm text-zinc-400 leading-relaxed font-light mb-4 space-y-1.5 list-none pl-0 [&>li]:pl-4 [&>li]:relative [&>li:before]:content-['—'] [&>li:before]:absolute [&>li:before]:left-0 [&>li:before]:text-zinc-600">{children}</ul>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 p-4 rounded-none border border-white/15 bg-white/[0.03] text-sm text-zinc-300 leading-relaxed">
      {children}
    </div>
  );
}
