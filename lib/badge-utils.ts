import { supabase } from "./supabase";

export interface Badge {
  key: string;
  name: string;
  icon: string;
  description: string;
  category: "milestone" | "streak" | "social" | "hidden";
  trigger_type: string;
  trigger_value: number | null;
}

export interface UserBadge {
  key: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  awarded_at: string;
}

export const ALL_BADGES: Badge[] = [
  { key: "bronze", name: "Bronze", icon: "🥉", description: "Log your first activity", category: "milestone", trigger_type: "points", trigger_value: 1 },
  { key: "silver", name: "Silver", icon: "🥈", description: "Earn 140 lifetime points", category: "milestone", trigger_type: "points", trigger_value: 140 },
  { key: "gold", name: "Gold", icon: "🥇", description: "Earn 280 lifetime points", category: "milestone", trigger_type: "points", trigger_value: 280 },
  { key: "platinum", name: "Platinum", icon: "💎", description: "Earn 420 lifetime points", category: "milestone", trigger_type: "points", trigger_value: 420 },
  { key: "champion", name: "Champion", icon: "🏆", description: "Earn 560 total points", category: "milestone", trigger_type: "points", trigger_value: 560 },
  { key: "overachiever", name: "Overachiever", icon: "⭐", description: "Earn 700+ lifetime points", category: "milestone", trigger_type: "points", trigger_value: 700 },
  { key: "on_fire", name: "On Fire", icon: "🔥", description: "Log activity 3 days in a row", category: "streak", trigger_type: "streak_days", trigger_value: 3 },
  { key: "blazing", name: "Blazing", icon: "🔥🔥", description: "Log activity 5 days in a row", category: "streak", trigger_type: "streak_days", trigger_value: 5 },
  { key: "inferno", name: "Inferno", icon: "🔥🔥🔥", description: "Log activity 10 days in a row", category: "streak", trigger_type: "streak_days", trigger_value: 10 },
  { key: "all_rounder", name: "All-Rounder", icon: "📝", description: "Complete all 4 weekly wellness check-ins", category: "hidden", trigger_type: "all_checkins", trigger_value: 4 },
  { key: "night_owl", name: "Night Owl", icon: "🦉", description: "Log activity after 9pm on 5+ different days", category: "hidden", trigger_type: "time_of_day", trigger_value: 5 },
  { key: "early_bird", name: "Early Bird", icon: "🌅", description: "Log activity before 7am on 5+ different days", category: "hidden", trigger_type: "time_of_day", trigger_value: 5 },
];

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("user_badges")
    .select("badges!inner(key, name, icon, description, category), awarded_at")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });
  if (!data) return [];
  return data.map((r: any) => ({
    key: r.badges.key,
    name: r.badges.name,
    icon: r.badges.icon,
    description: r.badges.description,
    category: r.badges.category,
    awarded_at: r.awarded_at,
  }));
}

export async function fetchAllUserBadgesMap(): Promise<Map<string, UserBadge[]>> {
  if (!supabase) return new Map();
  const { data } = await supabase
    .from("user_badges")
    .select("user_id, badges!inner(key, name, icon, description, category), awarded_at");
  if (!data) return new Map();
  const map = new Map<string, UserBadge[]>();
  for (const r of data as any[]) {
    const list = map.get(r.user_id) ?? [];
    list.push({
      key: r.badges.key,
      name: r.badges.name,
      icon: r.badges.icon,
      description: r.badges.description,
      category: r.badges.category,
      awarded_at: r.awarded_at,
    });
    map.set(r.user_id, list);
  }
  return map;
}

export function badgeCategoryLabel(category: string): string {
  switch (category) {
    case "milestone": return "Milestone";
    case "streak": return "Streak";
    case "social": return "Social";
    case "hidden": return "Hidden";
    default: return category;
  }
}

export function badgeCategoryOrder(category: string): number {
  switch (category) {
    case "milestone": return 0;
    case "streak": return 1;
    case "social": return 2;
    case "hidden": return 3;
    default: return 9;
  }
}