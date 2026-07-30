"use client";

import Link from "next/link";
import type { UserBadge } from "@/lib/badge-utils";
import { ALL_BADGES, badgeCategoryLabel, badgeCategoryOrder } from "@/lib/badge-utils";

interface Props {
  badges: UserBadge[];
  max?: number;
}

export default function BadgeDisplay({ badges, max = 5 }: Props) {
  if (badges.length === 0) return null;

  const shown = badges.slice(0, max);
  const remaining = badges.length - max;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((b) => (
        <span
          key={b.key}
          title={b.description}
          className="inline-flex cursor-default items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          <span className="text-sm leading-none">{b.icon}</span>
          <span>{b.name}</span>
        </span>
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