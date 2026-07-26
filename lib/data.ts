"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  business_unit: string;
  located_at_crc: boolean;
  age_range: string;
  team_id: string | null;
  is_admin: boolean;
}

/** Public display name: username if set, otherwise "First L." */
export function displayName(p: { full_name: string; username?: string | null }): string {
  if (p.username && p.username.trim()) return p.username.trim();
  const parts = p.full_name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0]}.` : first;
}

export interface Team {
  id: string;
  name: string;
  join_code: string;
}

export interface ActivityEntry {
  id: string;
  user_id: string;
  activity: string;
  minutes: number;
  points: number;
  entry_date: string;
  week: number;
  created_at: string;
}

export interface WellnessCheckin {
  id: string;
  user_id: string;
  week: number;
  pillar: string;
  comment: string | null;
  points: number;
  entry_date: string;
  created_at: string;
}

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}

export function useMyData(profile: Profile | null) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [checkins, setCheckins] = useState<WellnessCheckin[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !profile) {
      setActivities([]);
      setCheckins([]);
      setTeam(null);
      setLoading(false);
      return;
    }
    const [a, c] = await Promise.all([
      supabase.from("activity_entries").select("*").eq("user_id", profile.id).order("entry_date", { ascending: false }),
      supabase.from("wellness_checkins").select("*").eq("user_id", profile.id).order("week"),
    ]);
    setActivities((a.data as ActivityEntry[]) ?? []);
    setCheckins((c.data as WellnessCheckin[]) ?? []);
    if (profile.team_id) {
      const { data: t } = await supabase.from("teams").select("*").eq("id", profile.team_id).maybeSingle();
      setTeam((t as Team) ?? null);
    } else {
      setTeam(null);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPoints =
    activities.reduce((s, e) => s + e.points, 0) + checkins.reduce((s, e) => s + e.points, 0);

  return { activities, checkins, team, loading, totalPoints, refresh };
}
