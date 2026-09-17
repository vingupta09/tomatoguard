const LEVELS = ['none', 'low', 'medium', 'high']

const CONFIG = {
  none: { step: 1, color: 'bg-moss', text: 'text-moss', label: 'Healthy' },
  low: { step: 2, color: 'bg-amber', text: 'text-amber', label: 'Low' },
  medium: { step: 3, color: 'bg-rust', text: 'text-rust', label: 'Medium' },
  high: { step: 4, color: 'bg-crimson', text: 'text-crimson', label: 'High' },
}

export default function SeverityGauge({ severity }) {
  const c = CONFIG[severity] || { step: 0, color: 'bg-ink/15', text: 'text-ink-faint', label: 'Unknown' }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-ink-faint">Severity</span>
        <span className={`text-sm font-mono font-medium ${c.text}`}>{c.label}</span>
      </div>
      <div className="flex gap-1">
        {LEVELS.map((lvl, i) => (
          <div key={lvl} className="h-2 flex-1 rounded-sm bg-surface-raised overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${i < c.step ? c.color : 'bg-transparent'}`}
              style={{ width: i < c.step ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
