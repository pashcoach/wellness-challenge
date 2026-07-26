"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { CHALLENGE } from "@/lib/constants";
import BrandMark from "./BrandMark";

export default function AuthForm() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        This app isn&apos;t connected to its database yet. Add your Supabase keys to
        <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code> and restart the server.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } =
      mode === "signup" ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (error) setError(error);
    else if (mode === "signup") setNotice("Account created! If you see a confirmation email, click it — otherwise you're signed in.");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice("Password reset email sent! Check your inbox (and spam folder).");
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
      <div className="flex items-center gap-3">
        <BrandMark size={44} />
        <div>
          <h1 className="text-lg font-bold leading-tight text-emerald-800">{CHALLENGE.name}</h1>
          <p className="text-xs text-slate-500">{CHALLENGE.org}</p>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        October 5 – 30, 2026 · Earn points, win prizes, feel great.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <button
          onClick={() => setMode("signup")}
          className={`rounded-md py-1.5 ${mode === "signup" ? "bg-white shadow" : "text-slate-500"}`}
        >
          Sign up
        </button>
        <button
          onClick={() => setMode("signin")}
          className={`rounded-md py-1.5 ${mode === "signin" ? "bg-white shadow" : "text-slate-500"}`}
        >
          Sign in
        </button>
      </div>
      <form onSubmit={showReset ? handleReset : handleSubmit} className="mt-4 space-y-3">
        <input
          type="email"
          required
          placeholder="Work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {!showReset && (
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy
            ? "One moment…"
            : showReset
              ? "Send reset email"
              : mode === "signup"
                ? "Create my account"
                : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowReset(!showReset);
            setError(null);
            setNotice(null);
          }}
          className="w-full py-1 text-center text-xs font-medium text-slate-500 hover:text-emerald-700"
        >
          {showReset ? "← Back to sign in" : "Forgot your password?"}
        </button>
      </form>
    </div>
  );
}
