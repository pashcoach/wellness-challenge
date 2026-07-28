"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/team-feed";

interface TeamActivityEntry {
  id: string;
  activity: string;
  minutes: number;
  points: number;
  created_at: string;
  profiles: {
    full_name: string;
    username: string | null;
  } | null;
}

export default function TeamFeed({ profile }: { profile: Profile }) {
  const [entries, setEntries] = useState<TeamActivityEntry[]>([]);

  const loadEntries = useCallback(async () => {
    if (!supabase || !profile.team_id) {
      setEntries([]);
      return;
    }

    try {
      const { data: members, error: membersError } = await supabase
        .from("profiles")
        .select("id")
        .eq("team_id", profile.team_id);

      if (membersError) throw membersError;

      const memberIds = (members ?? []).map((member) => member.id);
      if (memberIds.length === 0) {
        setEntries([]);
        return;
      }

      const { data, error } = await supabase
        .from("activity_entries")
        .select("*, profiles(full_name, username)")
        .in("user_id", memberIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setEntries((data as TeamActivityEntry[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load team activity:", error);
    }
  }, [profile.team_id]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadEntries(), 0);
    const interval = window.setInterval(() => void loadEntries(), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadEntries]);

  if (!profile.team_id) return null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold">👥 Team Activity</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No team activity yet — be the first to log!</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const name = entry.profiles?.full_name || entry.profiles?.username || "Teammate";
            return (
              <li key={entry.id} className="py-2 text-sm text-slate-700 first:pt-0 last:pb-0">
                👤 <span className="font-medium text-slate-900">{name}</span> — {entry.activity},{" "}
                {entry.minutes} min, +{entry.points} pts — {relativeTime(entry.created_at)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
