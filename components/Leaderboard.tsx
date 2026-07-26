"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CHALLENGE, currentChallengeWeek } from "@/lib/constants";

interface PersonRow {
  id: string;
  name: string;
  team_name: string | null;
  total: number;
  weekly: number[];
}

interface TeamRow {
  id: string;
  name: string;
  members: number;
  avg: number;
}

type Tab = "individual" | "weekly" | "teams";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("individual");
  const [selectedWeek, setSelectedWeek] = useState<number>(currentChallengeWeek() ?? 1);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [profiles, activities, checkins, teamRows] = await Promise.all([
      supabase.from("profiles").select("id, full_name, team_id"),
      supabase.from("activity_entries").select("user_id, points, week"),
      supabase.from("wellness_checkins").select("user_id, points, week"),
      supabase.from("teams").select("id, name"),
    ]);

    const teamNames = new Map((teamRows.data ?? []).map((t) => [t.id, t.name]));
    const totals = new Map<string, { total: number; weekly: number[] }>();

    function add(userId: string, points: number, week: number) {
      const rec = totals.get(userId) ?? { total: 0, weekly: [0, 0, 0, 0, 0] };
      rec.total += points;
      if (week >= 1 && week <= 4) rec.weekly[week] += points;
      totals.set(userId, rec);
    }
    for (const a of activities.data ?? []) add(a.user_id, a.points, a.week);
    for (const c of checkins.data ?? []) add(c.user_id, c.points, c.week);

    const personRows: PersonRow[] = (profiles.data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      team_name: p.team_id ? teamNames.get(p.team_id) ?? null : null,
      total: totals.get(p.id)?.total ?? 0,
      weekly: totals.get(p.id)?.weekly ?? [0, 0, 0, 0, 0],
    }));
    personRows.sort((a, b) => b.total - a.total);
    setPeople(personRows);

    const byTeam = new Map<string, number[]>();
    for (const p of profiles.data ?? []) {
      if (!p.team_id) continue;
      const arr = byTeam.get(p.team_id) ?? [];
      arr.push(totals.get(p.id)?.total ?? 0);
      byTeam.set(p.team_id, arr);
    }
    const teamList: TeamRow[] = [...byTeam.entries()].map(([id, pts]) => ({
      id,
      name: teamNames.get(id) ?? "Team",
      members: pts.length,
      avg: Math.round(pts.reduce((s, v) => s + v, 0) / pts.length),
    }));
    teamList.sort((a, b) => b.avg - a.avg);
    setTeams(teamList);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weeklySorted = useMemo(
    () => [...people].sort((a, b) => b.weekly[selectedWeek] - a.weekly[selectedWeek]),
    [people, selectedWeek]
  );

  if (loading) return <p className="text-sm text-slate-500">Loading leaderboard…</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "individual", label: "🏅 Individual" },
    { key: "weekly", label: "📅 This Week" },
    { key: "teams", label: "🤝 Teams" },
  ];

  const hasAnyPoints = people.some((p) => p.total > 0);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md py-1.5 transition-colors ${
              tab === t.key ? "bg-white shadow text-emerald-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasAnyPoints && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          No points logged yet — the race begins October 5! 🏁
        </p>
      )}

      {/* Individual — overall cumulative */}
      {tab === "individual" && (
        <ol className="space-y-2">
          {people.length === 0 && <p className="text-sm text-slate-500">No participants yet.</p>}
          {people.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                i === 0 && p.total > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  {p.team_name && <p className="text-xs text-slate-500">{p.team_name}</p>}
                </div>
              </div>
              <p className="text-sm font-bold text-emerald-800">{p.total.toLocaleString()} pts</p>
            </li>
          ))}
        </ol>
      )}

      {/* Weekly — fresh slate each week */}
      {tab === "weekly" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    selectedWeek === w
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Week {w}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✨ Fresh start every Monday — weekly points reset to 0 so everyone has a shot at the
            weekly prize draw!
          </p>
          <ol className="space-y-2">
            {weeklySorted.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  i === 0 && p.weekly[selectedWeek] > 0
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.team_name && <p className="text-xs text-slate-500">{p.team_name}</p>}
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-800">
                  {p.weekly[selectedWeek].toLocaleString()} pts
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Teams — average per member */}
      {tab === "teams" && (
        <ol className="space-y-2">
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">No teams yet — create one and get your crew in!</p>
          )}
          {teams.map((t, i) => (
            <li
              key={t.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                i === 0 && t.avg > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.members} member{t.members === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold text-emerald-800">{t.avg.toLocaleString()} avg pts</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
