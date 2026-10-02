"use client";

export default function RefreshAppButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="Refresh app"
      title="Refresh the app to see the latest updates"
      className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <span aria-hidden="true">↻</span>
      <span>Refresh</span>
    </button>
  );
}
