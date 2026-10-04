"use client";

import { useCallback, useEffect, useState } from "react";
import { displayName, type Profile } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { relativeTime } from "@/lib/team-feed";

interface TeamActivityEntry {
  id: string;
  activity: string;
  minutes: number;
  points: number;
  created_at: string;
  full_name: string;
  username: string | null;
}

export default function TeamFeed({ profile }: { profile: Profile }) {
  const [entries, setEntries] = useState<TeamActivityEntry[]>([]);

  const loadEntries = useCallback(async () => {
    if (!supabase || !profile.team_id) {
      setEntries([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_my_team_activity");

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
            const name = displayName(entry);
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
