"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import {
  DAILY_ACTIVITY_LIMIT_MINUTES,
  auditReasons,
  auditRequestEmail,
  validateAdjustedMinutes,
} from "@/lib/activity-audit";

type AuditEntry = { id: string; activity: string; minutes: number; created_at: string };
type AuditReview = {
  decision: "approved" | "reduced";
  note: string | null;
  day_minutes: number;
  minutes_before: number | null;
  minutes_after: number | null;
  created_at: string;
};
type AuditDay = {
  user_id: string;
  participant_name: string;
  first_name: string;
  email: string | null;
  team_name: string | null;
  entry_date: string;
  day_minutes: number;
  entry_count: number;
  max_entry_minutes: number;
  entries: AuditEntry[];
  reviewed: boolean;
  last_review: AuditReview | null;
};

const fieldClass =
  "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function dayKey(day: AuditDay): string {
  return `${day.user_id}:${day.entry_date}`;
}

function reviewSummary(review: AuditReview): string {
  const when = new Date(review.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
  const action =
    review.decision === "approved"
      ? `Approved at ${review.day_minutes} min`
      : `Reduced an entry from ${review.minutes_before} to ${review.minutes_after} min (day now ${review.day_minutes} min)`;
  return `${action} · ${when}${review.note ? ` · “${review.note}”` : ""}`;
}

export default function ActivityAuditQueue() {
  const [days, setDays] = useState<AuditDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reductions, setReductions] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("admin_activity_audit_queue");
    setLoading(false);
    if (rpcError) {
      setError(friendlyError(rpcError));
      return;
    }
    setError(null);
    setDays((data ?? []) as AuditDay[]);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function approve(day: AuditDay) {
    if (!supabase) return;
    const key = dayKey(day);
    if (!window.confirm(`Approve ${day.day_minutes} minutes for ${day.participant_name} on ${formatDay(day.entry_date)} as accurate?`)) return;
    setBusy(key);
    const { error: rpcError } = await supabase.rpc("admin_mark_activity_day_reviewed", {
      p_user: day.user_id,
      p_date: day.entry_date,
      p_note: notes[key] ?? null,
    });
    setBusy(null);
    if (rpcError) {
      setRowErrors((prev) => ({ ...prev, [key]: friendlyError(rpcError) }));
      return;
    }
    setNotice(`Approved ${day.participant_name}'s ${formatDay(day.entry_date)} activity.`);
    setRowErrors((prev) => ({ ...prev, [key]: "" }));
    await load();
  }

  async function reduce(day: AuditDay, entry: AuditEntry) {
    if (!supabase) return;
    const key = dayKey(day);
    const next = Number(reductions[entry.id]);
    const problem = validateAdjustedMinutes(entry.minutes, next);
    if (problem) {
      setRowErrors((prev) => ({ ...prev, [key]: problem }));
      return;
    }
    if (!window.confirm(`Reduce ${day.participant_name}'s “${entry.activity}” entry from ${entry.minutes} to ${next} minutes? Their points will drop by ${entry.minutes - next}.`)) return;
    setBusy(entry.id);
    const { error: rpcError } = await supabase.rpc("admin_reduce_activity_entry", {
      p_entry: entry.id,
      p_minutes: next,
      p_note: notes[key] ?? null,
    });
    setBusy(null);
    if (rpcError) {
      setRowErrors((prev) => ({ ...prev, [key]: friendlyError(rpcError) }));
      return;
    }
    setNotice(`Reduced ${day.participant_name}'s “${entry.activity}” entry to ${next} minutes.`);
    setRowErrors((prev) => ({ ...prev, [key]: "" }));
    setReductions((prev) => ({ ...prev, [entry.id]: "" }));
    await load();
  }

  async function copyMessage(day: AuditDay) {
    const email = auditRequestEmail({ firstName: day.first_name, entryDate: day.entry_date, dayMinutes: day.day_minutes });
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
      setNotice("Message copied. Paste it into a new email to the participant.");
    } catch {
      setNotice("Couldn't copy automatically. Use Email participant instead.");
    }
  }

  const open = days.filter((day) => !day.reviewed);
  const reviewed = days.filter((day) => day.reviewed);

  function renderDay(day: AuditDay) {
    const key = dayKey(day);
    const email = auditRequestEmail({ firstName: day.first_name, entryDate: day.entry_date, dayMinutes: day.day_minutes });
    const mailto = day.email
      ? `mailto:${encodeURIComponent(day.email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
      : null;
    return (
      <li key={key} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{day.participant_name}</p>
            <p className="text-xs text-slate-500">
              {day.team_name ?? "Solo"} · {formatDay(day.entry_date)} · {day.entry_count} {day.entry_count === 1 ? "entry" : "entries"}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">{day.day_minutes} min</span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {auditReasons({ dayMinutes: day.day_minutes, maxEntryMinutes: day.max_entry_minutes }).map((reason) => (
            <li key={reason} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{reason}</li>
          ))}
        </ul>
        {day.last_review && <p className="mt-2 text-xs text-slate-500">Last review: {reviewSummary(day.last_review)}</p>}

        <ul className="mt-3 space-y-2">
          {day.entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 text-slate-800">
                {entry.activity} · <strong>{entry.minutes} min</strong>
              </span>
              <label className="sr-only" htmlFor={`reduce-${entry.id}`}>New minutes for {entry.activity}</label>
              <input
                id={`reduce-${entry.id}`}
                type="number"
                min={1}
                max={entry.minutes - 1}
                inputMode="numeric"
                placeholder="New min"
                value={reductions[entry.id] ?? ""}
                onChange={(e) => setReductions((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                className={`${fieldClass} w-24`}
              />
              <button
                type="button"
                onClick={() => void reduce(day, entry)}
                disabled={busy !== null || !reductions[entry.id]}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {busy === entry.id ? "Saving…" : "Reduce"}
              </button>
            </li>
          ))}
        </ul>

        <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`note-${key}`}>Private review note (optional)</label>
        <input
          id={`note-${key}`}
          maxLength={500}
          value={notes[key] ?? ""}
          onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder="e.g. Confirmed a 3-hour hike by email"
          className={`${fieldClass} mt-1 w-full`}
        />

        {rowErrors[key] && <p role="alert" className="mt-2 text-sm text-red-700">{rowErrors[key]}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {!day.reviewed && (
            <button
              type="button"
              onClick={() => void approve(day)}
              disabled={busy !== null}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === key ? "Saving…" : "Approve as accurate"}
            </button>
          )}
          {mailto && (
            <a href={mailto} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              Email participant
            </a>
          )}
          <button
            type="button"
            onClick={() => void copyMessage(day)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Copy message
          </button>
        </div>
      </li>
    );
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">🔍 Activity audit queue</h2>
          <p className="mt-1 text-xs text-slate-500">
            Days over {DAILY_ACTIVITY_LIMIT_MINUTES} minutes or with a single entry over 180 minutes. Approve, reduce an entry, or contact the participant privately. Email participant opens a draft in your mail app; nothing is sent automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{open.length} to review</span>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Refresh
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading audit queue…</p>
      ) : open.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nothing to review right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">{open.map(renderDay)}</ul>
      )}

      {reviewed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-emerald-700">Reviewed ({reviewed.length})</summary>
          <ul className="mt-3 space-y-3">{reviewed.map(renderDay)}</ul>
        </details>
      )}
    </section>
  );
}
