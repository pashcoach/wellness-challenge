"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, CHALLENGE, getChallengeWeek, pointsForMinutes } from "@/lib/constants";
import type { Profile } from "@/lib/data";

export default function ActivityForm({
  profile,
  onLogged,
}: {
  profile: Profile;
  onLogged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [activity, setActivity] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const mins = parseInt(minutes, 10);
  const pts = !isNaN(mins) && mins > 0 ? pointsForMinutes(mins) : 0;
  const week = getChallengeWeek(date);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!week) {
      setError("That date is outside the challenge (Oct 5 – Oct 30, 2026).");
      return;
    }
    if (!activity) {
      setError("Pick an activity.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("activity_entries").insert({
      user_id: profile.id,
      activity,
      minutes: mins,
      points: pts,
      entry_date: date,
      week,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setSaved(true);
      setActivity("");
      setMinutes("");
      setTimeout(() => setSaved(false), 2500);
      onLogged();
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">What did you do?</label>
        <select value={activity} onChange={(e) => setActivity(e.target.value)} className={input} required>
          <option value="">Choose an activity…</option>
          {ACTIVITIES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Minutes</label>
          <input
            type="number"
            min={1}
            required
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className={input}
            placeholder="e.g. 30"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            required
            value={date}
            min={CHALLENGE.startDate}
            max={CHALLENGE.endDate}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </div>
      </div>
      {pts > 0 && (
        <p
          key={pts}
          className="points-flash rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800"
        >
          ✨ {pts} points
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm font-medium text-emerald-700">Saved! Great work. 🎉</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Log activity"}
      </button>
    </form>
  );
}
