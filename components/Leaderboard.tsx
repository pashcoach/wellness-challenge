"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface TeamStanding {
  team_id: string;
  team_name: string;
  members: number;
  avg_points: number;
}

export default function Leaderboard() {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [profiles, activities, checkins, teams] = await Promise.all([
      supabase.from("profiles").select("id, team_id"),
      supabase.from("activity_entries").select("user_id, points"),
      supabase.from("wellness_checkins").select("user_id, points"),
      supabase.from("teams").select("id, name"),
    ]);

    const pointsByUser = new Map<string, number>();
    for (const a of activities.data ?? []) {
      pointsByUser.set(a.user_id, (pointsByUser.get(a.user_id) ?? 0) + a.points);
    }
    for (const c of checkins.data ?? []) {
      pointsByUser.set(c.user_id, (pointsByUser.get(c.user_id) ?? 0) + c.points);
    }

    const teamNames = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
    const byTeam = new Map<string, number[]>();
    for (const p of profiles.data ?? []) {
      if (!p.team_id) continue;
      const arr = byTeam.get(p.team_id) ?? [];
      arr.push(pointsByUser.get(p.id) ?? 0);
      byTeam.set(p.team_id, arr);
    }

    const rows: TeamStanding[] = [...byTeam.entries()].map(([team_id, pts]) => ({
      team_id,
      team_name: teamNames.get(team_id) ?? "Team",
      members: pts.length,
      avg_points: Math.round(pts.reduce((s, v) => s + v, 0) / pts.length),
    }));
    rows.sort((a, b) => b.avg_points - a.avg_points);
    setStandings(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading leaderboard…</p>;
  if (standings.length === 0)
    return <p className="text-sm text-slate-500">No teams yet — create one and get your crew in!</p>;

  return (
    <ol className="space-y-2">
      {standings.map((t, i) => (
        <li
          key={t.team_id}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
            i === 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-6 text-center text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
            <div>
              <p className="text-sm font-semibold">{t.team_name}</p>
              <p className="text-xs text-slate-500">{t.members} member{t.members === 1 ? "" : "s"}</p>
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-800">{t.avg_points.toLocaleString()} avg pts</p>
        </li>
      ))}
    </ol>
  );
}
