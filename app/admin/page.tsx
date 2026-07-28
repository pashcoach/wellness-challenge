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

    // ---- Weekly breakdown ----
    const weekLabels = ["Week 1 · Physical", "Week 2 · Psychological", "Week 3 · Financial", "Week 4 · Social"];
    const byWeek: {
      week: number;
      label: string;
      active: number;
      totalPoints: number;
      totalMinutes: number;
      checkinCount: number;
      checkinRate: number;
    }[] = [];
    for (let w = 1; w <= 4; w++) {
      const weekUsers = new Set<string>();
      for (const a of data.activities) if (a.week === w) weekUsers.add(a.user_id);
      for (const c of data.checkins) if (c.week === w) weekUsers.add(c.user_id);
      const weekPts =
        data.activities.filter((a) => a.week === w).reduce((s, a) => s + a.points, 0) +
        data.checkins.filter((c) => c.week === w).reduce((s, c) => s + c.points, 0);
      const weekMin = data.activities.filter((a) => a.week === w).reduce((s, a) => s + a.minutes, 0);
      const checkinCount = data.checkins.filter((c) => c.week === w).length;
      const checkinRate = weekUsers.size > 0 ? Math.round((checkinCount / weekUsers.size) * 100) : 0;
      byWeek.push({
        week: w,
        label: weekLabels[w - 1],
        active: weekUsers.size,
        totalPoints: weekPts,
        totalMinutes: weekMin,
        checkinCount,
        checkinRate,
      });
    }

    // ---- Activity frequency ----
    const activityFreq = new Map<string, number>();
    for (const a of data.activities) {
      activityFreq.set(a.activity, (activityFreq.get(a.activity) ?? 0) + 1);
    }
    const topActivities = [...activityFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // ---- Demographics ----
    const byAgeRange = new Map<string, number>();
    for (const p of active) byAgeRange.set(p.age_range, (byAgeRange.get(p.age_range) ?? 0) + 1);

    // ---- Team vs solo ----
    const teamUsers = new Set(data.profiles.filter((p) => p.team_id).map((p) => p.id));
    const activeOnTeam = active.filter((p) => teamUsers.has(p.id)).length;
    const activeSolo = active.length - activeOnTeam;

    return { pointsByUser, active, totalMinutes, byBu, byDate, teamStandings, crcYes, byWeek, topActivities, byAgeRange, activeOnTeam, activeSolo };
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

      {/* ─── Committee Report ─────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-emerald-800">📋 Committee Report</h2>
        <p className="mt-1 text-xs text-slate-500">Weekly breakdown and key trends for the wellness committee.</p>
      </div>

      {/* Weekly comparison table */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-bold">Weekly trends</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-medium">Week</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 font-medium">Total pts</th>
                <th className="pb-2 font-medium">Total min</th>
                <th className="pb-2 font-medium">Check-ins</th>
                <th className="pb-2 font-medium">Check-in rate</th>
              </tr>
            </thead>
            <tbody>
              {stats.byWeek.map((w, i) => {
                const prev = i > 0 ? stats.byWeek[i - 1] : null;
                const trend = (cur: number, prevVal: number | undefined) => {
                  if (prevVal === undefined || prevVal === 0) return null;
                  const diff = cur - prevVal;
                  if (Math.abs(diff) < 0.5) return <span className="text-slate-400">→</span>;
                  return diff > 0
                    ? <span className="text-emerald-600">↑{Math.round((diff / prevVal) * 100)}%</span>
                    : <span className="text-red-500">↓{Math.round(Math.abs(diff / prevVal) * 100)}%</span>;
                };
                return (
                  <tr key={w.week} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{w.label}</td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.active}</span>
                      {prev && <span className="ml-1.5">{trend(w.active, prev.active)}</span>}
                    </td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.totalPoints.toLocaleString()}</span>
                      {prev && <span className="ml-1.5">{trend(w.totalPoints, prev.totalPoints)}</span>}
                    </td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.totalMinutes.toLocaleString()}</span>
                      {prev && <span className="ml-1.5">{trend(w.totalMinutes, prev.totalMinutes)}</span>}
                    </td>
                    <td className="py-2.5">{w.checkinCount}</td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.checkinRate}%</span>
                      {prev && <span className="ml-1.5">{trend(w.checkinRate, prev.checkinRate)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top activities */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Top activities</h3>
          {stats.topActivities.length === 0 ? (
            <p className="text-sm text-slate-500">No activities logged yet.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {stats.topActivities.map(([activity, count], i) => (
                <li key={activity} className="flex justify-between">
                  <span>{i + 1}. {activity}</span>
                  <span className="font-semibold text-slate-500">{count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Demographics: age range */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Active by age range</h3>
          {stats.byAgeRange.size === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...stats.byAgeRange.entries()].sort((a, b) => b[1] - a[1]).map(([range, n]) => (
                <li key={range} className="flex justify-between">
                  <span>{range}</span>
                  <span className="font-semibold text-slate-500">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Team vs solo */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Teams vs solo</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Registered on a team</span>
              <span className="font-semibold">{data.profiles.filter((p) => p.team_id).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active on a team</span>
              <span className="font-semibold text-emerald-700">{stats.activeOnTeam}</span>
            </div>
            <div className="flex justify-between">
              <span>Active solo</span>
              <span className="font-semibold">{stats.activeSolo}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="font-medium">Team engagement rate</span>
              <span className="font-semibold text-emerald-700">
                {stats.activeOnTeam > 0
                  ? `${Math.round((stats.activeOnTeam / (stats.activeOnTeam + stats.activeSolo)) * 100)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar check-in completion */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Wellness pillar check-ins</h3>
          {stats.byWeek.length === 0 ? (
            <p className="text-sm text-slate-500">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.byWeek.map((w) => (
                <li key={w.week}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{w.label}</span>
                    <span className="text-slate-500">{w.checkinCount} check-ins</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${w.checkinRate}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {w.active === 0 ? "No participants" : `${w.checkinCount} of ${w.active} participants (${w.checkinRate}%)`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
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
