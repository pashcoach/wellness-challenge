"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import Link from "next/link";

interface Row {
  profiles: {
    id: string; full_name: string; business_unit: string;
    located_at_crc: boolean; age_range: string; team_id: string | null;
  }[];
  teams: { id: string; name: string }[];
  activities: { user_id: string; activity: string; minutes: number; points: number; entry_date: string; week: number }[];
  checkins: { user_id: string; week: number; pillar: string; points: number; comment: string | null }[];
  surveys: { user_id: string }[];
}

function toCsv(rows: (string | number | boolean | null)[][]): string {
  return rows
    .map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function AdminPage() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawResult, setDrawResult] = useState<string | null>(null);

  const isAdmin = profile?.is_admin === true;

  const load = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const [profiles, teams, activities, checkins, surveys] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("teams").select("id, name"),
      supabase.from("activity_entries").select("user_id, activity, minutes, points, entry_date, week"),
      supabase.from("wellness_checkins").select("user_id, week, pillar, points, comment"),
      supabase.from("survey_responses").select("user_id"),
    ]);
    setData({
      profiles: (profiles.data ?? []) as Row["profiles"],
      teams: (teams.data ?? []) as Row["teams"],
      activities: (activities.data ?? []) as Row["activities"],
      checkins: (checkins.data ?? []) as Row["checkins"],
      surveys: (surveys.data ?? []) as Row["surveys"],
    });
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const pointsByUser = new Map<string, number>();
    for (const a of data.activities) pointsByUser.set(a.user_id, (pointsByUser.get(a.user_id) ?? 0) + a.points);
    for (const c of data.checkins) pointsByUser.set(c.user_id, (pointsByUser.get(c.user_id) ?? 0) + c.points);

    const active = data.profiles.filter((p) => (pointsByUser.get(p.id) ?? 0) > 0);
    const totalMinutes = data.activities.reduce((s, a) => s + a.minutes, 0);

    const byBu = new Map<string, number>();
    for (const p of active) byBu.set(p.business_unit, (byBu.get(p.business_unit) ?? 0) + 1);

    const byDate = new Map<string, Set<string>>();
    for (const a of data.activities) {
      const s = byDate.get(a.entry_date) ?? new Set<string>();
      s.add(a.user_id);
      byDate.set(a.entry_date, s);
    }

    const teamNames = new Map(data.teams.map((t) => [t.id, t.name]));
    const byTeam = new Map<string, number[]>();
    for (const p of data.profiles) {
      if (!p.team_id) continue;
      const arr = byTeam.get(p.team_id) ?? [];
      arr.push(pointsByUser.get(p.id) ?? 0);
      byTeam.set(p.team_id, arr);
    }
    const teamStandings = [...byTeam.entries()]
      .map(([id, pts]) => ({
        id,
        name: teamNames.get(id) ?? "Team",
        members: pts.length,
        avg: Math.round(pts.reduce((s, v) => s + v, 0) / pts.length),
      }))
      .sort((a, b) => b.avg - a.avg);

    const crcYes = active.filter((p) => p.located_at_crc).length;

    return { pointsByUser, active, totalMinutes, byBu, byDate, teamStandings, crcYes };
  }, [data]);

  if (authLoading || profileLoading) return <main className="p-8 text-slate-500">Loading…</main>;
  if (!session || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold">Admins only</p>
          <p className="mt-1 text-sm text-slate-500">Your account doesn&apos;t have admin access.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 underline">← Back to the app</Link>
        </div>
      </main>
    );
  }
  if (loading || !data || !stats) return <main className="p-8 text-slate-500">Loading stats…</main>;

  const topTeam = stats.teamStandings[0];

  function drawRandom(from: string[], label: string) {
    if (from.length === 0) {
      setDrawResult(`No eligible ${label} yet.`);
      return;
    }
    const winnerId = from[Math.floor(Math.random() * from.length)];
    const winner = data!.profiles.find((p) => p.id === winnerId);
    setDrawResult(`🎲 ${label}: ${winner?.full_name ?? winnerId}`);
  }

  function downloadCsv() {
    if (!data || !stats) return;
    const rows: (string | number | boolean | null)[][] = [
      ["name", "business_unit", "located_at_crc", "age_range", "team", "activity_entries", "activity_minutes", "activity_points", "wellness_checkins", "wellness_points", "total_points"],
    ];
    const teamNames = new Map(data.teams.map((t) => [t.id, t.name]));
    for (const p of data.profiles) {
      const acts = data.activities.filter((a) => a.user_id === p.id);
      const chks = data.checkins.filter((c) => c.user_id === p.id);
      rows.push([
        p.full_name,
        p.business_unit,
        p.located_at_crc ? "yes" : "no",
        p.age_range,
        p.team_id ? teamNames.get(p.team_id) ?? "" : "",
        acts.length,
        acts.reduce((s, a) => s + a.minutes, 0),
        acts.reduce((s, a) => s + a.points, 0),
        chks.length,
        chks.reduce((s, c) => s + c.points, 0),
        stats.pointsByUser.get(p.id) ?? 0,
      ]);
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wellness_challenge_2026_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const weeklyDrawPool = (week: number) =>
    [...new Set([
      ...data.activities.filter((a) => a.week === week).map((a) => a.user_id),
      ...data.checkins.filter((c) => c.week === week).map((c) => c.user_id),
    ])];

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-emerald-800">Admin Dashboard</h1>
        <Link href="/" className="text-sm font-medium text-emerald-700 underline">← Back to app</Link>
      </header>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Registered", value: data.profiles.length },
          { label: "Active participants", value: stats.active.length },
          { label: "At CRC", value: stats.crcYes },
          { label: "Total activity minutes", value: stats.totalMinutes.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-800">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Entries per day */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">Participants logging per day</h2>
        {stats.byDate.size === 0 ? (
          <p className="text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {[...stats.byDate.entries()].sort().map(([date, users]) => {
              const max = Math.max(...[...stats.byDate.values()].map((s) => s.size));
              return (
                <div key={date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-emerald-500"
                    style={{ height: `${(users.size / max) * 100}%`, minHeight: 4 }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100">
                    {date.slice(5)}: {users.size}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* BU breakdown */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Active by business unit</h2>
          <ul className="space-y-1 text-sm">
            {[...stats.byBu.entries()].sort((a, b) => b[1] - a[1]).map(([bu, n]) => (
              <li key={bu} className="flex justify-between">
                <span>{bu}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Team standings */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Team standings (avg per member)</h2>
          <ol className="space-y-1 text-sm">
            {stats.teamStandings.map((t, i) => (
              <li key={t.id} className="flex justify-between">
                <span>{i + 1}. {t.name} <span className="text-slate-400">({t.members})</span></span>
                <span className="font-semibold">{t.avg.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Prize draws */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold">🎁 Prize draws</h2>
        <p className="mb-3 text-xs text-slate-500">Results are random — run them when you&apos;re ready and note the winner before clicking again.</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              onClick={() => drawRandom(weeklyDrawPool(w), `Week ${w} draw winner`)}
              className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Week {w} draw
            </button>
          ))}
          <button
            onClick={() => {
              const teamIds = stats.teamStandings.map((t) => t.id).filter((id) => id !== topTeam?.id);
              if (teamIds.length === 0) return setDrawResult("No other teams to draw from yet.");
              const id = teamIds[Math.floor(Math.random() * teamIds.length)];
              setDrawResult(`🎲 Random team lunch: ${stats.teamStandings.find((t) => t.id === id)?.name}`);
            }}
            className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Random team lunch
          </button>
          <button
            onClick={() => drawRandom(data.surveys.map((s) => s.user_id), "Survey draw winner")}
            className="rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Survey draw
          </button>
        </div>
        {topTeam && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            🏆 Top team (lunch): <strong>{topTeam.name}</strong> — {topTeam.avg.toLocaleString()} avg pts
          </p>
        )}
        {drawResult && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{drawResult}</p>
        )}
      </div>

      {/* Export */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-bold">📊 Export for the report</h2>
        <p className="mb-3 text-sm text-slate-600">
          One CSV with every participant: business unit, CRC location, team, activity minutes/points, check-ins, and totals — ready to build the summary report from.
        </p>
        <button
          onClick={downloadCsv}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Download CSV export
        </button>
      </div>
    </main>
  );
}
