"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import type { Profile } from "@/lib/data";
import Toast from "./Toast";

const FAQS = [
  {
    question: "How do I log activity?",
    answer: "Starting October 5, open the current week, choose your activity, enter the minutes and date, then tap Log activity.",
  },
  {
    question: "How are points calculated?",
    answer: "Activity earns 10 points per 10 minutes, so one activity minute equals one point. Each weekly wellness check-in earns 20 points.",
  },
  {
    question: "How do teams work?",
    answer: "If you are not on a team, choose Join a team and pick a team from the list. No invite code is needed. You can also create your own team and invite coworkers to pick it from the list. Team standings use average points per member, so larger teams do not have an automatic advantage.",
  },
  {
    question: "How do I leave, switch, or delete a team?",
    answer: "Before your first entry in the app, open Your team and use Team options. An entry is made when you log a wellness activity or complete the Weekly Wellness section by checking “I supported my … this week” and selecting “Confirm check-in.” Choose Leave team to participate solo; you can then create or join another team. A team creator can delete the team only when they are its sole member. If the creator leaves while members remain, ownership transfers automatically. After your first entry, team changes are locked. Leave a message below for the app team to assist with this correction.",
  },
  {
    question: "Why is activity logging locked?",
    answer: "The challenge runs October 5–30. Activity logging opens October 5, and future dates or dates outside the challenge cannot be submitted.",
  },
  {
    question: "How do I reset my password?",
    answer: "Sign out, choose Forgot password on the sign-in screen, and follow the link sent to your email address.",
  },
  {
    question: "How do I get the latest app update?",
    answer: "Tap Refresh in the signed-in header. Your account and saved entries will remain in place.",
  },
] as const;

const CATEGORIES = [
  { value: "help", label: "Need help" },
  { value: "problem", label: "Report a problem" },
  { value: "idea", label: "Share an idea" },
] as const;

type SupportCategory = (typeof CATEGORIES)[number]["value"];
type SupportStatus = "new" | "in_progress" | "resolved";
type SupportRequest = {
  id: string;
  feedback: string;
  category: SupportCategory;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<SupportStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

const STATUS_STYLES: Record<SupportStatus, string> = {
  new: "bg-amber-50 text-amber-800",
  in_progress: "bg-sky-50 text-sky-800",
  resolved: "bg-emerald-50 text-emerald-800",
};

export default function FeedbackButton({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SupportCategory>("help");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  async function loadRequests() {
    if (!supabase) return;
    setRequestsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, feedback, category, status, created_at, updated_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setRequestsLoading(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setRequests((data ?? []) as SupportRequest[]);
  }

  function openHelp() {
    setOpen(true);
    void loadRequests();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !message.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("survey_responses").insert({
      user_id: profile.id,
      category,
      feedback: message.trim(),
      status: "new",
    });
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    setOpen(false);
    setMessage("");
    setCategory("help");
    setToast(true);
  }

  return (
    <>
      {toast && (
        <Toast
          message="Message sent! 🙏"
          sub="Patrick and the app team will review it."
          onDone={() => setToast(false)}
        />
      )}

      <button
        type="button"
        onClick={openHelp}
        aria-label="Need help?"
        className="fixed bottom-4 right-4 z-40 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
      >
        💬 Need help?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Need help?</h3>
                <p className="mt-1 text-sm text-slate-500">Find a quick answer or send the app team a message.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <section className="mt-4">
              <h4 className="text-sm font-bold text-emerald-800">Quick answers</h4>
              <div className="mt-2 space-y-2">
                {FAQS.map((faq) => (
                  <details key={faq.question} className="rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="min-h-11 cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800">
                      {faq.question}
                    </summary>
                    <p className="border-t border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">My support requests</h4>
                  <p className="mt-1 text-xs text-slate-500">Only you and the app administrators can see these messages.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  disabled={requestsLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {requestsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {requestsLoading && requests.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Loading your requests…</p>
              ) : requests.length === 0 ? (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">You have not sent any support requests yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {requests.map((request) => (
                    <article key={request.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {new Date(request.created_at).toLocaleString()}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[request.status]}`}>
                          {STATUS_LABELS[request.status]}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-700">{request.feedback}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-5 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold text-slate-800">Still need help?</h4>
              <p className="mt-1 text-xs text-slate-500">Your message goes to the private administrator support inbox.</p>

              <fieldset className="mt-3">
                <legend className="text-xs font-semibold text-slate-700">What is this about?</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((item) => (
                    <label
                      key={item.value}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                        category === item.value
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-slate-300 text-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={item.value}
                        checked={category === item.value}
                        onChange={() => setCategory(item.value)}
                        className="sr-only"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor="support-message" className="mt-3 block text-xs font-semibold text-slate-700">
                Message
              </label>
              <textarea
                id="support-message"
                required
                rows={4}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you need help with and what happened…"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">{message.length}/2000</p>
            </section>

            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !message.trim()}
                className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
