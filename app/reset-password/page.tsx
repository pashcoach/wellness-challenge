"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { parsePasswordRecoveryHash } from "@/lib/password-recovery";
import { CHALLENGE } from "@/lib/constants";
import ActivityBackdrop from "@/components/ActivityBackdrop";
import BrandMark from "@/components/BrandMark";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let settled = false;
    let mounted = true;

    const markReady = () => {
      if (!mounted) return;
      settled = true;
      setError(null);
      setReady(true);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") markReady();
    });

    async function initializeRecovery() {
      if (!supabase) return;
      const redirect = parsePasswordRecoveryHash(window.location.hash);

      if (redirect.kind === "error") {
        settled = true;
        if (mounted) setError(redirect.message);
        return;
      }

      if (redirect.kind === "tokens") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: redirect.accessToken,
          refresh_token: redirect.refreshToken,
        });
        if (!mounted) return;
        if (sessionError) {
          settled = true;
          setError("This password reset link is invalid or has expired. Please request a new one.");
          return;
        }
        window.history.replaceState(null, "", window.location.pathname);
        markReady();
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) markReady();
      else if (sessionError) {
        settled = true;
        setError(friendlyError(sessionError));
      }
    }

    void initializeRecovery();
    const timeout = window.setTimeout(() => {
      if (mounted && !settled) {
        setError(
          "We couldn't verify this reset link. Please return to sign in and request a fresh reset email."
        );
      }
    }, 5000);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
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
    if (error) setError(friendlyError(error));
    else router.push("/");
  }

  const input =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none";

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ActivityBackdrop />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <h1 className="text-lg font-bold leading-tight text-emerald-800">{CHALLENGE.name}</h1>
            <p className="text-xs text-slate-500">{CHALLENGE.org}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">Choose a new password</p>
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
        ) : error ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
            <Link
              href="/"
              className="block w-full rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Return to sign in
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Verifying your reset link…</p>
        )}
      </div>
    </main>
  );
}
