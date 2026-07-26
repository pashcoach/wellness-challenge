"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CHALLENGE } from "@/lib/constants";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // Supabase puts the recovery token in the URL; the client picks it up automatically.
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also handle the case where the session is already established
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/");
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-xl font-bold text-emerald-800">{CHALLENGE.name}</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a new password</p>
        {ready ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="New password (6+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Verifying your reset link… If nothing happens, the link may have expired — go back and
            request a new one.
          </p>
        )}
      </div>
    </main>
  );
}
