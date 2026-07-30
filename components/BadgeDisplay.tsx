"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { UserBadge } from "@/lib/badge-utils";
import { ALL_BADGES, badgeCategoryLabel, badgeCategoryOrder } from "@/lib/badge-utils";

interface Props {
  badges: UserBadge[];
  max?: number;
}

export default function BadgeDisplay({ badges, max = 5 }: Props) {
  const [selected, setSelected] = useState<UserBadge | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover when tapping outside
  useEffect(() => {
    if (!selected) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selected]);

  if (badges.length === 0) return null;

  const shown = badges.slice(0, max);
  const remaining = badges.length - max;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setSelected(selected?.key === b.key ? null : b)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <span className="text-sm leading-none">{b.icon}</span>
            <span>{b.name}</span>
          </button>
        ))}
        {remaining > 0 && (
          <Link
            href="/badges"
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200"
          >
            +{remaining} more
          </Link>
        )}
      </div>

      {/* Popover */}
      {selected && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setSelected(null)} />
          {/* Popover */}
          <div
            ref={popoverRef}
            className="fixed left-1/2 top-1/2 z-50 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{selected.icon}</span>
            <div>
              <p className="font-bold text-slate-800">{selected.name}</p>
              <p className="mt-0.5 text-sm text-slate-600">{selected.description}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {badgeCategoryLabel(selected.category)}
              </p>
            </div>
          </div>
          </div>
          </>
        )}
    </div>
  );
}

export function BadgeGrid({ earnedKeys }: { earnedKeys: Set<string> }) {
  const sorted = [...ALL_BADGES].sort((a, b) => {
    const cat = badgeCategoryOrder(a.category) - badgeCategoryOrder(b.category);
    if (cat !== 0) return cat;
    return (a.trigger_value ?? 0) - (b.trigger_value ?? 0);
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {sorted.map((badge) => {
        const earned = earnedKeys.has(badge.key);
        return (
          <div
            key={badge.key}
            className={`rounded-xl border p-4 text-center transition-colors ${
              earned
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50 opacity-60"
            }`}
          >
            <span className="block text-3xl">{earned ? badge.icon : "❓"}</span>
            <p className={`mt-2 text-sm font-semibold ${earned ? "text-emerald-800" : "text-slate-500"}`}>
              {earned ? badge.name : "???"}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
              {earned ? badge.description : badge.category === "hidden" ? "Keep going to discover..." : badge.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}