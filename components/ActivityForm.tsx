"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, CHALLENGE, getChallengeWeek, pointsForMinutes, todayIso } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

const QUICK_ACTIVITIES = [
  { emoji: "🚶", label: "Walking" },
  { emoji: "🏃", label: "Running" },
  { emoji: "🚴", label: "Cycling" },
  { emoji: "🧘", label: "Yoga" },
  { emoji: "🏋️", label: "Strength Training" },
  { emoji: "🥾", label: "Hiking" },
];

const QUICK_MINUTES = [10, 15, 20, 30, 45, 60];

/** Representative dates whose day-of-month maps to each challenge week in
 *  testing mode (getChallengeWeek maps day 1-7→wk1, 8-14→wk2, 15-21→wk3, 22+→wk4). */
const TEST_WEEK_REPRESENTATIVE_DAY = [3, 10, 17, 24];

function representativeDateForWeek(week: number, baseIso: string): string {
  const [y, m] = baseIso.split("-");
  const day = String(TEST_WEEK_REPRESENTATIVE_DAY[week - 1] ?? 24).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  // In testing mode the user picks a WEEK directly; the stored date is a
  // representative date that maps back to that week. Otherwise a free date.
  const [week, setWeek] = useState<number>(() => getChallengeWeek(today) ?? 1);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState(0);

  /* Quick batch state */
  const [quickActivity, setQuickActivity] = useState("");
  const [quickMinutes, setQuickMinutes] = useState<number | null>(null);

  const minsInputRef = (el: HTMLInputElement | null) => { if (el && !minutesRef) setMinutesRef(el); };

  const mins = parseInt(minutes, 10);
  const pts = !isNaN(mins) && mins > 0 ? pointsForMinutes(mins) : 0;
  // In testing mode the week comes from the week selector; otherwise from the date.
  const effectiveWeek = CHALLENGE.testingMode ? week : getChallengeWeek(date);
  const isOther = activity === "Other";

  const quickPts = quickMinutes && quickActivity ? pointsForMinutes(quickMinutes) : 0;

  function handleActivityChange(value: string) {
    setActivity(value);
    if (value === "Other") {
      setOtherActivity("");
      setShowOtherPopup(true);
    }
  }

  async function logQuick() {
    if (!supabase || !effectiveWeek || !quickActivity || !quickMinutes) return;
    setBusy(true);
    setError(null);
    const entryDate = CHALLENGE.testingMode ? representativeDateForWeek(week, date) : date;
    const { error: dbError } = await supabase.from("activity_entries").insert({
      user_id: profile.id,
      activity: quickActivity,
      minutes: quickMinutes,
      points: pointsForMinutes(quickMinutes),
      entry_date: entryDate,
      week: effectiveWeek,
    });
    setBusy(false);
    if (dbError) {
      setError(friendlyError(dbError));
    } else {
      setSessionLog((c) => c + 1);
      setQuickActivity("");
      setQuickMinutes(null);
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
    const entryDate = CHALLENGE.testingMode ? representativeDateForWeek(week, date) : date;
    const { error } = await supabase.from("activity_entries").insert({
      user_id: profile.id,
      activity: activityLabel,
      minutes: mins,
      points: pts,
      entry_date: entryDate,
      week: effectiveWeek,
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

      {/* Session counter */}
      {sessionLog > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="text-base">✓</span>
          <span className="font-medium">{sessionLog} {sessionLog === 1 ? "entry" : "entries"} logged this session</span>
        </div>
      )}

      {/* ═══ CUSTOM ENTRY — visible by default ═══ */}
      <form onSubmit={handleSubmit} className="space-y-3">
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
            {CHALLENGE.testingMode ? (
              <>
                <label className="mb-1 block text-sm font-medium">Challenge week</label>
                <select
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                  className={input}
                >
                  {[1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      Week {w} · {["Physical", "Psychological", "Financial", "Social"][w - 1]}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
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
              </>
            )}
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

      {/* ═══ QUICK BATCH — collapsed, below custom entry ═══ */}
      <details className="group mt-4">
        <summary className="cursor-pointer text-sm font-medium text-emerald-700 hover:text-emerald-800">
          ⚡ Quick batch — log several activities fast
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            Pick an activity, tap a duration, then tap Log. Repeat for each entry.
          </p>

          {/* Week selector (testing mode only) */}
          {CHALLENGE.testingMode && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Challenge week</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeek(w)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                      week === w
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    W{w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activity picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">1. Pick an activity</label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACTIVITIES.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => { setQuickActivity(a.label); setQuickMinutes(null); }}
                  className={`rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-colors ${
                    quickActivity === a.label
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-base">{a.emoji}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Minutes picker */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">2. How long?</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setQuickMinutes(m)}
                  disabled={!quickActivity || busy}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    quickMinutes === m
                      ? "bg-emerald-600 text-white"
                      : quickActivity && !busy
                        ? "border border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50"
                        : "border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {m} min <span className="font-normal">(+{m} pts)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Log button */}
          <button
            type="button"
            disabled={busy || !quickActivity || !quickMinutes}
            onClick={logQuick}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : quickActivity && quickMinutes
                ? `Log ${quickActivity} · ${quickMinutes} min (+${quickPts} pts)`
                : "Select an activity and duration above"}
          </button>
        </div>
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