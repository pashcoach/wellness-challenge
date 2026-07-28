"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityEntry, WellnessCheckin } from "@/lib/data";
import { buildWeeklyRecap, shouldShowWeeklyRecap } from "@/lib/weekly-recap";

interface Props {
  activities: ActivityEntry[];
  checkins: WellnessCheckin[];
  displayWeek: number;
  activityStreak: number;
  totalPoints: number;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function WeeklyRecap({
  activities,
  checkins,
  displayWeek,
  activityStreak,
  totalPoints,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const recap = useMemo(
    () => buildWeeklyRecap(activities, checkins, displayWeek, activityStreak, totalPoints),
    [activities, checkins, displayWeek, activityStreak, totalPoints]
  );

  useEffect(() => {
    let openTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (shouldShowWeeklyRecap(localStorage.getItem("lastRecapWeekSeen"), displayWeek)) {
        openTimer = setTimeout(() => {
          try {
            localStorage.setItem("lastRecapWeekSeen", String(displayWeek));
          } catch {
            // The recap can still be shown when storage is unavailable.
          }
          setIsOpen(true);
        }, 0);
      }
    } catch {
      if (displayWeek > 1) openTimer = setTimeout(() => setIsOpen(true), 0);
    }

    return () => {
      if (openTimer) clearTimeout(openTimer);
    };
  }, [displayWeek]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-recap-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Your weekly recap
        </p>
        <h2 id="weekly-recap-title" className="mt-1 text-2xl font-bold text-emerald-800">
          Week {recap.lastWeek.week} in review
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-700">Week {recap.lastWeek.week}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{recap.lastWeek.points} pts</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">
              {recap.weekBefore.week > 0 ? `Week ${recap.weekBefore.week}` : "Before challenge"}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{recap.weekBefore.points} pts</p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 text-sm text-slate-700">
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
            <span aria-hidden="true">{recap.goalMet ? "✅" : "❌"}</span>
            <div>
              <p className="font-semibold text-slate-800">
                Weekly goal {recap.goalMet ? "met" : "not met"}
              </p>
              <p className="text-xs text-slate-500">Goal: 140 points</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
            <span aria-hidden="true">⭐</span>
            <div>
              <p className="font-semibold text-slate-800">Best day</p>
              <p className="text-xs text-slate-500">
                {recap.bestDay
                  ? `${formatDate(recap.bestDay.date)} · ${recap.bestDay.points} pts`
                  : "No activities logged last week"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
            <span aria-hidden="true">🔥</span>
            <div>
              <p className="font-semibold text-slate-800">Current activity streak</p>
              <p className="text-xs text-slate-500">
                {recap.activityStreak} {recap.activityStreak === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-emerald-700 p-4 text-white">
          <p className="text-lg font-bold">
            {recap.pointsToGo.toLocaleString()} pts to go — {recap.pointsPerWeek} pts/week
          </p>
          <p className="mt-0.5 text-xs text-emerald-100">
            {recap.remainingWeeks} {recap.remainingWeeks === 1 ? "week" : "weeks"} remaining to reach the challenge goal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
