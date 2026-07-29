"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, CHALLENGE, getChallengeWeek, pointsForMinutes, todayIso } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

const QUICK_MINUTES = [15, 15, 15, 15, 15, 15] as const;

const QUICK_PRESETS = [
  { emoji: "🚶", label: "Walk", activity: "Walking" },
  { emoji: "🏃", label: "Run", activity: "Running" },
  { emoji: "🚴", label: "Cycle", activity: "Cycling" },
  { emoji: "🏋️", label: "Strength", activity: "Strength Training" },
  { emoji: "🧘", label: "Yoga", activity: "Yoga" },
  { emoji: "🥾", label: "Hike", activity: "Hiking" },
];

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
  const [sessionLog, setSessionLog] = useState<number>(0);
  const lastQuickBusy = useRef<string | null>(null);

  const minsInputRef = (el: HTMLInputElement | null) => { if (el && !minutesRef) setMinutesRef(el); };

  const mins = parseInt(minutes, 10);
  const pts = !isNaN(mins) && mins > 0 ? pointsForMinutes(mins) : 0;
  const week = getChallengeWeek(date);
  const isOther = activity === "Other";

  const logEntry = useCallback(async (activityLabel: string, logMinutes: number, logDate: string) => {
    if (!supabase || !week) return { error: "date" };
    const logPoints = pointsForMinutes(logMinutes);
    const { error: dbError } = await supabase.from("activity_entries").insert({
      user_id: profile.id,
      activity: activityLabel,
      minutes: logMinutes,
      points: logPoints,
      entry_date: logDate,
      week,
    });
    if (dbError) return { error: friendlyError(dbError) };
    return { error: null, points: logPoints };
  }, [profile.id, week]);

  async function quickLog(presetLabel: string, presetActivity: string, logMinutes: number) {
    if (!supabase || busy || !week) return;
    lastQuickBusy.current = presetActivity;
    setBusy(true);
    setError(null);
    const result = await logEntry(presetActivity, logMinutes, date);
    setBusy(false);
    lastQuickBusy.current = null;
    if (result.error === "date") {
      setError("That date is outside the challenge (Oct 5 – Oct 30, 2026).");
    } else if (result.error) {
      setError(result.error);
    } else {
      setSessionLog((c) => c + 1);
      onLogged();
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

  function handleActivityChange(value: string) {
    setActivity(value);
    if (value === "Other") {
      setOtherActivity("");
      setShowOtherPopup(true);
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

      {/* Session counter */}
      {sessionLog > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="text-base">✓</span>
          <span className="font-medium">{sessionLog} {sessionLog === 1 ? "entry" : "entries"} logged this session</span>
        </div>
      )}

      {/* Quick batch — one-tap with duration chips */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Quick batch</p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_PRESETS.map((p) => (
            <div key={p.activity} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => quickLog(p.label, p.activity, 15)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
              >
                <span className="block text-base">{p.emoji}</span>
                <span>{p.label}</span>
                <span className="block text-[10px] text-emerald-500">+10 pts</span>
              </button>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quickLog(p.label, p.activity, 10)}
                  className="flex-1 rounded bg-emerald-50 py-1 text-[10px] text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                >
                  10m
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quickLog(p.label, p.activity, 20)}
                  className="flex-1 rounded bg-emerald-50 py-1 text-[10px] text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                >
                  20m
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quickLog(p.label, p.activity, 30)}
                  className="flex-1 rounded bg-emerald-50 py-1 text-[10px] text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                >
                  30m
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed entry form */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-emerald-700 hover:text-emerald-800">
          ⚙️ Custom entry (choose your own activity &amp; duration)
        </summary>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
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
        </form>
      </details>

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
    </>
  );
}