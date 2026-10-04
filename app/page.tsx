"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import AuthForm from "@/components/AuthForm";
import OnboardingForm from "@/components/OnboardingForm";
import TeamSetup from "@/components/TeamSetup";
import Dashboard from "@/components/Dashboard";
import ParticipantDisclaimer from "@/components/ParticipantDisclaimer";
import { hasAcceptedCurrentDisclaimer } from "@/lib/disclaimer";
import { supabase } from "@/lib/supabase";

import ActivityBackdrop from "@/components/ActivityBackdrop";
import WelcomeVideo from "@/components/WelcomeVideo";
import { useCallback, useEffect, useState } from "react";

export default function Home() {
  const { session, loading, signOut } = useAuth();
  const { profile, profileError, loading: profileLoading, refresh } = useProfile();
  const [teamChecked, setTeamChecked] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [disclaimerStatus, setDisclaimerStatus] = useState<"loading" | "required" | "accepted" | "error">("loading");

  const loadDisclaimer = useCallback(async () => {
    if (!supabase || !profile) {
      return;
    }
    const { data, error } = await supabase
      .from("participant_acknowledgements")
      .select("disclaimer_version, health_risk_accepted_at, privacy_accepted_at")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (error) {
      setDisclaimerStatus("error");
      return;
    }
    setDisclaimerStatus(hasAcceptedCurrentDisclaimer(data) ? "accepted" : "required");
  }, [profile]);

  useEffect(() => {
    void loadDisclaimer();
  }, [loadDisclaimer]);

  useEffect(() => {
    // Remember a solo / "skip for now" choice so returning users aren't forced
    // through team setup again (team-join users are covered by team_id below).
    if (typeof window !== "undefined" && localStorage.getItem("teamSetupDone")) {
      setTeamChecked(true);
    }
  }, []);

  useEffect(() => {
    if (profile?.team_id) setTeamChecked(true);
  }, [profile?.team_id]);

  useEffect(() => {
    setWelcomeChecked(true);
  }, []);

  // Welcome video check: must read localStorage on EVERY render (not just mount)
  // so that router.refresh() from team setup doesn't suppress it.
  const showWelcome = welcomeChecked && typeof window !== "undefined" && !localStorage.getItem("welcomeSeen");

  const dismissWelcome = () => {
    localStorage.setItem("welcomeSeen", "1");
    // Force re-render so showWelcome recalculates to false
    setWelcomeChecked(false);
    setTimeout(() => setWelcomeChecked(true), 0);
  };

  if (loading || (session && profileLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div className="relative z-10 w-full max-w-sm">
          <AuthForm />
        </div>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div role="alert" className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">We couldn&apos;t load your participant profile</h1>
          <p className="mt-2 text-sm text-slate-600">Check your connection, then try again. Your account information has not been changed.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div className="relative z-10 w-full max-w-md">
          <OnboardingForm userId={session.user.id} onDone={() => refresh()} />
          <button
            type="button"
            onClick={signOut}
            className="mx-auto mt-6 block w-fit rounded-lg border border-gray-900 bg-white px-5 py-2 text-sm font-bold text-gray-900 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (disclaimerStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Checking participant acknowledgement…</p>
      </main>
    );
  }

  if (disclaimerStatus === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">We couldn&apos;t load the participant disclaimer</h1>
          <p className="mt-2 text-sm text-slate-600">Check your connection, then try again.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setDisclaimerStatus("loading");
                void loadDisclaimer();
              }}
              className="min-h-11 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-11 rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (disclaimerStatus === "required") {
    return (
      <ParticipantDisclaimer
        onAccepted={() => setDisclaimerStatus("accepted")}
        onSignOut={signOut}
      />
    );
  }

  if (!teamChecked) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div className="relative z-10 w-full max-w-md">
          <TeamSetup
            profile={profile}
            onRefresh={refresh}
            onDone={() => {
              // Skip "for now" means they'll participate solo. Persist it so they
              // aren't re-prompted every login (they can still join a team later
              // from the dashboard). NOTE: no router.refresh() here — in this
              // Next version it resets client state and re-shows this screen.
              localStorage.setItem("teamSetupDone", "1");
              setTeamChecked(true);
              refresh();
            }}
          />
        </div>
      </main>
    );
  }

  if (welcomeChecked && showWelcome) {
    return <WelcomeVideo onDone={dismissWelcome} />;
  }

  return (
    <main className="min-h-screen">
      <Dashboard profile={profile} onProfileChange={refresh} />
    </main>
  );
}
