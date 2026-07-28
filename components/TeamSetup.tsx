"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import { teamJoinCodeFromUuid } from "@/lib/team-code";

interface TeamRow {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
}

export default function TeamSetup({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!supabase) return;
    setLoadingTeams(true);
    const [{ data: teamRows }, { data: profileRows }] = await Promise.all([
      supabase.from("teams").select("id, name, join_code").order("created_at"),
      supabase.from("profiles").select("team_id"),
    ]);
    const counts = new Map<string, number>();
    for (const p of profileRows ?? []) {
      if (p.team_id) counts.set(p.team_id, (counts.get(p.team_id) ?? 0) + 1);
    }
    setTeams(
      (teamRows ?? []).map((t) => ({
        ...t,
        member_count: counts.get(t.id) ?? 0,
      }))
    );
    setLoadingTeams(false);
  }, []);

  useEffect(() => {
    if (mode === "join") loadTeams();
  }, [mode, loadTeams]);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const teamId = crypto.randomUUID();
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .insert({
        id: teamId,
        name: teamName.trim(),
        join_code: teamJoinCodeFromUuid(teamId),
        created_by: profile.id,
      })
      .select()
      .single();
    if (tErr || !team) {
      setBusy(false);
      setError(tErr ? friendlyError(tErr) : "Could not create team.");
      return;
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", profile.id);
    setBusy(false);
    if (pErr) setError(friendlyError(pErr));
    else onDone();
  }

  async function joinTeam(teamId: string) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ team_id: teamId })
      .eq("id", profile.id);
    setBusy(false);
    if (pErr) setError(friendlyError(pErr));
    else onDone();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";
  const btn =
    "w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-bold text-emerald-800">Create or Join a Team 🤝</h2>
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-900">
          🍽️ Win a team lunch!
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          Work together to earn points — the top team <em>and</em> one lucky randomly-drawn team
          each win a team lunch at the end of the challenge. Team members averaged{" "}
          <strong>twice the points</strong> of solo participants last year!
        </p>
      </div>

      {mode === "choose" && (
        <div className="mt-5 space-y-2">
          <button onClick={() => setMode("create")} className={btn}>
            Create a new team
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full rounded-lg border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Join an existing team
          </button>
          <button
            onClick={onDone}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Skip for now — I&apos;ll participate solo
          </button>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={createTeam} className="mt-4 space-y-3">
          <input
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className={input}
            placeholder="Team name (e.g. The Quad Squad)"
          />
          <p className="text-xs text-slate-500">
            There&apos;s no size limit — the more the merrier! You&apos;ll get a shareable team code
            after creating it.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Creating…" : "Create team"}
          </button>
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="w-full py-1 text-sm text-slate-500"
          >
            ← Back
          </button>
        </form>
      )}

      {mode === "join" && (
        <div className="mt-4 space-y-3">
          {loadingTeams ? (
            <p className="text-sm text-slate-500">Loading teams…</p>
          ) : teams.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-slate-700">No teams yet!</p>
              <p className="mt-1 text-xs text-slate-500">
                Be the first — create a team and invite your coworkers.
              </p>
            </div>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {teams.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => joinTeam(t.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.member_count} member{t.member_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Join →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="w-full py-1 text-sm text-slate-500"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
