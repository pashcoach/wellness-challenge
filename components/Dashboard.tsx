"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMyData, useProfile } from "@/lib/data";
import {
  CHALLENGE,
  currentChallengeWeek,
  getChallengeWeek,
  pillarForWeek,
} from "@/lib/constants";
import ActivityForm from "./ActivityForm";
import WellnessCheckin from "./WellnessCheckin";
import Leaderboard from "./Leaderboard";
import EntryLog from "./EntryLog";
import FeedbackButton from "./FeedbackButton";
import BrandMark from "./BrandMark";
import Link from "next/link";

export default function Dashboard() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { activities, checkins, team, totalPoints, refresh } = useMyData(profile);
  const [copied, setCopied] = useState(false);
  const [lbRefreshKey, setLbRefreshKey] = useState(0);

  const handleDataChanged = () => {
    refresh();
    setLbRefreshKey((k) => k + 1);
  };

  if (!profile) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const weekNow = currentChallengeWeek();
  const preChallenge = todayIso < CHALLENGE.startDate;
  const displayWeek = weekNow ?? (preChallenge ? 1 : 4);
  const pillar = pillarForWeek(displayWeek);

  const weekActivityPts = activities
    .filter((a) => a.week === displayWeek)
    .reduce((s, a) => s + a.points, 0);
  const weekCheckinPts = checkins
    .filter((c) => c.week === displayWeek)
    .reduce((s, c) => s + c.points, 0);
  const weekPts = weekActivityPts + weekCheckinPts;
  const weekPct = Math.min(100, Math.round((weekPts / CHALLENGE.weeklyPointGoal) * 100));
  const totalPct = Math.min(100, Math.round((totalPoints / CHALLENGE.totalPointGoal) * 100));

  const weekActivities = activities.filter((a) => a.week === displayWeek);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      {/* Header */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <h1 className="text-lg font-bold text-emerald-800">{CHALLENGE.name}</h1>
            <p className="text-xs text-slate-500">
              Hi {profile.full_name.split(" ")[0]} · {profile.business_unit}
              {profile.located_at_crc ? " · CRC" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile.is_admin && (
            <Link href="/admin" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
              Admin
            </Link>
          )}
          <button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </header>

      {preChallenge && !CHALLENGE.testingMode && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          🗓️ The challenge starts <strong>October 5, 2026</strong>. You&apos;re all set up — come back then to start logging!
        </div>
      )}

      {CHALLENGE.testingMode && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          🧪 <strong>Testing mode</strong> — you can log entries with any date (they&apos;re mapped
          into the challenge weeks so you can try everything). Data from testing will be wiped
          before the real October 5 launch. Tap <strong>💬 Send feedback</strong> anytime!
        </div>
      )}

      {/* Points summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Week {displayWeek} · {pillar.label}
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">{weekPts} pts</p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${weekPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Goal: {CHALLENGE.weeklyPointGoal} pts this week</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Challenge total</p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">{totalPoints.toLocaleString()} pts</p>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${totalPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Goal: {CHALLENGE.totalPointGoal} pts by Oct 30</p>
        </div>
      </div>

      {/* Team card */}
      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        {team ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your team</p>
                <p className="mt-0.5 text-lg font-bold">{team.name}</p>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(team.join_code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded-lg bg-slate-100 px-3 py-2 text-center transition-colors hover:bg-emerald-100"
                title="Click to copy team code"
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {copied ? "✓ Copied!" : "Team code — tap to copy"}
                </p>
                <p className="font-mono text-sm font-bold tracking-widest">{team.join_code}</p>
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              📨 Invite coworkers: have them sign up, then either pick <strong>{team.name}</strong> from
              the team list or enter code <strong>{team.join_code}</strong> when they join.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            You&apos;re flying solo.{" "}
            <span className="font-medium text-emerald-700">Tip: team members averaged twice the points last year!</span>{" "}
            Sign out and back in to create or join a team.
          </p>
        )}
      </div>

      {/* Log + check-in */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">🏃 Log physical activity</h2>
          <ActivityForm profile={profile} onLogged={handleDataChanged} />
        </div>
        <div className="space-y-4">
          <WellnessCheckin
            profile={profile}
            week={displayWeek}
            existing={checkins.find((c) => c.week === displayWeek)}
            onLogged={handleDataChanged}
          />
        </div>
      </div>

      {/* Entry log */}
      <div className="mt-6">
        <EntryLog activities={activities} checkins={checkins} onChanged={handleDataChanged} />
      </div>

      {/* Leaderboard */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">🏆 Leaderboards</h2>
        <Leaderboard key={lbRefreshKey} />
      </div>

      <FeedbackButton profile={profile} />
    </div>
  );
}
