const DOT = {
  good: 'bg-moss shadow-[0_0_0_3px_rgba(95,168,119,0.18)]',
  warning: 'bg-amber shadow-[0_0_0_3px_rgba(204,150,64,0.18)]',
  critical: 'bg-crimson shadow-[0_0_0_3px_rgba(179,66,58,0.18)]',
  neutral: 'bg-ink/30 shadow-[0_0_0_3px_rgba(234,240,234,0.06)]',
}

export default function StatusCard({ label, value, hint, tone = 'neutral', icon }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-5 py-4 shadow-panel">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
        <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-display font-semibold leading-none">{value}</p>
        {icon && <span className="text-ink-dim">{icon}</span>}
      </div>
      {hint && <p className="text-xs text-ink-faint mt-2 font-mono">{hint}</p>}
    </div>
  )
}
