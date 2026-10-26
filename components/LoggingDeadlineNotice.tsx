import { LOGGING_CLOSE_AT } from "@/lib/logging-close";

/** Persistent, non-dismissible notice above the participant's logging controls. */
export default function LoggingDeadlineNotice() {
  return (
    <section
      aria-labelledby="logging-deadline-heading"
      className="mb-4 min-w-0 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-400 dark:bg-slate-900 dark:text-amber-100"
    >
      <h2 id="logging-deadline-heading" className="text-base font-bold">
        Final logging deadline: noon Friday
      </h2>
      <p className="mt-2 break-words text-sm leading-relaxed">
        Log all your activities and complete your final wellness check-in before{" "}
        <strong><time dateTime={LOGGING_CLOSE_AT}>12:00 PM (noon) on Friday, October 30, 2026</time></strong>
        {" "}— Saskatchewan time (America/Regina).
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        Activity logging and check-in submissions close at noon, not midnight. After noon, your existing entries will remain available to view but cannot be added, edited or deleted.
      </p>
    </section>
  );
}
