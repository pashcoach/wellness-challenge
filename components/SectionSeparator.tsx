export default function SectionSeparator({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-slate-100" />
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        <span className="text-xs">{icon}</span>
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-slate-100 via-slate-200 to-transparent" />
    </div>
  );
}
