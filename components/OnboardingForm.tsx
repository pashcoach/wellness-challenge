"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import { AGE_RANGES, BUSINESS_UNITS } from "@/lib/constants";
import type { Profile } from "@/lib/data";

export default function OnboardingForm({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (p: Profile) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bu, setBu] = useState("");
  const [atCrc, setAtCrc] = useState<boolean | null>(null);
  const [age, setAge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (atCrc === null) {
      setError("Please answer the CRC location question.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        username: username.trim() || null,
        business_unit: bu,
        located_at_crc: atCrc,
        age_range: age,
      })
      .select()
      .single();
    setBusy(false);
    if (error) setError(friendlyError(error));
    else onDone(data as Profile);
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-bold text-emerald-800">Welcome! Tell us about you</h2>
      <p className="mt-1 text-sm text-slate-600">This only takes a minute — you only do it once.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">First name</label>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} placeholder="First name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Last name</label>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} placeholder="Last name" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Username <span className="font-normal text-slate-400">(optional — shown on leaderboards instead of your name)</span>
          </label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={input} placeholder="e.g. Quadzilla" maxLength={20} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Business unit</label>
          <select required value={bu} onChange={(e) => setBu(e.target.value)} className={input}>
            <option value="">Select your business unit…</option>
            {BUSINESS_UNITS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Are you located at CRC?</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setAtCrc(o.value)}
                className={`rounded-lg border py-2 text-sm font-medium ${
                  atCrc === o.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Age range</label>
          <select required value={age} onChange={(e) => setAge(e.target.value)} className={input}>
            <option value="">Select…</option>
            {AGE_RANGES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
