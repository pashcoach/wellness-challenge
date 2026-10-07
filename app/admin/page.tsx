"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import { friendlyError } from "@/lib/errors";
import { summarizeActivitiesByType } from "@/lib/admin-analytics";
import Link from "next/link";
import ActivityAuditQueue from "@/components/ActivityAuditQueue";
import { excludeFromStandings } from "@/lib/organizer-exclusion";
import { suggestSupportReply, validateSupportReply, SUPPORT_REPLY_MAX, type SupportReply } from "@/lib/support-replies";
import { supportMessagesForView, type SupportInboxView } from "@/lib/support-inbox";

interface Row {
  profiles: {
    id: string; full_name: string; business_unit: string;
    located_at_crc: boolean; age_range: string; team_id: string | null;
    exclude_from_standings?: boolean | null;
  }[];
  teams: { id: string; name: string }[];
  activities: { user_id: string; activity: string; minutes: number; points: number; entry_date: string; week: number }[];
  checkins: { user_id: string; week: number; pillar: string; points: number; comment: string | null }[];
  surveys: {
    id: string;
    user_id: string;
    feedback: string;
    category: "feedback" | "help" | "problem" | "idea";
    status: "new" | "in_progress" | "resolved";
    created_at: string;
    resolution_email_sent_at: string | null;
  }[];
}

type SupportStatus = Row["surveys"][number]["status"];

interface DrawRecord {
  id: string;
  draw_key: string;
  drawn_at: string;
  winner_name: string | null;
  winner_business_unit: string | null;
  team_name: string | null;
}

