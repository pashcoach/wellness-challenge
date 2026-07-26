"use client";

import { useEffect } from "react";

export default function Toast({
  message,
  sub,
  onDone,
}: {
  message: string;
  sub?: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="toast-pop fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg">
          ✅
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-emerald-800">{message}</p>
          {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
