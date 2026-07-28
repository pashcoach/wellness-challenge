"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useProfile, type ActivityEntry, type WellnessCheckin } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { computeActivityStreak } from "@/lib/streaks";
import { rankEntries } from "@/lib/leaderboard-ranking";
import {
  buildWrapUpStats,
  isWrapUpAvailable,
  WRAP_UP_GATE_MESSAGE_KEY,
  type WrapUpStats,
} from "@/lib/wrap-up";

interface PersonRow {
  id: string;
  team_id: string | null;
  total: number;
}

interface TeamRow {
  id: string;
  avg: number;
}

interface WrapUpData extends WrapUpStats {
  longestActivityStreak: number;
  individualRank: number | null;
  teamRank: number | null;
}

function rankFor<T>(rows: T[], points: (row: T) => number, matches: (row: T) => boolean) {
  return rankEntries(rows, points).find(({ entry }) => matches(entry))?.rank ?? null;
}

export default function WrapUpPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [data, setData] = useState<WrapUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const available = isWrapUpAvailable();

  const load = useCallback(async () => {
    if (!supabase || !session || !profile) return;

    setLoading(true);
    setError(null);
    const [activitiesResult, checkinsResult, peopleResult, teamsResult] = await Promise.all([
      supabase.from("activity_entries").select("*").eq("user_id", session.user.id),
      supabase.from("wellness_checkins").select("*").eq("user_id", session.user.id),
      supabase.from("leaderboard_totals").select("*").order("total", { ascending: false }),
      supabase.from("team_standings").select("*").order("avg", { ascending: false }),
    ]);
    const queryError =
      activitiesResult.error ?? checkinsResult.error ?? peopleResult.error ?? teamsResult.error;

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const activities = (activitiesResult.data as ActivityEntry[]) ?? [];
    const checkins = (checkinsResult.data as WellnessCheckin[]) ?? [];
    const people = (peopleResult.data as PersonRow[]) ?? [];
    const teams = (teamsResult.data as TeamRow[]) ?? [];

    setData({
      ...buildWrapUpStats(activities, checkins),
      longestActivityStreak: computeActivityStreak(activities).longest,
      individualRank: rankFor(people, (person) => person.total, (person) => person.id === session.user.id),
      teamRank: profile.team_id
        ? rankFor(teams, (team) => team.avg, (team) => team.id === profile.team_id)
        : null,
    });
    setLoading(false);
  }, [profile, session]);

  useEffect(() => {
    if (!available) {
      sessionStorage.setItem(WRAP_UP_GATE_MESSAGE_KEY, "The challenge isn't over yet!");
      router.replace("/");
      return;
    }
    if (authLoading || profileLoading) return;
    if (!session || !profile) {
      router.replace("/");
      return;
    }
    void Promise.resolve().then(load);
  }, [authLoading, available, load, profile, profileLoading, router, session]);

  if (!available || authLoading || profileLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-slate-500">Loading your challenge recap…</p>
      </main>
    );
  }

  if (error || !data || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">We couldn&apos;t load your recap.</p>
          <p className="mt-2 text-sm text-slate-500">{error ?? "Please try again shortly."}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const statCards = [
    { icon: "✨", label: "Total points", value: data.totalPoints.toLocaleString() },
    { icon: "⏱️", label: "Activity minutes", value: data.totalMinutes.toLocaleString() },
    { icon: "🏃", label: "Activities logged", value: data.activityCount.toLocaleString() },
    { icon: "💚", label: "Wellness check-ins", value: data.checkinCount.toLocaleString() },
    { icon: "⭐", label: "Favourite activity", value: data.mostFrequentActivity },
    { icon: "🔥", label: "Longest activity streak", value: `${data.longestActivityStreak} days` },
    {
      icon: "📅",
      label: "Best week",
      value: data.bestWeek.week
        ? `Week ${data.bestWeek.week} · ${data.bestWeek.points.toLocaleString()} pts`
        : "No points yet",
    },
    { icon: "🏅", label: "Final individual rank", value: data.individualRank ? `#${data.individualRank}` : "Unranked" },
    { icon: "🤝", label: "Final team rank", value: profile.team_id ? (data.teamRank ? `#${data.teamRank}` : "Unranked") : "No team" },
    { icon: "🌈", label: "Wellness pillars covered", value: `${data.pillarsCovered} of 4` },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-4 py-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-500 p-5 text-white shadow-2xl sm:p-9">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Wellness Challenge 2026
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            🎉 Challenge Complete!
          </h1>
          <p className="mt-3 text-lg text-emerald-100">
            {profile.full_name.split(" ")[0]}, look at everything you accomplished.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:p-5"
            >
              <p className="text-2xl" aria-hidden="true">{stat.icon}</p>
              <p className="mt-3 break-words text-xl font-black leading-tight sm:text-2xl">{stat.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-100">
                {stat.label}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-white px-5 py-6 text-center text-emerald-950 shadow-lg">
          <p className="text-xl font-black">📸 Screenshot this to share in Teams!</p>
          <p className="mt-1 text-sm text-emerald-700">You showed up for your wellness — that&apos;s worth celebrating.</p>
        </div>
      </section>

      <Link
        href="/"
        className="mx-auto mt-6 rounded-lg px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        ← Back to dashboard
      </Link>
    </main>
  );
}
