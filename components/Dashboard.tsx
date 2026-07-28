"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMyData } from "@/lib/data";
import {
  CHALLENGE,
  currentChallengeWeek,
  getChallengeWeek,
  pillarForWeek,
  todayIso,
} from "@/lib/constants";
import ActivityForm from "./ActivityForm";
import WellnessCheckin from "./WellnessCheckin";
import Leaderboard from "./Leaderboard";
import EntryLog from "./EntryLog";
import FeedbackButton from "./FeedbackButton";
import SoloTeamCard from "./SoloTeamCard";
import SectionSeparator from "./SectionSeparator";
import BrandMark from "./BrandMark";
import type { Profile } from "@/lib/data";
import Link from "next/link";

export default function Dashboard({
  profile,
  onProfileChange,
}: {
  profile: Profile;
  onProfileChange: () => void;
}) {
  const { signOut } = useAuth();
  const { activities, checkins, team, totalPoints, refresh } = useMyData(profile);
  const [copied, setCopied] = useState(false);
  const [lbRefreshKey, setLbRefreshKey] = useState(0);
  const todayIsoStr = todayIso();
  const weekNow = currentChallengeWeek();
  const preChallenge = todayIsoStr < CHALLENGE.startDate;
  const defaultWeek = weekNow ?? (preChallenge ? 1 : 4);
  const [displayWeek, setDisplayWeek] = useState(defaultWeek);
  const pillar = pillarForWeek(displayWeek);

  const handleDataChanged = () => {
    refresh();
    onProfileChange();
    setLbRefreshKey((k) => k + 1);
  };

  if (!profile) return null;


  const weekActivityPts = activities
    .filter((a) => a.week === displayWeek)
    .reduce((s, a) => s + a.points, 0);
  const weekCheckinPts = checkins
    .filter((c) => c.week === displayWeek)
    .reduce((s, c) => s + c.points, 0);
  const weekPts = weekActivityPts + weekCheckinPts;
  const weekPct = Math.min(100, Math.round((weekPts / CHALLENGE.weeklyPointGoal) * 100));
  const totalPct = Math.min(100, Math.round((totalPoints / CHALLENGE.totalPointGoal) * 100));

  // ---- Streak counter ----
  // Collect all unique dates with entries, going back from today
  const entryDates = new Set<string>();
  for (const a of activities) entryDates.add(a.entry_date);
  for (const c of checkins) entryDates.add(c.entry_date);
  let streak = 0;
  const d = new Date();
  const dStr = () => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  while (entryDates.has(dStr()) && streak < 60) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // ---- Prize eligibility per week ----
  const weeksEntered = new Set<number>();
  for (const a of activities) if (a.week >= 1 && a.week <= 4) weeksEntered.add(a.week);
  for (const c of checkins) if (c.week >= 1 && c.week <= 4) weeksEntered.add(c.week);

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
              {streak >= 2 && (
                <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                  🔥 {streak}-day streak
                </span>
              )}
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

      {/* Week selector */}
      <div className="mt-4 flex gap-2">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            onClick={() => setDisplayWeek(w)}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
              displayWeek === w
                ? "bg-emerald-600 text-white shadow"
                : "bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">Week</span>
            {w}
          </button>
        ))}
      </div>

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

      {/* Prize eligibility — 4 dots showing which weeks qualify for the draw */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Weekly prize draw eligibility</p>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((w) => (
            <div key={w} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  weeksEntered.has(w)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {weeksEntered.has(w) ? "✓" : w}
              </div>
              <span className="text-[10px] text-slate-400">W{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Check-in nudge banner — shows when weekly check-in hasn't been done yet */}
      {!checkins.find((c) => c.week === displayWeek) && displayWeek >= 1 && (
        <div
          onClick={() =>
            document.getElementById("wellness-checkin-section")?.scrollIntoView({ behavior: "smooth" })
          }
          className="mt-4 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-300 hover:bg-amber-100"
        >
          <p className="text-sm font-semibold text-amber-900">
            💚 Week {displayWeek} check-in not done yet!
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Tap here to log your weekly wellness check-in worth {CHALLENGE.wellnessCheckInPoints} points.
            Missed weeks are gone forever.
          </p>
        </div>
      )}

      <SectionSeparator label="Log activity" icon="🏃" />

      {/* Log + check-in */}
      <div id="wellness-checkin-section" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <SectionSeparator label="Team" icon="🤝" />

      {/* Team card */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
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
          <SoloTeamCard profile={profile} onJoined={handleDataChanged} />
        )}
      </div>

      <SectionSeparator label="My log" icon="📒" />

      {/* Entry log */}
      <div className="mt-6">
        <EntryLog activities={activities} checkins={checkins} onChanged={handleDataChanged} />
      </div>

      <SectionSeparator label="Leaderboard" icon="🏆" />

      {/* Leaderboard */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">🏆 Leaderboards</h2>
        <Leaderboard key={lbRefreshKey} />
      </div>

      <FeedbackButton profile={profile} />
    </div>
  );
}
