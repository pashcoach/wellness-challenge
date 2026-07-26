"use client";

import { useMemo, useState } from "react";
import { pillarForWeek } from "@/lib/constants";
import type { ActivityEntry, WellnessCheckin } from "@/lib/data";

interface Props {
  activities: ActivityEntry[];
  checkins: WellnessCheckin[];
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export default function EntryLog({ activities, checkins }: Props) {
  const [open, setOpen] = useState(false);
  const [weekFilter, setWeekFilter] = useState<number>(0); // 0 = all

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

  return (
    <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="font-bold">📒 My entry log</h2>
        <span className="text-sm text-slate-400">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {open && (
        <div className="mt-4">
          {/* Week summary chips */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((w) => (
              <div key={w} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Week {w}</p>
                <p className="text-sm font-bold text-emerald-800">{weekTotals[w]} pts</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="mb-3 flex gap-1">
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
            <p className="text-sm text-slate-500">
              {weekFilter === 0 ? "No entries yet — your log starts October 5!" : `No entries in week ${weekFilter}.`}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-lg">{r.kind === "activity" ? "🏃" : "💚"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(r.date)} · logged {r.time} · {r.detail} · Week {r.week}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-700">+{r.points}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
