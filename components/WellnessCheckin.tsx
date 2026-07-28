"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CHALLENGE, pillarForWeek, todayIso } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { Profile, WellnessCheckin } from "@/lib/data";
import Toast from "./Toast";

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
  const [confirmed, setConfirmed] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const pillar = pillarForWeek(week);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!confirmed) {
      setError("Please confirm that you supported your health this week.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("wellness_checkins").insert({
      user_id: profile.id,
      week,
      pillar: pillar.key,
      comment: comment.trim() || null,
      points: CHALLENGE.wellnessCheckInPoints,
      entry_date: todayIso(),
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else {
      setToast(`Week ${week} check-in confirmed! +${CHALLENGE.wellnessCheckInPoints} pts`);
      onLogged();
    }
  }

  if (existing) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-800">✓ Week {week} wellness check-in complete</p>
        <p className="mt-1 text-sm text-emerald-700">
          {pillar.label} · +{existing.points} points
        </p>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <Toast
          message="Wellness check-in confirmed! 🎉"
          sub={toast}
          onDone={() => setToast(null)}
        />
      )}
      <form onSubmit={handleCheck} className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="font-semibold text-slate-800">
          Week {week}: {pillar.prompt}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {pillar.label} · worth {CHALLENGE.wellnessCheckInPoints} points
        </p>

        {/* Examples — always visible */}
        <ul className="mt-3 space-y-1.5">
          {pillar.examples.map((ex) => (
            <li key={ex} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-0.5 shrink-0 text-emerald-500">•</span>
              <span>{ex}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-slate-400">
          These are examples — anything that supports your {pillar.label.toLowerCase()} counts!
        </p>

        {/* Simple confirmation checkbox */}
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
          />
          <span className="text-sm font-medium text-emerald-800">
            I supported my {pillar.label.toLowerCase()} health this week (+{CHALLENGE.wellnessCheckInPoints} pts)
          </span>
        </label>

        {/* Optional comment field */}
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Tell us about it (optional)
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Went for a walk in the park..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !confirmed}
          className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : `Confirm check-in (+${CHALLENGE.wellnessCheckInPoints} pts)`}
        </button>
      </form>
    </>
  );
}