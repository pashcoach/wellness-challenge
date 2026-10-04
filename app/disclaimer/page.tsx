import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { ParticipantDisclaimerContent } from "@/components/ParticipantDisclaimer";

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <BrandMark size={42} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              FCL Wellness Challenge
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Participant disclaimer</h1>
          </div>
        </div>

        <div className="mt-6">
          <ParticipantDisclaimerContent />
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          ← Back to the challenge
        </Link>
      </article>
    </main>
  );
}
