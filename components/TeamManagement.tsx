"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { Profile, Team } from "@/lib/data";

export default function TeamManagement({
  profile,
  team,
  canChange,
  memberCount,
  memberCountError,
  onChanged,
}: {
  profile: Profile;
  team: Team;
  canChange: boolean;
  memberCount: number | null;
  memberCountError: boolean;
  onChanged: () => void;
}) {
  const [confirmation, setConfirmation] = useState<"leave" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCreator = team.created_by === profile.id;

  async function leaveTeam() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: leaveError } = await supabase.rpc("leave_current_team");
      if (leaveError) throw leaveError;
      onChanged();
    } catch (leaveError) {
      setError(friendlyError(leaveError));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase.rpc("delete_my_team");
      if (deleteError) throw deleteError;
      onChanged();
    } catch (deleteError) {
      setError(friendlyError(deleteError));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (!canChange) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">
          Team changes are locked because you have already made your first entry in the app.
        </p>
        <p className="mt-1">Contact Patrick if a correction is needed.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team options</p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        You can change teams only before your first entry in the app. An entry is made when you either
        log a wellness activity or complete the Weekly Wellness section by checking “I supported my … this week” and selecting “Confirm check-in.” After either action, leaving, switching, and deleting a team are locked.
      </p>

      {confirmation === null && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmation("leave");
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Leave team
          </button>
          {isCreator && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmation("delete");
              }}
              disabled={memberCount === null || memberCount > 1}
              className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Delete team
            </button>
          )}
        </div>
      )}

      {isCreator && memberCount !== null && memberCount > 1 && confirmation === null && (
        <p className="mt-2 text-xs text-slate-500">
          Before that cutoff, you can delete this team only after all other members have left. You
          can still leave; team ownership will transfer automatically to another member.
        </p>
      )}

      {isCreator && memberCountError && confirmation === null && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          Team membership could not be verified. Refresh the app before trying to delete this team.
        </p>
      )}

      {confirmation === "leave" && (
        <div role="group" aria-label="Confirm leaving team" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Leave {team.name}?</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            You will participate solo and can then join or create another team. If you created this
            team and members remain, ownership will transfer automatically. If you are the only
            member, the empty team will be deleted.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              disabled={busy}
              className="min-h-11 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void leaveTeam()}
              disabled={busy}
              className="min-h-11 flex-1 rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {busy ? "Leaving…" : "Yes, leave team"}
            </button>
          </div>
        </div>
      )}

      {confirmation === "delete" && (
        <div role="group" aria-label="Confirm deleting team" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-950">Delete {team.name}?</p>
          <p className="mt-1 text-xs leading-5 text-red-900">
            This permanently deletes the team and moves you to solo participation. This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              disabled={busy}
              className="min-h-11 flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void deleteTeam()}
              disabled={busy}
              className="min-h-11 flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Yes, delete team"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
