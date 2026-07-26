"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/data";

export default function TeamSetup({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .insert({ name: teamName.trim(), join_code: code, created_by: profile.id })
      .select()
      .single();
    if (tErr || !team) {
      setBusy(false);
      setError(tErr?.message ?? "Could not create team.");
      return;
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", profile.id);
    setBusy(false);
    if (pErr) setError(pErr.message);
    else onDone();
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data: team, error: tErr } = await supabase
      .from("teams")
      .select("id")
      .ilike("join_code", joinCode.trim())
      .maybeSingle();
    if (tErr || !team) {
      setBusy(false);
      setError("No team found with that code. Check the code and try again.");
      return;
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", profile.id);
    setBusy(false);
    if (pErr) setError(pErr.message);
    else onDone();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";
  const btn =
    "w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-bold text-emerald-800">Join a team — or go solo</h2>
      <p className="mt-1 text-sm text-slate-600">
        Team members averaged <strong>twice the points</strong> of solo participants last year.
        No size limit — the more the merrier!
      </p>

      {mode === "choose" && (
        <div className="mt-5 space-y-2">
          <button onClick={() => setMode("create")} className={btn}>Create a new team</button>
          <button
            onClick={() => setMode("join")}
            className="w-full rounded-lg border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Join with a team code
          </button>
          <button onClick={onDone} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
            Skip for now — I&apos;ll participate solo
          </button>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={createTeam} className="mt-4 space-y-3">
          <input required value={teamName} onChange={(e) => setTeamName(e.target.value)} className={input} placeholder="Team name (e.g. The Quad Squad)" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={btn}>{busy ? "Creating…" : "Create team"}</button>
          <button type="button" onClick={() => setMode("choose")} className="w-full py-1 text-sm text-slate-500">← Back</button>
        </form>
      )}

      {mode === "join" && (
        <form onSubmit={joinTeam} className="mt-4 space-y-3">
          <input required value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className={`${input} uppercase tracking-widest`} placeholder="6-letter team code" maxLength={6} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={btn}>{busy ? "Joining…" : "Join team"}</button>
          <button type="button" onClick={() => setMode("choose")} className="w-full py-1 text-sm text-slate-500">← Back</button>
        </form>
      )}
    </div>
  );
}
