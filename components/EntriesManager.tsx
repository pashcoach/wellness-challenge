"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVITIES, getChallengeWeek, pointsForMinutes } from "@/lib/constants";
import type { ActivityEntry, WellnessCheckin } from "@/lib/data";
import Toast from "./Toast";

interface Props {
  activities: ActivityEntry[];
  checkins: WellnessCheckin[];
  onChanged: () => void;
}

export default function EntriesManager({ activities, checkins, onChanged }: Props) {
  const [editing, setEditing] = useState<ActivityEntry | null>(null);
  const [editActivity, setEditActivity] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [deleting, setDeleting] = useState<{ kind: "activity" | "checkin"; id: string; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const allKnown = [...ACTIVITIES];

  return (
    <div>
      {toast && <Toast message="Done ✓" sub={toast} onDone={() => setToast(null)} />}

      {activities.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing logged yet this week.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block truncate">
                  {a.activity} · {a.minutes} min
                </span>
                <span className="text-xs text-slate-400">{a.entry_date}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-semibold text-emerald-700">+{a.points}</span>
                <button
                  onClick={() => openEdit(a)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-700"
                  title="Edit entry"
                >
                  ✏️
                </button>
                <button
                  onClick={() =>
                    setDeleting({ kind: "activity", id: a.id, label: `${a.activity} · ${a.minutes} min` })
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-red-400 hover:text-red-600"
                  title="Delete entry"
                >
                  🗑️
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Completed check-ins with delete option */}
      {checkins.map((c) => (
        <div
          key={c.id}
          className="mt-2 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm"
        >
          <span className="min-w-0 truncate text-emerald-800">
            ✓ Week {c.week} check-in{c.comment ? `: ${c.comment}` : ""}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-semibold text-emerald-700">+{c.points}</span>
            <button
              onClick={() => setDeleting({ kind: "checkin", id: c.id, label: `Week ${c.week} check-in` })}
              className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-600 hover:border-red-400 hover:text-red-600"
              title="Delete check-in (lets you redo it)"
            >
              🗑️
            </button>
          </span>
        </div>
      ))}

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
                {allKnown.map((a) => (
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
                  min="2026-10-05"
                  max="2026-10-30"
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
