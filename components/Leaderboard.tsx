"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { currentChallengeWeek } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { getPinnedEntry, rankEntries, type PinnedEntry } from "@/lib/leaderboard-ranking";

interface PersonRow {
  id: string;
  display_name: string;
  team_name: string | null;
  team_id: string | null;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  total: number;
}

interface TeamRow {
  id: string;
  name: string;
  members: number;
  avg: number;
}

type Tab = "individual" | "weekly" | "teams";

const MEDALS = ["🥇", "🥈", "🥉"];
const TOP_LIMIT = 10;

function rankLabel(rank: number) {
  return MEDALS[rank - 1] ?? `${rank}.`;
}

function BehindLabel({ pinned }: { pinned: PinnedEntry<unknown> }) {
  if (pinned.pointsBehind === null || pinned.nextRank === null) return null;

  return (
    <p className="mt-0.5 text-xs font-medium text-sky-700">
      {pinned.pointsBehind.toLocaleString()} {pinned.pointsBehind === 1 ? "pt" : "pts"} behind #{pinned.nextRank}
    </p>
  );
}

function PinnedPersonRow({ pinned, points }: { pinned: PinnedEntry<PersonRow>; points: number }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-7 text-center text-lg">{rankLabel(pinned.rank)}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">📍 You</p>
          <p className="text-sm font-semibold">{pinned.entry.display_name}</p>
          {pinned.entry.team_name && <p className="text-xs text-slate-500">{pinned.entry.team_name}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-800">{points.toLocaleString()} pts</p>
        <BehindLabel pinned={pinned} />
      </div>
    </li>
  );
}

function PinnedTeamRow({ pinned }: { pinned: PinnedEntry<TeamRow> }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-7 text-center text-lg">{rankLabel(pinned.rank)}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">📍 You</p>
          <p className="text-sm font-semibold">{pinned.entry.name}</p>
          <p className="text-xs text-slate-500">
            {pinned.entry.members} member{pinned.entry.members === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-800">{pinned.entry.avg.toLocaleString()} avg pts</p>
        <BehindLabel pinned={pinned} />
      </div>
    </li>
  );
}

export default function Leaderboard() {
  const { session } = useAuth();
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
    const [peopleRes, teamsRes] = await Promise.all([
      supabase.from("leaderboard_totals").select("*").order("total", { ascending: false }),
      supabase.from("team_standings").select("*").order("avg", { ascending: false }),
    ]);
    setPeople((peopleRes.data as PersonRow[]) ?? []);
    setTeams((teamsRes.data as TeamRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weeklySorted = useMemo(
    () =>
      [...people].sort(
        (a, b) => (b[`w${selectedWeek}` as keyof PersonRow] as number) - (a[`w${selectedWeek}` as keyof PersonRow] as number)
      ),
    [people, selectedWeek]
  );

  const individualRanked = useMemo(() => rankEntries(people, (person) => person.total), [people]);
  const weeklyRanked = useMemo(
    () => rankEntries(weeklySorted, (person) => person[`w${selectedWeek}` as keyof PersonRow] as number),
    [selectedWeek, weeklySorted]
  );
  const teamRanked = useMemo(() => rankEntries(teams, (team) => team.avg), [teams]);

  const visibleIndividuals = individualRanked.slice(0, TOP_LIMIT);
  const visibleWeekly = weeklyRanked.slice(0, TOP_LIMIT);
  const visibleTeams = teamRanked;
  const userId = session?.user.id;
  const currentPerson = people.find((person) => person.id === userId);
  const pinnedIndividual = getPinnedEntry(
    individualRanked,
    visibleIndividuals,
    (person) => person.id === userId,
    (person) => person.total
  );
  const pinnedWeekly = getPinnedEntry(
    weeklyRanked,
    visibleWeekly,
    (person) => person.id === userId,
    (person) => person[`w${selectedWeek}` as keyof PersonRow] as number
  );
  const pinnedTeam = getPinnedEntry(
    teamRanked,
    visibleTeams,
    (team) => team.id === currentPerson?.team_id,
    (team) => team.avg
  );

  if (loading) {
    return (
      <ol className="animate-pulse space-y-2" aria-label="Loading leaderboard">
        {[0, 1, 2].map((row) => (
          <li
            key={row}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-slate-200" />
              <div>
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="mt-1.5 h-3 w-20 rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-4 w-16 rounded bg-slate-200" />
          </li>
        ))}
      </ol>
    );
  }

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
        <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-center">
          <p className="text-lg" aria-hidden="true">🏁</p>
          <p className="text-sm font-semibold text-emerald-800">The leaderboard is ready!</p>
          <p className="text-xs text-emerald-700">Log an activity or check-in to claim the first spot.</p>
        </div>
      )}

      {/* Individual — overall cumulative */}
      {tab === "individual" && (
        <ol className="space-y-2">
          {people.length === 0 && <p className="text-sm text-slate-500">No participants yet.</p>}
          {visibleIndividuals.map(({ entry: p, rank }) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                rank === 1 && p.total > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{rankLabel(rank)}</span>
                <div>
                  <p className="text-sm font-semibold">{p.display_name}</p>
                  {p.team_name && <p className="text-xs text-slate-500">{p.team_name}</p>}
                </div>
              </div>
              <p className="text-sm font-bold text-emerald-800">{p.total.toLocaleString()} pts</p>
            </li>
          ))}
          {pinnedIndividual && <PinnedPersonRow pinned={pinnedIndividual} points={pinnedIndividual.entry.total} />}
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
            {visibleWeekly.map(({ entry: p, rank }) => {
              const weekPts = p[`w${selectedWeek}` as keyof PersonRow] as number;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    rank === 1 && weekPts > 0
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-lg">{rankLabel(rank)}</span>
                    <div>
                      <p className="text-sm font-semibold">{p.display_name}</p>
                      {p.team_name && <p className="text-xs text-slate-500">{p.team_name}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-800">
                    {weekPts.toLocaleString()} pts
                  </p>
                </li>
              );
            })}
            {pinnedWeekly && (
              <PinnedPersonRow
                pinned={pinnedWeekly}
                points={pinnedWeekly.entry[`w${selectedWeek}` as keyof PersonRow] as number}
              />
            )}
          </ol>
        </div>
      )}

      {/* Teams — average per member */}
      {tab === "teams" && (
        <ol className="space-y-2">
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">No teams yet — create one and get your crew in!</p>
          )}
          {visibleTeams.map(({ entry: t, rank }) => (
            <li
              key={t.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                rank === 1 && t.avg > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{rankLabel(rank)}</span>
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
          {pinnedTeam && <PinnedTeamRow pinned={pinnedTeam} />}
        </ol>
      )}
    </div>
  );
}
