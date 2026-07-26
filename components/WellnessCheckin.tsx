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
  const [choice, setChoice] = useState("");
  const [otherText, setOtherText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pillar = pillarForWeek(week);
  const today = new Date().toISOString().slice(0, 10);
  const isOther = choice === "Other";

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!choice) {
      setError("Pick what you did from the list (or choose Other).");
      return;
    }
    if (isOther && !otherText.trim()) {
      setError("Tell us what you did in the Other box.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("wellness_checkins").insert({
      user_id: profile.id,
      week,
      pillar: pillar.key,
      comment: isOther ? otherText.trim() : choice,
      points: CHALLENGE.wellnessCheckInPoints,
      entry_date: today,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onLogged();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

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
    <form onSubmit={handleCheck} className="rounded-xl border border-slate-200 bg-white p-4">
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

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium">What did you do?</label>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={input}
          required
        >
          <option value="">Choose an activity…</option>
          {pillar.choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {isOther && (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium">Tell us what you did</label>
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="e.g. Decluttered the garage"
            className={input}
            required
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : `Log my ${pillar.label.toLowerCase()} check-in (+${CHALLENGE.wellnessCheckInPoints} pts)`}
      </button>
    </form>
  );
}
