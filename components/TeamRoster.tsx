"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import {
  prepareTeamRoster,
  type TeamRosterMember,
  type TeamRosterProfile,
} from "@/lib/team-roster";

export default function TeamRoster({ profile }: { profile: Profile }) {
  const [members, setMembers] = useState<TeamRosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!supabase || !profile.team_id) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    const { data, error: rosterError } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("team_id", profile.team_id);

    if (rosterError) {
      console.error("Failed to load team roster:", rosterError);
      setError(true);
      setLoading(false);
      return;
    }

    setMembers(prepareTeamRoster((data as TeamRosterProfile[] | null) ?? [], profile.id));
    setLoading(false);
  }, [profile.id, profile.team_id]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadMembers]);

  if (!profile.team_id) return null;

  return (
    <details className="group mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span>👥 View team roster{!loading && !error ? ` (${members.length})` : ""}</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
      </summary>

      <div className="border-t border-emerald-100 px-3 py-3">
        {loading ? (
          <p className="text-sm text-slate-500" aria-live="polite">Loading teammates…</p>
        ) : error ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-rose-700">We couldn&apos;t load the roster.</p>
            <button
              type="button"
              onClick={() => void loadMembers()}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Team members">
            {members.map((member) => (
              <li
                key={member.id}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  member.is_current_user
                    ? "border-emerald-300 bg-white text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span aria-hidden="true">👤 </span>{member.display_name}
                {member.is_current_user && <span className="ml-1 text-xs font-semibold">(You)</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Names follow the same privacy settings as the leaderboard.
        </p>
      </div>
    </details>
  );
}
