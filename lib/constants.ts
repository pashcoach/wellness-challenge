export const CHALLENGE = {
  name: "Wellness Challenge 2026",
  org: "Federated Co-operatives Limited",
  startDate: "2026-10-05",
  endDate: "2026-10-30",
  /** TESTING MODE: true = any date can be logged (mapped into the challenge).
   *  Production additionally requires ALLOW_PRODUCTION_TESTING_MODE=true. */
  testingMode: process.env.NEXT_PUBLIC_TESTING_MODE === "true",
  weeklyPointGoal: 140,
  totalPointGoal: 560,
  pointsPerTenMinutes: 10,
  wellnessCheckInPoints: 20,
} as const;

export const PILLARS = [
  {
    key: "physical",
    label: "Physical Wellness",
    prompt: "Take care of your physical health this week",
    examples: [
      "Take a daily stretch break",
      "Increase your water intake",
      "Find a new healthy recipe to make",
      "Get a good night's sleep",
      "Meal prep for the week",
    ],
  },
  {
    key: "psychological",
    label: "Psychological Wellness",
    prompt: "Take care of your psychological health this week",
    examples: [
      "Take a meditation break",
      "Practice gratitude",
      "Take a phone or social media break",
      "Read a book for pleasure",
    ],
  },
  {
    key: "financial",
    label: "Financial Wellness",
    prompt: "Take care of your financial health this week",
    examples: [
      "Create or update a personal budget",
      "Read or watch something on financial wellbeing",
      "Review your subscriptions or spending",
      "Set a savings goal",
      "Check out employee savings discounts",
      "Donate to a local charity (United Way campaign or Movember)",
    ],
  },
  {
    key: "social",
    label: "Social Wellness",
    prompt: "Take care of your social health this week",
    examples: [
      "Connect for coffee or tea with a colleague",
      "Volunteer or sign up to volunteer in your community",
      "Call up a friend or family member",
      "Do an act of kindness",
      "Join a club, team, or community event",
    ],
  },
] as const;

export const ACTIVITIES = [
  "Barre",
  "Breathing Exercises",
  "Climbing",
  "Curling",
  "Cycling",
  "Dance Lessons",
  "Dog Training",
  "Elliptical",
  "Equestrian Sports",
  "Fitness Class",
  "Gardening",
  "Golf",
  "High Intensity Interval Training",
  "Hiking",
  "Hockey",
  "Housework",
  "Martial Arts",
  "Meditation",
  "Other",
  "Pickleball",
  "Pilates",
  "Playing with kids",
  "Rowing",
  "Running",
  "Skateboarding",
  "Stability Exercises",
  "Stand Up Paddleboard",
  "Strength Training",
  "Stretching / Tai Chi",
  "Swimming",
  "Volleyball",
  "Walking",
  "Yardwork",
  "Yoga",
] as const;

export const BUSINESS_UNITS = [
  "Co-op & External Relations",
  "Consumer Products",
  "Energy & Ag",
  "Finance",
  "Health, Safety & Compliance",
  "Manufacturing",
  "People & Culture",
  "Supply Chain",
  "Technology",
] as const;

export const AGE_RANGES = ["18–29", "30–39", "40–49", "50–59", "60–69", "70–79"] as const;

export const WELLNESS_ACTIVITIES = [] as const;

export function pointsForMinutes(minutes: number): number {
  return Math.floor(minutes / 10) * CHALLENGE.pointsPerTenMinutes;
}

export function getChallengeWeek(dateStr: string): number | null {
  if (CHALLENGE.testingMode) {
    // In testing mode any date is accepted; map everything into the current
    // "testing week" (always week 1–4 based on day of month so testers can
    // see different weeks by picking different dates).
    const day = new Date(dateStr + "T12:00:00").getDate();
    return Math.min(4, Math.floor((day - 1) / 7) + 1);
  }
  const d = new Date(dateStr + "T12:00:00");
  const start = new Date(CHALLENGE.startDate + "T00:00:00");
  const end = new Date(CHALLENGE.endDate + "T23:59:59");
  if (d < start || d > end) return null;
  const dayIndex = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.min(4, Math.floor(dayIndex / 7) + 1);
}

export function pillarForWeek(week: number) {
  return PILLARS[Math.min(4, Math.max(1, week)) - 1];
}

/** Today's date in YYYY-MM-DD using local (America/Regina) timezone.
 *  Saskatchewan is UTC-6 year-round (no DST). Using Date's local methods
 *  avoids the 6pm rollover bug where .toISOString() advances to tomorrow. */
export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function currentChallengeWeek(today = new Date()): number | null {
  const iso = todayIso(today);
  return getChallengeWeek(iso);
}