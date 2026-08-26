"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import AuthForm from "@/components/AuthForm";
import OnboardingForm from "@/components/OnboardingForm";
import TeamSetup from "@/components/TeamSetup";
import Dashboard from "@/components/Dashboard";

import ActivityBackdrop from "@/components/ActivityBackdrop";
import WelcomeVideo from "@/components/WelcomeVideo";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile();
  const [teamChecked, setTeamChecked] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const router = useRouter();

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

  if (!profile) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div className="relative z-10 w-full max-w-md">
          <OnboardingForm userId={session.user.id} onDone={() => refresh()} />
        </div>
      </main>
    );
  }

  if (!teamChecked) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ActivityBackdrop />
        <div className="relative z-10 w-full max-w-md">
          <TeamSetup
            profile={profile}
            onDone={() => {
              setTeamChecked(true);
              refresh();
              router.refresh();
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
