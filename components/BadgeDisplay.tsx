"use client";

import { useState } from "react";
import Link from "next/link";
import type { UserBadge } from "@/lib/badge-utils";
import { ALL_BADGES, badgeCategoryLabel, badgeCategoryOrder } from "@/lib/badge-utils";

interface Props {
  badges: UserBadge[];
  max?: number;
}

export default function BadgeDisplay({ badges, max = 5 }: Props) {
  const [selected, setSelected] = useState<UserBadge | null>(null);

  if (badges.length === 0) return null;

  const shown = badges.slice(0, max);
  const remaining = badges.length - max;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setSelected(selected?.key === b.key ? null : b)}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
              selected?.key === b.key
                ? "bg-emerald-200 text-emerald-800"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
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

      {/* Description — appears below the row when tapped */}
      {selected && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="mr-1 text-base">{selected.icon}</span>
          <span className="font-semibold">{selected.name}</span>
          <span className="ml-1 text-emerald-600">— {selected.description}</span>
        </div>
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