"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import AuthForm from "@/components/AuthForm";
import OnboardingForm from "@/components/OnboardingForm";
import TeamSetup from "@/components/TeamSetup";
import Dashboard from "@/components/Dashboard";
import ActivityBackdrop from "@/components/ActivityBackdrop";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { session, loading } = useAuth();
  const { profile, loading: profileLoading, refresh } = useProfile();
  const [teamChecked, setTeamChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (profile?.team_id) setTeamChecked(true);
  }, [profile?.team_id]);

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

  return (
    <main className="min-h-screen">
      <Dashboard />
    </main>
  );
}
