import React from "react";

/**
 * Shimmer-loading primitives that mirror the final layouts,
 * preventing layout shift while the wholesale catalog streams in.
 */

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0E0D0B]/85 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div className="skeleton h-3 w-20 rounded-md" />
        </div>
        <div className="skeleton h-5 w-12 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-full rounded-md" />
        <div className="skeleton h-3.5 w-3/4 rounded-md" />
      </div>
      <div className="skeleton h-6 w-1/2 rounded-lg" />
      <div className="skeleton h-14 w-full rounded-xl" />
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        <div className="skeleton h-5 w-16 rounded-md" />
        <div className="skeleton h-8 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonCatalogGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonOrderForm() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" aria-hidden="true">
      {/* Left: form frame */}
      <div className="lg:col-span-7">
        <div className="p-6 sm:p-8 rounded-2xl border border-white/[0.07] bg-[#0E0D0B]/85 space-y-6">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-40 rounded-md" />
            <div className="skeleton h-5 w-28 rounded-full" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-44 rounded-md" />
              <div className="skeleton h-12 w-full rounded-xl" />
            </div>
          ))}
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
      {/* Right: intel frame */}
      <div className="lg:col-span-5">
        <div className="p-6 sm:p-8 rounded-2xl border border-white/[0.07] bg-zinc-950/70 space-y-5">
          <div className="flex items-center gap-3">
            <div className="skeleton w-12 h-12 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-3 w-28 rounded-md" />
              <div className="skeleton h-3.5 w-40 rounded-md" />
            </div>
          </div>
          <div className="skeleton h-4 w-full rounded-md" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
          <div className="skeleton h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
