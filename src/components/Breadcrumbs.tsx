import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { pathFor } from "../lib/routes";

export interface Crumb {
  label: string;
  tab?: string; // navigable target; crumbs without a tab are plain (non-clickable) context
}

interface BreadcrumbsProps {
  items: Crumb[];
  onNavigate: (tab: string) => void;
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-6">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
            {item.tab && !isLast ? (
              <a
                href={pathFor(item.tab)}
                className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                {i === 0 && <Home className="w-3 h-3" />}
                <span>{item.label}</span>
              </a>
            ) : (
              /* Plain context segment: no link, clearly dimmed so it never
                 reads as a broken/phantom link */
              <span className={isLast ? "text-zinc-300" : "text-zinc-700 cursor-default"}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
