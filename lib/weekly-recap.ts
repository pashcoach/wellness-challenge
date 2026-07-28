import { CHALLENGE } from "./constants";
import type { ActivityEntry, WellnessCheckin } from "./data";

export interface WeeklyRecapSummary {
  lastWeek: { week: number; points: number };
  weekBefore: { week: number; points: number };
  goalMet: boolean;
  bestDay: { date: string; points: number } | null;
  activityStreak: number;
  pointsToGo: number;
  remainingWeeks: number;
  pointsPerWeek: number;
}

function pointsForWeek(
  activities: ActivityEntry[],
  checkins: WellnessCheckin[],
  week: number
): number {
  const activityPoints = activities
    .filter((activity) => activity.week === week)
    .reduce((sum, activity) => sum + activity.points, 0);
  const checkinPoints = checkins
    .filter((checkin) => checkin.week === week)
    .reduce((sum, checkin) => sum + checkin.points, 0);
  return activityPoints + checkinPoints;
}

export function shouldShowWeeklyRecap(lastSeenWeek: string | null, displayWeek: number): boolean {
  return displayWeek > 1 && lastSeenWeek !== String(displayWeek);
}

export function buildWeeklyRecap(
  activities: ActivityEntry[],
  checkins: WellnessCheckin[],
  displayWeek: number,
  activityStreak: number,
  totalPoints: number
): WeeklyRecapSummary {
  const lastWeek = displayWeek - 1;
  const weekBefore = displayWeek - 2;
  const lastWeekPoints = pointsForWeek(activities, checkins, lastWeek);
  const pointsByDate = new Map<string, number>();

  for (const activity of activities) {
    if (activity.week !== lastWeek) continue;
    pointsByDate.set(activity.entry_date, (pointsByDate.get(activity.entry_date) ?? 0) + activity.points);
  }

  let bestDay: WeeklyRecapSummary["bestDay"] = null;
  for (const [date, points] of pointsByDate) {
    if (!bestDay || points > bestDay.points || (points === bestDay.points && date > bestDay.date)) {
      bestDay = { date, points };
    }
  }

  const challengeWeeks = Math.ceil(CHALLENGE.totalPointGoal / CHALLENGE.weeklyPointGoal);
  const remainingWeeks = Math.max(1, challengeWeeks - displayWeek + 1);
  const pointsToGo = Math.max(0, CHALLENGE.totalPointGoal - totalPoints);

  return {
    lastWeek: { week: lastWeek, points: lastWeekPoints },
    weekBefore: { week: weekBefore, points: pointsForWeek(activities, checkins, weekBefore) },
    goalMet: lastWeekPoints >= CHALLENGE.weeklyPointGoal,
    bestDay,
    activityStreak,
    pointsToGo,
    remainingWeeks,
    pointsPerWeek: Math.ceil(pointsToGo / remainingWeeks),
  };
}
