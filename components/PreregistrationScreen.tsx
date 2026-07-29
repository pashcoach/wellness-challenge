"use client";

import { useState, useEffect } from "react";
import { CHALLENGE, todayIso } from "@/lib/constants";
import type { Profile } from "@/lib/data";
import BrandMark from "./BrandMark";
import FeedbackButton from "./FeedbackButton";
import Link from "next/link";

interface Props {
  profile: Profile;
}

function daysUntil(target: string): number {
  const start = new Date(todayIso() + "T12:00:00").getTime();
  const end = new Date(target + "T12:00:00").getTime();
  return Math.max(0, Math.ceil((end - start) / 86400000));
}

export default function PreregistrationScreen({ profile }: Props) {
  const [countdown, setCountdown] = useState(() => daysUntil(CHALLENGE.startDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(daysUntil(CHALLENGE.startDate));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-16 pt-8">
        {/* Header */}
        <header className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <h1 className="text-lg font-bold text-emerald-800">{CHALLENGE.name}</h1>
            <p className="text-xs text-slate-500">{CHALLENGE.org}</p>
          </div>
        </header>

        {/* Confirmation card */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✅
            </span>
            <div>
              <h2 className="text-xl font-bold text-emerald-800">
                You&apos;re registered, {profile.full_name.split(" ")[0]}!
              </h2>
              <p className="text-sm text-slate-500">
                {profile.business_unit}
                {profile.located_at_crc ? " · CRC" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="mt-4 rounded-2xl bg-emerald-700 p-6 text-center text-white shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-100">
            Challenge starts in
          </p>
          <p className="mt-1 text-5xl font-bold">{countdown}</p>
          <p className="mt-1 text-lg">{countdown === 1 ? "day" : "days"}</p>
          <p className="mt-2 text-sm text-emerald-100">
            {CHALLENGE.startDate} — {CHALLENGE.endDate}
          </p>
        </div>

        {/* What to expect */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-800">📋 What to expect</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">🏃</span>
              <span>Log wellness activities — every minute counts (1 point per minute)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">💚</span>
              <span>Complete one wellness check-in per week for +20 points each</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">🎯</span>
              <span>
                Weekly goal: {CHALLENGE.weeklyPointGoal} pts · Total challenge goal:{" "}
                {CHALLENGE.totalPointGoal} pts
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">🏆</span>
              <span>Weekly prize draws ($75 gift cards) per pillar of wellness</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">🤝</span>
              <span>Team up with coworkers — top team and one lucky draw win a team lunch</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">🏁</span>
              <span>Grand prize: two winners receive one paid day off</span>
            </li>
          </ul>
        </div>

        {/* Team info */}
        {profile.team_id && (
          <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800">🤝 Your team</h3>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;re on a team — come back on October 5 to start earning points together!
            </p>
            {profile.team_id && (
              <p className="mt-2 text-xs text-slate-500">
                You can still invite coworkers before the challenge starts.
              </p>
            )}
          </div>
        )}

        {/* Next steps */}
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="font-bold text-amber-900">🔔 Ready for launch day?</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
            <li>📧 Look out for an email from Patrick when the challenge opens on October 5</li>
            <li>📱 Bookmark the app link or save it to your home screen</li>
            <li>👥 Invite your coworkers to join your team before the start date</li>
          </ul>
        </div>

        {/* Feedback */}
        <div className="mt-4 text-center text-xs text-slate-400">
          <p>Have questions? Use the feedback button to ask.</p>
        </div>

        <FeedbackButton profile={profile} />
      </div>
    </main>
  );
}