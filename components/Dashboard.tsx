"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMyData } from "@/lib/data";
import {
  CHALLENGE,
  currentChallengeWeek,
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
  const { activities, checkins, team, loading, totalPoints, refresh } = useMyData(profile);
  const [copied, setCopied] = useState(false);
  const [lbRefreshKey, setLbRefreshKey] = useState(0);

  const handleDataChanged = () => {
    refresh();
    onProfileChange();
    setLbRefreshKey((k) => k + 1);
  };

  if (!profile) return null;

  const todayIsoStr = todayIso();
  const weekNow = currentChallengeWeek();
  const preChallenge = todayIsoStr < CHALLENGE.startDate;
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
  const isBrandNew = totalPoints === 0 && activities.length === 0 && checkins.length === 0;

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
      {loading ? (
        <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Loading points summary">
          {[0, 1].map((card) => (
            <div key={card} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="h-3 w-2/3 rounded bg-slate-200" />
              <div className="mt-3 h-9 w-1/3 rounded-lg bg-slate-200" />
              <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200" />
              <div className="mt-2 h-3 w-3/4 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : isBrandNew ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-2xl" aria-hidden="true">🌱</p>
          <h2 className="mt-1 font-bold text-emerald-800">Welcome! Let&apos;s get your challenge started.</h2>
          <p className="mt-2 text-sm text-slate-600">🏃 Log your first activity</p>
          <p className="mt-1 text-sm text-slate-600">💚 Complete your first check-in</p>
        </div>
      ) : (
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
      )}

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
