"use client";

import { useId, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { normalizeTeamCode } from "@/lib/team-management";

/**
 * "Enter team code" form shown beside the team list.
 * A coworker pastes the code a teammate sent and joins directly.
 * The server (join_team_by_code) enforces the same rules as picking from the list.
 */
export default function TeamCodeJoin({
  disabled = false,
  onJoined,
  onError,
}: {
  disabled?: boolean;
  onJoined: (teamId: string) => void | Promise<void>;
  onError?: () => void | Promise<void>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const code = normalizeTeamCode(value);
    if (!code) {
      setError("Enter the team code a teammate sent you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: joinError } = await supabase.rpc("join_team_by_code", { p_code: code });
      if (joinError) throw joinError;
      setValue("");
      await onJoined(String(data));
    } catch (joinError) {
      setError(friendlyError(joinError));
      await onError?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" noValidate>
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-800">
        Enter team code
      </label>
      <p id={hintId} className="mt-0.5 text-xs text-slate-600">
        Paste the code a teammate sent you to join their team directly.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. A1B2C3"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={busy || disabled}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join with code"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
