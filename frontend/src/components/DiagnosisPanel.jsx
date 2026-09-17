import SeverityGauge from './SeverityGauge.jsx'

const STATUS_PILL = {
  good: 'bg-moss/15 text-moss-bright border-moss/30',
  warning: 'bg-amber/15 text-amber-bright border-amber/30',
  critical: 'bg-crimson/15 text-crimson-bright border-crimson/30',
}

const STATUS_LABEL = {
  good: 'Plant healthy',
  warning: 'Needs attention',
  critical: 'Immediate action',
}

function Ring({ pct }) {
  const r = 26
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color = pct >= 90 ? '#7FC496' : pct >= 70 ? '#CC9640' : '#B3423A'
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#1B2620" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 700ms ease' }}
      />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        transform="rotate(90 32 32)"
        className="font-mono"
        fontSize="13"
        fill="#EAF0EA"
      >
        {Math.round(pct)}
      </text>
    </svg>
  )
}

export default function DiagnosisPanel({ result, onDispense, dispenseLabel = 'Dispense pesticide now' }) {
  if (!result) return null
  const pct = Math.round(result.confidence * 100)
  const pill = STATUS_PILL[result.status] || STATUS_PILL.warning
  const pillLabel = STATUS_LABEL[result.status] || 'Review recommended'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">{result.category}</p>
            <p className="text-xl font-display font-semibold leading-tight">{result.disease}</p>
            <p className="text-xs font-mono text-ink-dim mt-1">{pct}% confidence</p>
          </div>
        </div>
        <span className={`text-xs font-medium border rounded-full px-3 py-1 whitespace-nowrap ${pill}`}>
          {pillLabel}
        </span>
      </div>

      <SeverityGauge severity={result.severity} />

      <p className="text-sm text-ink-dim leading-relaxed">{result.description}</p>

      {result.symptoms?.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Symptoms observed</p>
          <ul className="space-y-1.5">
            {result.symptoms.map((s, i) => (
              <li key={i} className="text-sm text-ink/85 flex gap-2">
                <span className="text-rust mt-1.5 h-1 w-1 rounded-full bg-rust shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.remedy?.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Recommended action</p>
          <ul className="space-y-1.5">
            {result.remedy.map((s, i) => (
              <li key={i} className="text-sm text-ink/85 flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-moss shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.demo && (
        <p className="text-xs text-amber font-mono border-t border-border pt-3">
          Demo result — connect VITE_API_URL for live predictions.
        </p>
      )}

      {onDispense && result.class !== 'healthy' && (
        <button
          onClick={onDispense}
          className="w-full bg-rust hover:bg-rust-bright text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          {dispenseLabel}
        </button>
      )}
    </div>
  )
}
