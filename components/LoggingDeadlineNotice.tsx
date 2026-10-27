import { LOGGING_CLOSE_AT } from "@/lib/logging-close";

/** Persistent, non-dismissible notice above the participant's logging controls. */
export default function LoggingDeadlineNotice() {
  return (
    <section
      aria-labelledby="logging-deadline-heading"
      className="mb-4 min-w-0 rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-4 text-slate-800 shadow-sm"
    >
      <h2 id="logging-deadline-heading" className="text-base font-bold">
        Deadline correction: Friday, October 30 at noon
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        The October 26 email listed an incorrect closing time. The correct deadline is noon on Friday, October 30—not midnight. Sorry for the confusion!
      </p>
      <p className="mt-2 break-words text-sm leading-relaxed">
        Log all your activities and complete your final wellness check-in before{" "}
        <strong><time dateTime={LOGGING_CLOSE_AT}>12:00 PM (noon) on Friday, October 30, 2026</time></strong>
        {" "}— Saskatchewan time (America/Regina).
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        After the deadline, you can still view your entries, but you won’t be able to add, edit or delete them.
      </p>
    </section>
  );
}
