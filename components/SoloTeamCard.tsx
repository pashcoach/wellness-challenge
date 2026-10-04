"use client";

import { useCallback, useState } from "react";
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
  canChange,
  onJoined,
}: {
  profile: Profile;
  canChange: boolean;
  onJoined: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamLoadError, setTeamLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!supabase) return;
    setLoadingTeams(true);
    setTeamLoadError(false);
    try {
      const [teamResult, countResult] = await Promise.all([
        supabase.from("teams").select("id, name, join_code").order("created_at"),
        supabase.rpc("get_team_member_counts"),
      ]);
      if (teamResult.error) throw teamResult.error;
      if (countResult.error) throw countResult.error;
      const counts = new Map<string, number>();
      for (const row of countResult.data ?? []) {
        counts.set(row.team_id, Number(row.member_count));
      }
      setTeams(
        (teamResult.data ?? []).map((team) => ({
          ...team,
          member_count: counts.get(team.id) ?? 0,
        }))
      );
    } catch {
      setTeams([]);
      setTeamLoadError(true);
    } finally {
      setLoadingTeams(false);
    }
  }, []);


  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createError } = await supabase.rpc("create_team_and_join", {
        p_name: teamName.trim(),
      });
      if (createError) throw createError;
      setToast(`Team "${teamName.trim()}" created — you're in!`);
      onJoined();
    } catch (createError) {
      setError(friendlyError(createError));
      onJoined();
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam(t: TeamRow) {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: joinError } = await supabase.rpc("join_team", { p_team: t.id });
      if (joinError) throw joinError;
      setToast(`Welcome to "${t.name}"!`);
      onJoined();
    } catch (joinError) {
      setError(friendlyError(joinError));
      onJoined();
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div>
      {toast && <Toast message="Done ✓" sub={toast} onDone={() => setToast(null)} />}

      {!canChange && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p>You&apos;re participating solo.</p>
          <p className="mt-1 text-xs font-medium text-slate-700">
            Team changes are locked after your first entry in the app: either logging a wellness
            activity or completing the Weekly Wellness section.
          </p>
          <p className="mt-1 text-xs">Use Need help to leave a message for the app team to assist with this correction.</p>
        </div>
      )}

      {canChange && mode === "idle" && (
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
              onClick={() => {
                setMode("join");
                void loadTeams();
              }}
              className="rounded-lg border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Join a team
            </button>
          </div>
        </div>
      )}

      {canChange && mode === "create" && (
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

      {canChange && mode === "join" && (
        <div className="space-y-2">
          {loadingTeams ? (
            <p className="text-sm text-slate-500">Loading teams…</p>
          ) : teamLoadError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>We couldn&apos;t load the team list.</p>
              <button type="button" onClick={() => void loadTeams()} className="mt-2 font-semibold underline">
                Try again
              </button>
            </div>
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
