"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, CHALLENGE, getChallengeWeek, pillarForWeek, pointsForMinutes } from "@/lib/constants";
import type { ActivityEntry, WellnessCheckin } from "@/lib/data";
import Toast from "./Toast";

interface Props {
  activities: ActivityEntry[];
  checkins: WellnessCheckin[];
  onChanged: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export default function EntryLog({ activities, checkins, onChanged }: Props) {
  const [weekFilter, setWeekFilter] = useState<number>(0); // 0 = all
  const [editing, setEditing] = useState<ActivityEntry | null>(null);
  const [editActivity, setEditActivity] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [deleting, setDeleting] = useState<{ kind: "activity" | "checkin"; id: string; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const acts = activities.map((a) => ({
      id: a.id,
      kind: "activity" as const,
      week: a.week,
      date: a.entry_date,
      time: formatTime(a.created_at),
      created_at: a.created_at,
      label: a.activity,
      detail: `${a.minutes} min`,
      points: a.points,
      raw: a,
    }));
    const chks = checkins.map((c) => ({
      id: c.id,
      kind: "checkin" as const,
      week: c.week,
      date: c.entry_date,
      time: formatTime(c.created_at),
      created_at: c.created_at,
      label: c.comment || `${pillarForWeek(c.week).label} check-in`,
      detail: pillarForWeek(c.week).label,
      points: c.points,
      raw: c,
    }));
    const all = [...acts, ...chks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return weekFilter === 0 ? all : all.filter((r) => r.week === weekFilter);
  }, [activities, checkins, weekFilter]);

  const weekTotals = useMemo(() => {
    const t = [0, 0, 0, 0, 0];
    for (const a of activities) if (a.week >= 1 && a.week <= 4) t[a.week] += a.points;
    for (const c of checkins) if (c.week >= 1 && c.week <= 4) t[c.week] += c.points;
    return t;
  }, [activities, checkins]);

  function openEdit(a: ActivityEntry) {
    setEditing(a);
    setEditActivity(a.activity);
    setEditMinutes(String(a.minutes));
    setEditDate(a.entry_date);
    setError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !editing) return;
    const mins = parseInt(editMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      setError("Minutes must be a positive number.");
      return;
    }
    const week = getChallengeWeek(editDate);
    if (!week) {
      setError("That date is outside the challenge (Oct 5 – Oct 30, 2026).");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("activity_entries")
      .update({
        activity: editActivity.trim(),
        minutes: mins,
        points: pointsForMinutes(mins),
        entry_date: editDate,
        week,
      })
      .eq("id", editing.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(null);
    setToast("Entry updated — leaderboards refreshed.");
    onChanged();
  }

  async function confirmDelete() {
    if (!supabase || !deleting) return;
    setBusy(true);
    const table = deleting.kind === "activity" ? "activity_entries" : "wellness_checkins";
    const { error } = await supabase.from(table).delete().eq("id", deleting.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      setDeleting(null);
      return;
    }
    setDeleting(null);
    setToast(`"${deleting.label}" deleted — leaderboards refreshed.`);
    onChanged();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      {toast && <Toast message="Done ✓" sub={toast} onDone={() => setToast(null)} />}

      <h2 className="font-bold">📒 My entry log</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Everything you&apos;ve logged. Tap ✏️ to fix an entry or 🗑️ to remove it — points and
        leaderboards update instantly.
      </p>

      {/* Week summary chips */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((w) => (
          <div key={w} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Week {w}</p>
            <p className="text-sm font-bold text-emerald-800">{weekTotals[w]} pts</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mt-3 flex gap-1">
        {[0, 1, 2, 3, 4].map((w) => (
          <button
            key={w}
            onClick={() => setWeekFilter(w)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              weekFilter === w
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {w === 0 ? "All" : `W${w}`}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {weekFilter === 0
            ? "No entries yet — your log starts October 5!"
            : `No entries in week ${weekFilter}.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg">{r.kind === "activity" ? "🏃" : "💚"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.date)} · logged {r.time} · {r.detail} · Week {r.week}
                  </p>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-sm font-bold text-emerald-700">+{r.points}</span>
                {r.kind === "activity" && (
                  <button
                    onClick={() => openEdit(r.raw as ActivityEntry)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-700"
                    title="Edit entry"
                  >
                    ✏️
                  </button>
                )}
                <button
                  onClick={() =>
                    setDeleting({
                      kind: r.kind,
                      id: r.id,
                      label: r.kind === "activity" ? `${r.label} · ${r.detail}` : r.label,
                    })
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-red-400 hover:text-red-600"
                  title={r.kind === "checkin" ? "Delete check-in (lets you redo it)" : "Delete entry"}
                >
                  🗑️
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveEdit} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">Edit entry</h3>
            <div>
              <label className="mb-1 block text-sm font-medium">Activity</label>
              <input
                list="edit-activities"
                value={editActivity}
                onChange={(e) => setEditActivity(e.target.value)}
                className={input}
                required
              />
              <datalist id="edit-activities">
                {ACTIVITIES.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Minutes</label>
                <input
                  type="number"
                  min={1}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className={input}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={editDate}
                  {...(CHALLENGE.testingMode
                    ? {}
                    : { min: CHALLENGE.startDate, max: CHALLENGE.endDate })}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={input}
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">Delete this entry?</h3>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{deleting.label}</strong> will be removed and your points (and the
              leaderboards) will update immediately.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Keep it
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
