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
const PAGE_SIZE = 10;

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

function PaginationControls({
  page,
  totalPages,
  from,
  to,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 0}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        ← Back
      </button>
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total} · Page {page + 1} of {totalPages}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages - 1}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}

export default function Leaderboard() {
  const { session } = useAuth();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("individual");
  const [selectedWeek, setSelectedWeek] = useState<number>(currentChallengeWeek() ?? 1);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

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

  // Reset to the first page whenever the search or tab changes.
  useEffect(() => {
    setPage(0);
  }, [search, tab]);

  const searchTerm = search.trim().toLowerCase();
  const matches = (p: PersonRow) =>
    !searchTerm ||
    p.display_name.toLowerCase().includes(searchTerm) ||
    (p.team_name ?? "").toLowerCase().includes(searchTerm);

  const individualRanked = useMemo(() => rankEntries(people, (person) => person.total), [people]);
  const weeklySorted = useMemo(
    () =>
      [...people].sort(
        (a, b) => (b[`w${selectedWeek}` as keyof PersonRow] as number) - (a[`w${selectedWeek}` as keyof PersonRow] as number)
      ),
    [people, selectedWeek]
  );
  const weeklyRanked = useMemo(
    () => rankEntries(weeklySorted, (person) => person[`w${selectedWeek}` as keyof PersonRow] as number),
    [weeklySorted, selectedWeek]
  );
  const teamRanked = useMemo(() => rankEntries(teams, (team) => team.avg), [teams]);

  // Filter by search while preserving each person's true rank.
  const filteredIndividual = searchTerm ? individualRanked.filter(({ entry }) => matches(entry)) : individualRanked;
  const filteredWeekly = searchTerm ? weeklyRanked.filter(({ entry }) => matches(entry)) : weeklyRanked;

  const totalPagesInd = Math.max(1, Math.ceil(filteredIndividual.length / PAGE_SIZE));
  const pageInd = Math.min(page, totalPagesInd - 1);
  const visibleIndividuals = filteredIndividual.slice(pageInd * PAGE_SIZE, (pageInd + 1) * PAGE_SIZE);

  const totalPagesWk = Math.max(1, Math.ceil(filteredWeekly.length / PAGE_SIZE));
  const pageWk = Math.min(page, totalPagesWk - 1);
  const visibleWeekly = filteredWeekly.slice(pageWk * PAGE_SIZE, (pageWk + 1) * PAGE_SIZE);

  const visibleTeams = teamRanked;

  const userId = session?.user.id;
  const currentPerson = people.find((person) => person.id === userId);
  const pinnedIndividual = !searchTerm
    ? getPinnedEntry(individualRanked, visibleIndividuals, (person) => person.id === userId, (person) => person.total)
    : null;
  const pinnedWeekly = !searchTerm
    ? getPinnedEntry(
        weeklyRanked,
        visibleWeekly,
        (person) => person.id === userId,
        (person) => person[`w${selectedWeek}` as keyof PersonRow] as number
      )
    : null;
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
      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search participants or teams…"
        aria-label="Search leaderboard"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      />

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
        <div>
          <ol className="space-y-2">
            {visibleIndividuals.length === 0 && <p className="text-sm text-slate-500">No participants found.</p>}
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
          <PaginationControls
            page={pageInd}
            totalPages={totalPagesInd}
            from={filteredIndividual.length ? pageInd * PAGE_SIZE + 1 : 0}
            to={Math.min((pageInd + 1) * PAGE_SIZE, filteredIndividual.length)}
            total={filteredIndividual.length}
            onPrev={() => setPage(pageInd - 1)}
            onNext={() => setPage(pageInd + 1)}
          />
        </div>
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
            {visibleWeekly.length === 0 && <p className="text-sm text-slate-500">No participants found.</p>}
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
          <PaginationControls
            page={pageWk}
            totalPages={totalPagesWk}
            from={filteredWeekly.length ? pageWk * PAGE_SIZE + 1 : 0}
            to={Math.min((pageWk + 1) * PAGE_SIZE, filteredWeekly.length)}
            total={filteredWeekly.length}
            onPrev={() => setPage(pageWk - 1)}
            onNext={() => setPage(pageWk + 1)}
          />
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