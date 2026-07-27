"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

interface TeamRow {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
}

export default function SoloTeamCard({
  profile,
  onJoined,
}: {
  profile: Profile;
  onJoined: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
    setTeams((teamRows ?? []).map((t) => ({ ...t, member_count: counts.get(t.id) ?? 0 })));
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
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .insert({ name: teamName.trim(), created_by: profile.id })
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
    else {
      setToast(`Team "${team.name}" created — you're in!`);
      onJoined();
    }
  }

  async function joinTeam(t: TeamRow) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ team_id: t.id })
      .eq("id", profile.id);
    setBusy(false);
    if (pErr) setError(friendlyError(pErr));
    else {
      setToast(`Welcome to "${t.name}"!`);
      onJoined();
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div>
      {toast && <Toast message="Done ✓" sub={toast} onDone={() => setToast(null)} />}

      {mode === "idle" && (
        <div>
          <p className="text-sm text-slate-600">
            You&apos;re flying solo.{" "}
            <span className="font-medium text-emerald-700">
              Team members averaged twice the points last year — and two team lunches are up for
              grabs!
            </span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("create")}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Create a team
            </button>
            <button
              onClick={() => setMode("join")}
              className="rounded-lg border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Join a team
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={createTeam} className="space-y-3">
          <input
            required
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className={input}
            placeholder="Team name (e.g. The Quad Squad)"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <div className="space-y-2">
          {loadingTeams ? (
            <p className="text-sm text-slate-500">Loading teams…</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-slate-500">No teams yet — be the first to create one!</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {teams.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => joinTeam(t)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
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
            onClick={() => setMode("idle")}
            className="w-full py-1 text-center text-xs text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
