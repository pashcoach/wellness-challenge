"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CHALLENGE, pillarForWeek } from "@/lib/constants";
import type { Profile, WellnessCheckin } from "@/lib/data";

export default function WellnessCheckin({
  profile,
  week,
  existing,
  onLogged,
}: {
  profile: Profile;
  week: number;
  existing: WellnessCheckin | undefined;
  onLogged: () => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pillar = pillarForWeek(week);
  const today = new Date().toISOString().slice(0, 10);

  async function handleCheck() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("wellness_checkins").insert({
      user_id: profile.id,
      week,
      pillar: pillar.key,
      comment: comment.trim() || null,
      points: CHALLENGE.wellnessCheckInPoints,
      entry_date: today,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onLogged();
  }

  if (existing) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-800">✓ Week {week} wellness check-in complete</p>
        <p className="mt-1 text-sm text-emerald-700">
          {pillar.label} · +{existing.points} points
          {existing.comment && <span className="block mt-1 italic">“{existing.comment}”</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-semibold text-slate-800">
        Week {week}: {pillar.prompt}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {pillar.label} · worth {CHALLENGE.wellnessCheckInPoints} points
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {pillar.examples.map((ex) => (
          <li key={ex}>{ex}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        These are just examples — anything that supports your {pillar.label.toLowerCase()} counts!
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional: what did you do?"
        rows={2}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleCheck}
        disabled={busy}
        className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : `I did something for my ${pillar.label.toLowerCase()} (+${CHALLENGE.wellnessCheckInPoints} pts)`}
      </button>
    </div>
  );
}
