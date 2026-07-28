import type { ActivityEntry, WellnessCheckin } from "./data";

export const WRAP_UP_GATE_MESSAGE_KEY = "wrapUpGateMessage";

export interface WrapUpStats {
  totalPoints: number;
  totalMinutes: number;
  activityCount: number;
  checkinCount: number;
  mostFrequentActivity: string;
  bestWeek: { week: number | null; points: number };
  pillarsCovered: number;
}

function reginaIsoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Regina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isWrapUpAvailable(now = new Date()): boolean {
  return reginaIsoDate(now) >= "2026-10-31";
}

export function buildWrapUpStats(
  activities: ActivityEntry[],
  checkins: WellnessCheckin[]
): WrapUpStats {
  const totalPoints =
    activities.reduce((sum, activity) => sum + activity.points, 0) +
    checkins.reduce((sum, checkin) => sum + checkin.points, 0);
  const activityCounts = new Map<string, number>();
  const pointsByWeek = new Map<number, number>();

  for (const activity of activities) {
    activityCounts.set(activity.activity, (activityCounts.get(activity.activity) ?? 0) + 1);
    pointsByWeek.set(activity.week, (pointsByWeek.get(activity.week) ?? 0) + activity.points);
  }
  for (const checkin of checkins) {
    pointsByWeek.set(checkin.week, (pointsByWeek.get(checkin.week) ?? 0) + checkin.points);
  }

  let mostFrequentActivity = "None logged";
  let highestFrequency = 0;
  for (const [activity, count] of activityCounts) {
    if (count > highestFrequency) {
      mostFrequentActivity = activity;
      highestFrequency = count;
    }
  }

  let bestWeek: WrapUpStats["bestWeek"] = { week: null, points: 0 };
  for (const [week, points] of [...pointsByWeek.entries()].sort((a, b) => a[0] - b[0])) {
    if (points > bestWeek.points) bestWeek = { week, points };
  }

  return {
    totalPoints,
    totalMinutes: activities.reduce((sum, activity) => sum + activity.minutes, 0),
    activityCount: activities.length,
    checkinCount: checkins.length,
    mostFrequentActivity,
    bestWeek,
    pillarsCovered: new Set(checkins.map((checkin) => checkin.pillar)).size,
  };
}
