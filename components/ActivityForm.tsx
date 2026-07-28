"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, CHALLENGE, getChallengeWeek, pointsForMinutes, todayIso } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

export default function ActivityForm({
  profile,
  onLogged,
}: {
  profile: Profile;
  onLogged: () => void;
}) {
  const today = todayIso();
  const [activity, setActivity] = useState("");
  const [otherActivity, setOtherActivity] = useState("");
  const [showOtherPopup, setShowOtherPopup] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [minutesRef, setMinutesRef] = useState<HTMLInputElement | null>(null);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const minsInputRef = (el: HTMLInputElement | null) => { if (el && !minutesRef) setMinutesRef(el); };

  const mins = parseInt(minutes, 10);
  const pts = !isNaN(mins) && mins > 0 ? pointsForMinutes(mins) : 0;
  const week = getChallengeWeek(date);
  const isOther = activity === "Other";

  function handleActivityChange(value: string) {
    setActivity(value);
    if (value === "Other") {
      setOtherActivity("");
      setShowOtherPopup(true);
    }
  }

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
    if (isOther && !otherActivity.trim()) {
      setShowOtherPopup(true);
      return;
    }
    const activityLabel = isOther ? otherActivity.trim() : activity;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("activity_entries").insert({
      user_id: profile.id,
      activity: activityLabel,
      minutes: mins,
      points: pts,
      entry_date: date,
      week,
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else {
      setToast(`${activityLabel} · ${mins} min · +${pts} pts confirmed!`);
      setActivity("");
      setOtherActivity("");
      setMinutes("");
      onLogged();
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <>
      {toast && (
        <Toast
          message="Entry confirmed! 🎉"
          sub={toast}
          onDone={() => setToast(null)}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
      {/* Quick-log preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => { setActivity("Walking"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🚶 Walk</button>
        <button type="button" onClick={() => { setActivity("Running"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🏃 Run</button>
        <button type="button" onClick={() => { setActivity("Cycling"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🚴 Cycle</button>
        <button type="button" onClick={() => { setActivity("Strength Training"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🏋️ Strength</button>
        <button type="button" onClick={() => { setActivity("Yoga"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🧘 Yoga</button>
        <button type="button" onClick={() => { setActivity("Yardwork"); setMinutes(""); minutesRef?.focus(); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">🍂 Yardwork</button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">What did you do?</label>
        <select value={activity} onChange={(e) => handleActivityChange(e.target.value)} className={input} required>
          <option value="">Choose an activity…</option>
          {ACTIVITIES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {isOther && otherActivity && (
          <button
            type="button"
            onClick={() => setShowOtherPopup(true)}
            className="mt-1 text-xs font-medium text-emerald-700 underline"
          >
            ✏️ {otherActivity} (edit)
          </button>
        )}
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
            ref={minsInputRef}
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
            {...(CHALLENGE.testingMode
              ? {}
              : { min: CHALLENGE.startDate, max: CHALLENGE.endDate })}
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
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Log activity"}
      </button>

      {/* Other activity popup */}
      {showOtherPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">What activity did you do?</h3>
            <p className="mt-1 text-xs text-slate-500">
              Anything counts — gardening, skateboarding, walking the dog… it all adds up!
            </p>
            <input
              autoFocus
              type="text"
              value={otherActivity}
              onChange={(e) => setOtherActivity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && otherActivity.trim()) {
                  e.preventDefault();
                  setShowOtherPopup(false);
                }
              }}
              placeholder="e.g. Skateboarding"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOtherPopup(false);
                  setActivity("");
                  setOtherActivity("");
                }}
                className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!otherActivity.trim()}
                onClick={() => setShowOtherPopup(false)}
                className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      </form>
    </>
  );
}
