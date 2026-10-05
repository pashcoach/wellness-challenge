"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/data";
import {
  normalizeUsername,
  publicNameAfterUsernameChange,
  USERNAME_MAX,
} from "@/lib/profile-settings";

export default function ProfileSettings({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(profile.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const previewName = publicNameAfterUsernameChange(profile.full_name, username);

  function close() {
    setOpen(false);
    setUsername(profile.username ?? "");
    setError(null);
    setSaved(false);
  }

  async function save() {
    if (!supabase) return;
    const checked = normalizeUsername(username);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: checked.username })
      .eq("id", profile.id);
    setBusy(false);
    if (updateError) {
      setError("Your username could not be saved. Please try again.");
      return;
    }
    setUsername(checked.username ?? "");
    setSaved(true);
    onSaved();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        Profile
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="profile-settings-title" className="text-lg font-bold text-emerald-800">Profile settings</h2>
            <p className="mt-1 text-sm text-slate-600">Choose how your name appears to other participants.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close profile settings" className="min-h-11 min-w-11 rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">×</button>
        </div>

        <label htmlFor="profile-username" className="mt-5 block text-sm font-semibold text-slate-800">Username <span className="font-normal text-slate-500">(optional)</span></label>
        <input
          id="profile-username"
          value={username}
          onChange={(event) => { setUsername(event.target.value); setSaved(false); setError(null); }}
          maxLength={USERNAME_MAX}
          autoComplete="nickname"
          aria-describedby={`profile-username-help${error ? " profile-username-error" : ""}`}
          aria-invalid={error ? true : undefined}
          placeholder="e.g. Quadzilla"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <p id="profile-username-help" className="mt-2 text-sm text-slate-600">
          Public preview: <strong>{previewName}</strong>. If removed, you will appear as your first name and last initial. Your full name stays private on participant leaderboards.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Your points, activities, check-ins, badges, team, and prize eligibility will not change.
        </p>
        {error && <p id="profile-username-error" role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {saved && <p role="status" className="mt-2 text-sm font-medium text-emerald-700">✓ Username saved. Leaderboards and team displays are updating.</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Close</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50">
            {busy ? "Saving…" : username.trim() ? "Save username" : "Remove username"}
          </button>
        </div>
      </div>
    </div>
  );
}
