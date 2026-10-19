import { CHALLENGE_CLOSED_MESSAGE } from "@/lib/logging-close";

export default function ChallengeClosed() {
  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
      <p className="font-semibold">{CHALLENGE_CLOSED_MESSAGE}</p>
    </div>
  );
}
