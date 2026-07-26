"use client";

import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import AuthForm from "@/components/AuthForm";
import OnboardingForm from "@/components/OnboardingForm";
import TeamSetup from "@/components/TeamSetup";
import Dashboard from "@/components/Dashboard";
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 p-4">
        <AuthForm />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 p-4">
        <OnboardingForm userId={session.user.id} onDone={() => refresh()} />
      </main>
    );
  }

  if (!teamChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-800 to-emerald-950 p-4">
        <TeamSetup
          profile={profile}
          onDone={() => {
            setTeamChecked(true);
            refresh();
            router.refresh();
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Dashboard />
    </main>
  );
}