function toCsv(rows: (string | number | boolean | null)[][]): string {
  return rows
    .map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function AdminPage() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawResult, setDrawResult] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>([]);
  const [confirmDraw, setConfirmDraw] = useState<{ key: string; label: string } | null>(null);
  const [drawBusy, setDrawBusy] = useState(false);
  const [supportBusy, setSupportBusy] = useState<string | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [replySent, setReplySent] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportView, setSupportView] = useState<SupportInboxView>("active");

  const isAdmin = profile?.is_admin === true;

  const load = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const [profiles, teams, activities, checkins, surveys, draws] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("teams").select("id, name"),
      supabase.from("activity_entries").select("user_id, activity, minutes, points, entry_date, week"),
      supabase.from("wellness_checkins").select("user_id, week, pillar, points, comment"),
      supabase.from("survey_responses").select("id, user_id, feedback, category, status, created_at, resolution_email_sent_at").order("created_at", { ascending: false }),
      supabase.from("draw_results_view").select("*").order("drawn_at"),
    ]);
    const replyResult = await supabase
      .from("support_replies")
      .select("id, request_id, body, created_at, email_sent_at")
      .order("created_at");
    setReplies((replyResult.data ?? []) as SupportReply[]);
    // Organizer accounts flagged out of standings are left out of every stat.
    const allProfiles = (profiles.data ?? []) as Row["profiles"];
    const counted = excludeFromStandings(allProfiles);
    const countedIds = new Set(counted.map((p) => p.id));
    setData({
      profiles: counted,
      teams: (teams.data ?? []) as Row["teams"],
      activities: ((activities.data ?? []) as Row["activities"]).filter((a) => countedIds.has(a.user_id)),
      checkins: ((checkins.data ?? []) as Row["checkins"]).filter((c) => countedIds.has(c.user_id)),
      surveys: (surveys.data ?? []) as Row["surveys"],
    });
    setDrawHistory((draws.data ?? []) as DrawRecord[]);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const pointsByUser = new Map<string, number>();
    for (const a of data.activities) pointsByUser.set(a.user_id, (pointsByUser.get(a.user_id) ?? 0) + a.points);
    for (const c of data.checkins) pointsByUser.set(c.user_id, (pointsByUser.get(c.user_id) ?? 0) + c.points);

    const active = data.profiles.filter((p) => (pointsByUser.get(p.id) ?? 0) > 0);
    const totalMinutes = data.activities.reduce((s, a) => s + a.minutes, 0);

    const byBu = new Map<string, number>();
    for (const p of active) byBu.set(p.business_unit, (byBu.get(p.business_unit) ?? 0) + 1);

    const byDate = new Map<string, Set<string>>();
    for (const a of data.activities) {
      const s = byDate.get(a.entry_date) ?? new Set<string>();
      s.add(a.user_id);
      byDate.set(a.entry_date, s);
    }

    const teamNames = new Map(data.teams.map((t) => [t.id, t.name]));
    const byTeam = new Map<string, number[]>();
    for (const p of data.profiles) {
      if (!p.team_id) continue;
      const arr = byTeam.get(p.team_id) ?? [];
      arr.push(pointsByUser.get(p.id) ?? 0);
      byTeam.set(p.team_id, arr);
    }
    const teamStandings = [...byTeam.entries()]
      .map(([id, pts]) => ({
        id,
        name: teamNames.get(id) ?? "Team",
        members: pts.length,
        avg: Math.round(pts.reduce((s, v) => s + v, 0) / pts.length),
      }))
      .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const crcYes = active.filter((p) => p.located_at_crc).length;

    // ---- Weekly breakdown ----
    const weekLabels = ["Week 1 · Physical", "Week 2 · Psychological", "Week 3 · Financial", "Week 4 · Social"];
    const byWeek: {
      week: number;
      label: string;
      active: number;
      totalPoints: number;
      totalMinutes: number;
      checkinCount: number;
      checkinRate: number;
    }[] = [];
    for (let w = 1; w <= 4; w++) {
      const weekUsers = new Set<string>();
      for (const a of data.activities) if (a.week === w) weekUsers.add(a.user_id);
      for (const c of data.checkins) if (c.week === w) weekUsers.add(c.user_id);
      const weekPts =
        data.activities.filter((a) => a.week === w).reduce((s, a) => s + a.points, 0) +
        data.checkins.filter((c) => c.week === w).reduce((s, c) => s + c.points, 0);
      const weekMin = data.activities.filter((a) => a.week === w).reduce((s, a) => s + a.minutes, 0);
      const checkinCount = data.checkins.filter((c) => c.week === w).length;
      const checkinRate = weekUsers.size > 0 ? Math.round((checkinCount / weekUsers.size) * 100) : 0;
      byWeek.push({
        week: w,
        label: weekLabels[w - 1],
        active: weekUsers.size,
        totalPoints: weekPts,
        totalMinutes: weekMin,
        checkinCount,
        checkinRate,
      });
    }

    // ---- Activity engagement ----
    const topActivities = summarizeActivitiesByType(data.activities);

    // ---- Demographics ----
    const byAgeRange = new Map<string, number>();
    for (const p of active) byAgeRange.set(p.age_range, (byAgeRange.get(p.age_range) ?? 0) + 1);

    // ---- Team vs solo ----
    const teamUsers = new Set(data.profiles.filter((p) => p.team_id).map((p) => p.id));
    const activeOnTeam = active.filter((p) => teamUsers.has(p.id)).length;
    const activeSolo = active.length - activeOnTeam;

    return { pointsByUser, active, totalMinutes, byBu, byDate, teamStandings, crcYes, byWeek, topActivities, byAgeRange, activeOnTeam, activeSolo };
  }, [data]);

  if (authLoading || profileLoading) return <main className="p-8 text-slate-500">Loading…</main>;
  if (!session || !isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold">Admins only</p>
          <p className="mt-1 text-sm text-slate-500">Your account doesn&apos;t have admin access.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 underline">← Back to the app</Link>
        </div>
      </main>
    );
  }
  if (loading || !data || !stats) return <main className="p-8 text-slate-500">Loading stats…</main>;

  const activeSupportCount = data.surveys.filter((message) => message.status !== "resolved").length;
  const archivedSupportCount = data.surveys.filter((message) => message.status === "resolved").length;
  const visibleSupportMessages = supportMessagesForView(data.surveys, supportView);

  function downloadCsv() {
    if (!data || !stats) return;
    const rows: (string | number | boolean | null)[][] = [
      ["name", "business_unit", "located_at_crc", "age_range", "team", "activity_entries", "activity_minutes", "activity_points", "wellness_checkins", "wellness_points", "total_points"],
    ];
    const teamNames = new Map(data.teams.map((t) => [t.id, t.name]));
    for (const p of data.profiles) {
      const acts = data.activities.filter((a) => a.user_id === p.id);
      const chks = data.checkins.filter((c) => c.user_id === p.id);
      rows.push([
        p.full_name,
        p.business_unit,
        p.located_at_crc ? "yes" : "no",
        p.age_range,
        p.team_id ? teamNames.get(p.team_id) ?? "" : "",
        acts.length,
        acts.reduce((s, a) => s + a.minutes, 0),
        acts.reduce((s, a) => s + a.points, 0),
        chks.length,
        chks.reduce((s, c) => s + c.points, 0),
        stats.pointsByUser.get(p.id) ?? 0,
      ]);
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wellness_challenge_2026_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function updateSupportStatus(id: string, status: SupportStatus) {
    if (!supabase) return;
    setSupportBusy(id);
    setSupportError(null);
    const changedAt = new Date().toISOString();
    const result = await supabase
      .from("survey_responses")
      .update({ status, updated_at: changedAt })
      .eq("id", id);
    setSupportBusy(null);
    if (result.error) {
      setSupportError(friendlyError(result.error));
      return;
    }
    setData((current) => current ? {
      ...current,
      surveys: current.surveys.map((message) => message.id === id ? {
        ...message,
        status,
        resolution_email_sent_at: message.resolution_email_sent_at,
      } : message),
    } : current);
  }

  async function resolveSupportRequest(id: string, sendEmail: boolean) {
    if (!supabase) return;
    setSupportBusy(id);
    setSupportError(null);
    const changedAt = new Date().toISOString();
    const result = sendEmail
      ? await supabase.functions.invoke("resolve-support-request", { body: { requestId: id } })
      : await supabase
          .from("survey_responses")
          .update({ status: "resolved", updated_at: changedAt })
          .eq("id", id);
    setSupportBusy(null);
    if (result.error) {
      setSupportError(friendlyError(result.error));
      return;
    }
    setData((current) => current ? {
      ...current,
      surveys: current.surveys.map((message) => message.id === id ? {
        ...message,
        status: "resolved",
        resolution_email_sent_at: sendEmail ? changedAt : message.resolution_email_sent_at,
      } : message),
    } : current);
  }

  /** Sends a typed app-team reply (emailed to the participant and saved to the request). */
  async function sendSupportReply(id: string, messageText: string, markResolved: boolean) {
    if (!supabase) return;
    const checked = validateSupportReply(messageText);
    if (!checked.ok) {
      setReplyErrors((current) => ({ ...current, [id]: checked.error }));
      return;
    }
    setReplyBusy(id);
    setReplySent(null);
    setReplyErrors((current) => ({ ...current, [id]: "" }));
    const { data: result, error } = await supabase.functions.invoke("reply-support-request", {
      body: { requestId: id, message: checked.text, markResolved },
    });
    setReplyBusy(null);
    if (error || !result?.replyId) {
      let messageText = "The reply could not be sent. Please try again.";
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (typeof body?.error === "string") messageText = body.error;
      } catch {
        // keep the generic message
      }
      setReplyErrors((current) => ({ ...current, [id]: messageText }));
      return;
    }
    setReplies((current) => [
      ...current,
      { id: result.replyId, request_id: id, body: checked.text, created_at: result.createdAt, email_sent_at: result.emailSentAt },
    ]);
    setReplyDrafts((current) => ({ ...current, [id]: "" }));
    setReplySent(id);
    setData((current) => current ? {
      ...current,
      surveys: current.surveys.map((message) => message.id === id ? {
        ...message,
        status: result.status ?? message.status,
        resolution_email_sent_at: markResolved ? result.emailSentAt : message.resolution_email_sent_at,
      } : message),
    } : current);
  }

  /** Runs a rule-enforcing draw via SQL function. Draws are one-shot & permanent. */
  async function runDraw(key: string, label: string) {
    if (!supabase) return;
    setDrawBusy(true);
    setDrawError(null);
    setDrawResult(null);
    let result;
    if (key === "grand") {
      result = await supabase.rpc("run_grand_prize_draw");
    } else if (key === "team_random") {
      result = await supabase.rpc("run_random_team_draw");
    } else {
      const week = parseInt(key.replace("week", ""), 10);
      result = await supabase.rpc("run_weekly_draw", { p_week: week });
    }
    setDrawBusy(false);
    if (result.error) {
      setDrawError(friendlyError(result.error));
      return;
    }
    const rows = (result.data ?? []) as { winner_name?: string; winner_business_unit?: string; team_name?: string }[];
    if (rows.length === 0) {
      setDrawError("Draw ran but no winners were returned.");
      return;
    }
    const detail = rows
      .map((r) => r.team_name ? `🏆 ${r.team_name}` : `🎉 ${r.winner_name} (${r.winner_business_unit ?? "—"})`)
      .join("\n");
    setDrawResult(`${label} — Congratulations!\n${detail}`);
    setConfirmDraw(null);
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold text-emerald-800">Admin Dashboard</h1>
        <Link href="/" className="text-sm font-medium text-emerald-700 underline">← Back to app</Link>
      </header>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Registered", value: data.profiles.length },
          { label: "Active participants", value: stats.active.length },
          { label: "At CRC", value: stats.crcYes },
          { label: "Total activity minutes", value: stats.totalMinutes.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-800">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Entries per day */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">Participants logging per day</h2>
        {stats.byDate.size === 0 ? (
          <p className="text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {[...stats.byDate.entries()].sort().map(([date, users]) => {
              const max = Math.max(...[...stats.byDate.values()].map((s) => s.size));
              return (
                <div key={date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-emerald-500"
                    style={{ height: `${(users.size / max) * 100}%`, minHeight: 4 }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100">
                    {date.slice(5)}: {users.size}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* BU breakdown */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Active by business unit</h2>
          <ul className="space-y-1 text-sm">
            {[...stats.byBu.entries()].sort((a, b) => b[1] - a[1]).map(([bu, n]) => (
              <li key={bu} className="flex justify-between">
                <span>{bu}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Team standings */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Team standings (avg per member)</h2>
          <ol className="space-y-1 text-sm">
            {stats.teamStandings.map((t, i) => (
              <li key={t.id} className="flex justify-between">
                <span>{i + 1}. {t.name} <span className="text-slate-400">({t.members})</span></span>
                <span className="font-semibold">{t.avg.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ActivityAuditQueue />

      {/* Support inbox */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">💬 Support inbox</h2>
            <p className="mt-1 text-xs text-slate-500">Private participant questions, problem reports, and ideas.</p>
            <p className="mt-1 text-xs text-slate-500">
              Resolved messages move to Archived. Resolve &amp; archive sends no email; use Resolve &amp; send email only when the participant still needs a resolution notice.
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            {data.surveys.filter((message) => message.status === "new").length} new
          </span>
        </div>

        {supportError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{supportError}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Support inbox view">
          <button
            type="button"
            aria-pressed={supportView === "active"}
            onClick={() => setSupportView("active")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-300 ${supportView === "active" ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Active ({activeSupportCount})
          </button>
          <button
            type="button"
            aria-pressed={supportView === "archived"}
            onClick={() => setSupportView("archived")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-300 ${supportView === "archived" ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            Archived ({archivedSupportCount})
          </button>
        </div>

        {visibleSupportMessages.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {supportView === "active" ? "No active support messages." : "No archived support messages."}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {visibleSupportMessages.map((message) => {
              const participant = data.profiles.find((person) => person.id === message.user_id);
              const categoryLabel = {
                feedback: "Feedback",
                help: "Need help",
                problem: "Problem",
                idea: "Idea",
              }[message.category];
              const hasReplies = replies.some((reply) => reply.request_id === message.id);
              const suggestedDraft = message.status !== "resolved" && !hasReplies
                ? suggestSupportReply({
                    fullName: participant?.full_name,
                    category: message.category,
                    feedback: message.feedback,
                  })
                : "";
              const replyValue = replyDrafts[message.id] ?? suggestedDraft;
              return (
                <article key={message.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{participant?.full_name ?? "Participant"}</p>
                      <p className="text-xs text-slate-500">
                        {participant?.business_unit ?? "Business unit unavailable"} · {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      {categoryLabel}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{message.feedback}</p>
                  {message.status !== "resolved" ? (
                    <>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        Status
                        <select
                          value={message.status}
                          disabled={supportBusy === message.id}
                          onChange={(event) => updateSupportStatus(message.id, event.target.value as SupportStatus)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50"
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In progress</option>
                        </select>
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void resolveSupportRequest(message.id, false)}
                          disabled={supportBusy === message.id}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
                        >
                          Resolve &amp; archive
                        </button>
                        <button
                          type="button"
                          onClick={() => void resolveSupportRequest(message.id, true)}
                          disabled={supportBusy === message.id}
                          className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
                        >
                          Resolve &amp; send email
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-slate-600">
                      {message.resolution_email_sent_at ? "✓ Archived · resolution email sent" : "✓ Archived · no resolution email sent"}
                    </p>
                  )}

                  {replies.filter((r) => r.request_id === message.id).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {replies.filter((r) => r.request_id === message.id).map((r) => (
                        <div key={r.id} className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2">
                          <p className="text-xs font-semibold text-emerald-800">
                            App team reply · {new Date(r.created_at).toLocaleString()}
                            {r.email_sent_at ? " · ✓ Reply emailed" : ""}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.status !== "resolved" && <div className="mt-3 border-t border-slate-100 pt-3">
                    <label htmlFor={`reply-${message.id}`} className="block text-xs font-semibold text-slate-700">
                      Reply to participant
                    </label>
                    <p id={`reply-hint-${message.id}`} className="mt-0.5 text-xs text-slate-500">
                      {suggestedDraft
                        ? "Suggested draft — review and edit before sending. Nothing is sent until you select a send button."
                        : "Your reply is emailed to the participant and shown in their My support requests."}
                    </p>
                    <textarea
                      id={`reply-${message.id}`}
                      value={replyValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        setReplyDrafts((current) => ({ ...current, [message.id]: value }));
                        if (replySent === message.id) setReplySent(null);
                      }}
                      rows={3}
                      maxLength={SUPPORT_REPLY_MAX}
                      disabled={replyBusy === message.id}
                      aria-describedby={`reply-hint-${message.id}${replyErrors[message.id] ? ` reply-error-${message.id}` : ""}`}
                      aria-invalid={replyErrors[message.id] ? true : undefined}
                      placeholder="Type your reply…"
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
                    />
                    {replyErrors[message.id] && (
                      <p id={`reply-error-${message.id}`} role="alert" className="mt-1 text-sm text-red-600">
                        {replyErrors[message.id]}
                      </p>
                    )}
                    {replySent === message.id && (
                      <p role="status" className="mt-1 text-sm font-medium text-emerald-700">✓ Reply sent to the participant.</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void sendSupportReply(message.id, replyValue, false)}
                        disabled={replyBusy === message.id || !replyValue.trim()}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {replyBusy === message.id ? "Sending…" : "Send reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendSupportReply(message.id, replyValue, true)}
                        disabled={replyBusy === message.id || !replyValue.trim()}
                        className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Send reply &amp; resolve
                      </button>
                    </div>
                  </div>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Prize draws */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold">🎁 Prize draws</h2>
        <p className="mb-3 text-xs text-slate-500">
          Draws enforce the rules: weekly = 2 winners with 140+ pts and 1+ logged wellness activity that week, no repeat winners; grand = 140+ pts and 1+ logged wellness activity in each week and excludes weekly winners; random team = activity-eligible teams, excluding the top team. Organizer accounts are excluded from all prize draws.
          <strong> Each draw runs once and is permanent.</strong> Review winners, then add them to the email sequence doc.
        </p>

        {/* Draw buttons */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((w) => {
            const done = drawHistory.some((d) => d.draw_key === `week${w}`);
            return (
              <button
                key={w}
                disabled={done || drawBusy}
                onClick={() => setConfirmDraw({ key: `week${w}`, label: `Week ${w} draw (2 winners, 140+ pts and a logged wellness activity)` })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  done
                    ? "border-slate-200 bg-slate-100 text-slate-400"
                    : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                } disabled:opacity-60`}
              >
                {done ? "✓ Week " + w + " drawn" : "Run Week " + w + " draw"}
              </button>
            );
          })}
          <button
            disabled={drawHistory.some((d) => d.draw_key === "grand") || drawBusy}
            onClick={() => setConfirmDraw({ key: "grand", label: "Grand prize draw (2 winners, 140+ pts and a logged wellness activity every week)" })}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              drawHistory.some((d) => d.draw_key === "grand")
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100"
            } disabled:opacity-60`}
          >
            {drawHistory.some((d) => d.draw_key === "grand") ? "✓ Grand drawn" : "Run grand prize draw"}
          </button>
          <button
            disabled={drawHistory.some((d) => d.draw_key === "team_random") || drawBusy}
            onClick={() => setConfirmDraw({ key: "team_random", label: "Random team lunch draw (top team excluded)" })}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              drawHistory.some((d) => d.draw_key === "team_random")
                ? "border-slate-200 bg-slate-100 text-slate-400"
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            } disabled:opacity-60`}
          >
            {drawHistory.some((d) => d.draw_key === "team_random") ? "✓ Random team drawn" : "Run random team draw"}
          </button>
        </div>

        {/* Top team — highest total points */}
        {stats.teamStandings.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            🏆 Top team (lunch): <strong>{stats.teamStandings[0].name}</strong> — {stats.teamStandings[0].avg.toLocaleString()} avg pts
          </p>
        )}

        {drawError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{drawError}</p>}
        {drawResult && (
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{drawResult}</pre>
        )}

        {/* Draw history */}
        {drawHistory.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Completed draws</h3>
            <ul className="space-y-1 text-sm">
              {drawHistory.map((d) => (
                <li key={d.id} className="flex justify-between text-slate-600">
                  <span className="font-medium capitalize">
                    {d.draw_key.replace("_", " ")}
                  </span>
                  <span>{d.team_name ?? `${d.winner_name} · ${d.winner_business_unit ?? ""}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Draw confirmation modal */}
      {confirmDraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="font-bold text-slate-800">Run this draw?</h3>
            <p className="mt-1 text-sm text-slate-600">{confirmDraw.label}</p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ This is permanent — the winners are recorded and cannot be re-drawn. Only run it once you&apos;re ready.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmDraw(null)}
                className="rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={drawBusy}
                onClick={() => runDraw(confirmDraw.key, confirmDraw.label)}
                className="rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {drawBusy ? "Drawing…" : "Run draw"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Committee Report ─────────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-emerald-800">📋 Committee Report</h2>
        <p className="mt-1 text-xs text-slate-500">Weekly breakdown and key trends for the wellness committee.</p>
      </div>

      {/* Weekly comparison table */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-bold">Weekly trends</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-medium">Week</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 font-medium">Total pts</th>
                <th className="pb-2 font-medium">Total min</th>
                <th className="pb-2 font-medium">Check-ins</th>
                <th className="pb-2 font-medium">Check-in rate</th>
              </tr>
            </thead>
            <tbody>
              {stats.byWeek.map((w, i) => {
                const prev = i > 0 ? stats.byWeek[i - 1] : null;
                const trend = (cur: number, prevVal: number | undefined) => {
                  if (prevVal === undefined || prevVal === 0) return null;
                  const diff = cur - prevVal;
                  if (Math.abs(diff) < 0.5) return <span className="text-slate-400">→</span>;
                  return diff > 0
                    ? <span className="text-emerald-600">↑{Math.round((diff / prevVal) * 100)}%</span>
                    : <span className="text-red-500">↓{Math.round(Math.abs(diff / prevVal) * 100)}%</span>;
                };
                return (
                  <tr key={w.week} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{w.label}</td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.active}</span>
                      {prev && <span className="ml-1.5">{trend(w.active, prev.active)}</span>}
                    </td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.totalPoints.toLocaleString()}</span>
                      {prev && <span className="ml-1.5">{trend(w.totalPoints, prev.totalPoints)}</span>}
                    </td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.totalMinutes.toLocaleString()}</span>
                      {prev && <span className="ml-1.5">{trend(w.totalMinutes, prev.totalMinutes)}</span>}
                    </td>
                    <td className="py-2.5">{w.checkinCount}</td>
                    <td className="py-2.5">
                      <span className="font-semibold">{w.checkinRate}%</span>
                      {prev && <span className="ml-1.5">{trend(w.checkinRate, prev.checkinRate)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Top activities */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Top activities</h3>
          {stats.topActivities.length === 0 ? (
            <p className="text-sm text-slate-500">No activities logged yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {stats.topActivities.map((activity, i) => (
                <li key={activity.activity} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-800">{i + 1}. {activity.activity}</span>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {activity.percentOfTime}% of time
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-bold text-slate-800">{activity.entries.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">Entries</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{activity.totalMinutes.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">Total minutes</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{activity.averageMinutes.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">Avg minutes</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Demographics: age range */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Active by age range</h3>
          {stats.byAgeRange.size === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...stats.byAgeRange.entries()].sort((a, b) => b[1] - a[1]).map(([range, n]) => (
                <li key={range} className="flex justify-between">
                  <span>{range}</span>
                  <span className="font-semibold text-slate-500">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Team vs solo */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Teams vs solo</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Registered on a team</span>
              <span className="font-semibold">{data.profiles.filter((p) => p.team_id).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Active on a team</span>
              <span className="font-semibold text-emerald-700">{stats.activeOnTeam}</span>
            </div>
            <div className="flex justify-between">
              <span>Active solo</span>
              <span className="font-semibold">{stats.activeSolo}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="font-medium">Team engagement rate</span>
              <span className="font-semibold text-emerald-700">
                {stats.activeOnTeam > 0
                  ? `${Math.round((stats.activeOnTeam / (stats.activeOnTeam + stats.activeSolo)) * 100)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar check-in completion */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold">Wellness pillar check-ins</h3>
          {stats.byWeek.length === 0 ? (
            <p className="text-sm text-slate-500">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.byWeek.map((w) => (
                <li key={w.week}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{w.label}</span>
                    <span className="text-slate-500">{w.checkinCount} check-ins</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${w.checkinRate}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {w.active === 0 ? "No participants" : `${w.checkinCount} of ${w.active} participants (${w.checkinRate}%)`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-bold">📊 Export for the report</h2>
        <p className="mb-3 text-sm text-slate-600">
          One CSV with every participant: business unit, CRC location, team, activity minutes/points, check-ins, and totals — ready to build the summary report from.
        </p>
        <button
          onClick={downloadCsv}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Download CSV export
        </button>
      </div>
    </main>
  );
}
