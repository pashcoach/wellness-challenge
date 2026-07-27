"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

export default function FeedbackButton({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !message.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("survey_responses").insert({
      user_id: profile.id,
      feedback: `[TEST FEEDBACK] ${message.trim()}`,
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setOpen(false);
    setMessage("");
    setToast(true);
  }

  return (
    <>
      {toast && (
        <Toast
          message="Feedback sent — thank you! 🙏"
          sub="Patrick and the app team will review it."
          onDone={() => setToast(false)}
        />
      )}

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
      >
        💬 Send feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">How&apos;s the app?</h3>
            <p className="mt-1 text-xs text-slate-500">
              Confusing? Broken? Love it? Ideas? Tell us anything — this goes straight to the app
              team.
            </p>
            <textarea
              autoFocus
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. The team join page was confusing because…"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
