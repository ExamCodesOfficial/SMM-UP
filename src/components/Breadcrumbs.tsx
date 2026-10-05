import React from "react";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  tab?: string; // navigable target; last crumb is current page (no tab)
}

interface BreadcrumbsProps {
  items: Crumb[];
  onNavigate: (tab: string) => void;
}

export default function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-6">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
            {item.tab && !isLast ? (
              <button
                onClick={() => onNavigate(item.tab!)}
                className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                {i === 0 && <Home className="w-3 h-3" />}
                <span>{item.label}</span>
              </button>
            ) : (
              <span className={isLast ? "text-zinc-300" : ""}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
