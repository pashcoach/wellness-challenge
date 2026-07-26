export const CHALLENGE = {
  name: "Wellness Challenge 2026",
  org: "Federated Co-operatives Limited",
  startDate: "2026-10-05",
  endDate: "2026-10-30",
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
      "Increase your water intake to stay hydrated",
      "Take a daily stretch break during work hours",
      "Find a new healthy recipe to make",
    ],
  },
  {
    key: "psychological",
    label: "Psychological Wellness",
    prompt: "Take care of your psychological health this week",
    examples: [
      "Take a meditation break daily",
      "Start or end your day by naming three things you are grateful for",
      "Watch a webinar or read an article on HomeWeb (Homewood Health) or Wellness Now (Co-operators)",
    ],
  },
  {
    key: "financial",
    label: "Financial Wellness",
    prompt: "Take care of your financial health this week",
    examples: [
      "Create a personal budget (or update a current one)",
      "Check out options to save money through employee programs",
      "Watch a webinar or read an article on financial wellbeing",
    ],
  },
  {
    key: "social",
    label: "Social Wellness",
    prompt: "Take care of your social health this week",
    examples: [
      "Connect or schedule a coffee/tea meetup with a colleague",
      "Call a friend or family member you don't regularly talk to",
      "Volunteer in your community (remember: 2 paid volunteer days per year!)",
    ],
  },
] as const;

export const ACTIVITIES = [
  "Walking",
  "Strength Training",
  "Running",
  "Cycling",
  "Hiking",
  "Yoga",
  "High Intensity Interval Training",
  "Fitness Class",
  "Swimming",
  "Volleyball",
  "Dance Lessons",
  "Golf",
  "Martial Arts",
  "Elliptical",
  "Pilates",
  "Curling",
  "Hockey",
  "Rowing",
  "Pickleball",
  "Boxing",
  "Gardening",
  "Yardwork",
  "Stretching / Tai Chi",
  "Climbing",
  "Skateboarding",
  "Housework",
  "Playing with kids",
  "Other",
] as const;

export const BUSINESS_UNITS = [
  "Energy and Ag",
  "Co-Op Refinery Manufacturing",
  "Supply Chain",
  "People and Culture",
  "Co-Op and External Relations",
  "Consumer Products",
  "Finance",
  "Health and Safety Compliance",
  "Technology",
  "FCL Manufacturing",
] as const;

export const AGE_RANGES = ["18–29", "30–39", "40–49", "50–59", "60–69", "70–79"] as const;

export function pointsForMinutes(minutes: number): number {
  return Math.floor(minutes / 10) * CHALLENGE.pointsPerTenMinutes;
}

export function getChallengeWeek(dateStr: string): number | null {
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

export function currentChallengeWeek(today = new Date()): number | null {
  const iso = today.toISOString().slice(0, 10);
  return getChallengeWeek(iso);
}
