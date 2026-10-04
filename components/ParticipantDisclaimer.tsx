"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { DISCLAIMER_VERSION } from "@/lib/disclaimer";
import { friendlyError } from "@/lib/errors";
import ActivityBackdrop from "./ActivityBackdrop";
import BrandMark from "./BrandMark";

export function ParticipantDisclaimerContent() {
  return (
    <div className="space-y-4 text-sm leading-6 text-slate-700">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <p className="font-semibold">In summary:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The challenge provides general information, not medical or financial advice.</li>
          <li>Consult the appropriate health care or financial professional when needed.</li>
          <li>Participate only in activities and strategies that are appropriate for you.</li>
          <li>Your username, or your first name and last initial, may be visible to other participants.</li>
        </ul>
      </div>

      <div className="space-y-3" aria-label="Full participant disclaimer">
        <p>
          The information presented in this FCL Wellness Challenge App and Challenge is for
          informational purposes only and not intended to replace medical advice, diagnosis, or
          treatment. Users should not disregard or delay in obtaining medical advice for any
          medical condition they have, and they should seek the assistance of their health care
          professionals for any such conditions.
        </p>
        <p>
          Not all exercise, movement, activity, nutrition, hydration, stress management, mental
          health, and financial suggestions in this App and Challenge are suitable for everyone.
          Check with your health care/financial professionals before beginning any exercise,
          movement, or activity program to avoid/reduce the risk of injury. Perform these suggested
          exercises, movements, activities, psychological, and financial health strategies at your
          own risk. Endurance Journey (Patrick Ash Coaching Inc.) will not be responsible or liable
          for any injury sustained as a result of using any recommendations presented in this App
          and Challenge.
        </p>
        <p>
          Users understand that their username or first name and last initial can be viewed by
          other users of this App.
        </p>
      </div>
    </div>
  );
}

export default function ParticipantDisclaimer({
  onAccepted,
  onSignOut,
}: {
  onAccepted: () => void;
  onSignOut: () => void;
}) {
  const [healthAccepted, setHealthAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!supabase || !healthAccepted || !privacyAccepted) return;
    setBusy(true);
    setError(null);
    const { error: acceptError } = await supabase.rpc("accept_participant_disclaimer", {
      p_version: DISCLAIMER_VERSION,
    });
    setBusy(false);
    if (acceptError) {
      setError(friendlyError(acceptError));
      return;
    }
    onAccepted();
  }

  return (
    <main className="relative min-h-screen px-4 py-8 sm:py-12">
      <ActivityBackdrop />
      <section
        aria-labelledby="participant-disclaimer-title"
        className="relative z-10 mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-8"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={42} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              FCL Wellness Challenge
            </p>
            <h1 id="participant-disclaimer-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
              Please review before participating
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Read the complete disclaimer and acknowledge both items before entering the challenge.
          You will only be asked again if the disclaimer changes.
        </p>

        <div className="mt-5 max-h-[48vh] overflow-y-auto rounded-xl border border-slate-200 p-4 sm:max-h-none sm:overflow-visible">
          <ParticipantDisclaimerContent />
        </div>

        <fieldset className="mt-5 space-y-3">
          <legend className="sr-only">Required acknowledgements</legend>
          <label
            htmlFor="health-risk-acknowledgement"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-200"
          >
            <input
              id="health-risk-acknowledgement"
              type="checkbox"
              checked={healthAccepted}
              onChange={(event) => setHealthAccepted(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
            />
            <span>
              I have read and understand the health, financial, and participation disclaimer. I
              understand that I participate at my own risk and should consult an appropriate
              professional when needed.
            </span>
          </label>

          <label
            htmlFor="privacy-acknowledgement"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-200"
          >
            <input
              id="privacy-acknowledgement"
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
            />
            <span>
              I understand that my username, or my first name and last initial, may be visible to
              other participants in the app.
            </span>
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={busy || !healthAccepted || !privacyAccepted}
            onClick={accept}
            className="min-h-12 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Saving…" : "Accept and continue"}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy}
            className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 underline hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
