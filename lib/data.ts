"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  created_by: string | null;
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

export interface ProfileRefreshResult {
  data: Profile | null;
  error: unknown | null;
}

export function useProfile() {
  const { session } = useAuth();
  const sessionUserId = session?.user.id ?? null;
  const [profileState, setProfileState] = useState<
    | { userId: string; status: "confirmed"; data: Profile | null }
    | { userId: string; status: "error"; error: unknown }
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (): Promise<ProfileRefreshResult> => {
    const requestId = ++requestIdRef.current;
    if (!supabase || !sessionUserId) {
      setProfileState(null);
      setLoading(false);
      return { data: null, error: null };
    }

    setLoading(true);
    const requestedUserId = sessionUserId;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", requestedUserId)
      .maybeSingle();

    // A newer refresh owns the state if the session changed while this read ran.
    if (requestId !== requestIdRef.current) {
      return { data: null, error: new Error("A newer participant profile request is in progress.") };
    }

    if (error) {
      setProfileState((current) => {
        if (current?.userId === requestedUserId && current.status === "confirmed") return current;
        return { userId: requestedUserId, status: "error", error };
      });
      setLoading(false);
      return { data: null, error };
    }

    setProfileState({ userId: requestedUserId, status: "confirmed", data: data as Profile | null });
    setLoading(false);
    return { data: data as Profile | null, error: null };
  }, [sessionUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stateForSession = profileState?.userId === sessionUserId ? profileState : null;
  const profile = stateForSession?.status === "confirmed" ? stateForSession.data : null;
  const profileError = stateForSession?.status === "error" ? stateForSession.error : null;
  const loadingForSession = loading || Boolean(sessionUserId && !stateForSession);

  return { profile, profileError, loading: loadingForSession, refresh };
}

export function useMyData(profile: Profile | null) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [checkins, setCheckins] = useState<WellnessCheckin[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoadError, setTeamLoadError] = useState(false);
  const [canChangeTeam, setCanChangeTeam] = useState(false);
  const [canJoinTeam, setCanJoinTeam] = useState(false);
  const [teamMemberCount, setTeamMemberCount] = useState<number | null>(null);
  const [teamMemberCountError, setTeamMemberCountError] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !profile) {
      setActivities([]);
      setCheckins([]);
      setTeam(null);
      setTeamLoadError(false);
      setCanChangeTeam(false);
      setCanJoinTeam(false);
      setTeamMemberCount(null);
      setTeamMemberCountError(false);
      setLoading(false);
      return;
    }
    const [a, c, eligibility, joinEligibility, memberCount] = await Promise.all([
      supabase.from("activity_entries").select("*").eq("user_id", profile.id).order("entry_date", { ascending: false }),
      supabase.from("wellness_checkins").select("*").eq("user_id", profile.id).order("week"),
      supabase.rpc("can_current_user_change_teams"),
      supabase.rpc("can_current_user_join_team"),
      supabase.rpc("get_my_team_member_count"),
    ]);
    setActivities((a.data as ActivityEntry[]) ?? []);
    setCheckins((c.data as WellnessCheckin[]) ?? []);
    setCanChangeTeam(eligibility.error ? false : eligibility.data === true);
    setCanJoinTeam(joinEligibility.error ? false : joinEligibility.data === true);
    setTeamMemberCount(memberCount.error ? null : Number(memberCount.data));
    setTeamMemberCountError(Boolean(memberCount.error));
    if (profile.team_id) {
      const { data: t, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", profile.team_id)
        .maybeSingle();
      setTeam(teamError ? null : ((t as Team) ?? null));
      setTeamLoadError(Boolean(teamError) || !t);
    } else {
      setTeam(null);
      setTeamLoadError(false);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPoints =
    activities.reduce((s, e) => s + e.points, 0) + checkins.reduce((s, e) => s + e.points, 0);

  return {
    activities,
    checkins,
    team,
    teamLoadError,
    canChangeTeam,
    canJoinTeam,
    teamMemberCount,
    teamMemberCountError,
    loading,
    totalPoints,
    refresh,
  };
}
