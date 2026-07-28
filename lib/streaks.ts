import { todayIso } from "./constants";
import type { ActivityEntry, WellnessCheckin } from "./data";

interface StreakResult {
  current: number;
  longest: number;
}

function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function previousWeekday(date: string): string {
  const previous = parseLocalDate(date);
  do {
    previous.setDate(previous.getDate() - 1);
  } while (!isWeekday(previous));
  return todayIso(previous);
}

function activityRunLengths(datesDescending: string[]): number[] {
  if (datesDescending.length === 0) return [];

  const runs: number[] = [];
  let runLength = 1;

  for (let index = 1; index < datesDescending.length; index += 1) {
    if (datesDescending[index] === previousWeekday(datesDescending[index - 1])) {
      runLength += 1;
    } else {
      runs.push(runLength);
      runLength = 1;
    }
  }

  runs.push(runLength);
  return runs;
}

export function computeActivityStreak(activities: ActivityEntry[]): StreakResult {
  const today = todayIso();
  const dates = [...new Set(
    activities
      .map((activity) => activity.entry_date)
      .filter((date) => date <= today && isWeekday(parseLocalDate(date)))
  )].sort((a, b) => b.localeCompare(a));

  const runs = activityRunLengths(dates);
  if (runs.length === 0) return { current: 0, longest: 0 };

  const latestEligibleDate = isWeekday(parseLocalDate(today)) ? today : previousWeekday(today);
  const currentIsActive = dates[0] === latestEligibleDate || dates[0] === previousWeekday(latestEligibleDate);

  return {
    current: currentIsActive ? runs[0] : 0,
    longest: Math.max(...runs),
  };
}

export function computeCheckinStreak(checkins: WellnessCheckin[]): StreakResult {
  const weeks = [...new Set(checkins.map((checkin) => checkin.week))].sort((a, b) => a - b);
  if (weeks.length === 0) return { current: 0, longest: 0 };

  let runLength = 1;
  let longest = 1;

  for (let index = 1; index < weeks.length; index += 1) {
    if (weeks[index] === weeks[index - 1] + 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    longest = Math.max(longest, runLength);
  }

  return { current: runLength, longest };
}
