"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import { fetchUserBadges } from "@/lib/badge-utils";
import { BadgeGrid } from "@/components/BadgeDisplay";
import type { UserBadge } from "@/lib/badge-utils";
import Link from "next/link";

export default function BadgesPage() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchUserBadges(session.user.id).then((b) => {
      setBadges(b);
      setLoading(false);
    });
  }, [session?.user?.id]);

  if (authLoading || profileLoading) return <main className="p-8 text-slate-500">Loading…</main>;
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-slate-500">Sign in to view your badges.</p>
      </main>
    );
  }

  const earnedKeys = new Set(badges.map((b) => b.key));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-emerald-800">🏅 Badges</h1>
          <p className="text-sm text-slate-500">
            {badges.length} of {12} earned
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-emerald-700 underline">
          ← Back to app
        </Link>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading badges…</p>
      ) : (
        <div className="mt-6">
          <BadgeGrid earnedKeys={earnedKeys} />
        </div>
      )}

      {badges.length > 0 && (
        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-slate-800">Recently earned</h2>
          <div className="space-y-2">
            {badges.slice(0, 5).map((b) => (
              <div key={b.key} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{b.icon}</span>
                <div>
                  <p className="font-medium text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}