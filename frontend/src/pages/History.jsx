import { useEffect, useState } from 'react'
import client from '../api/client.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'
import { DEMO_HISTORY } from '../data/demo.js'

const CLASS_COLOR = { healthy: '#5FA877', non_fungal: '#CC9640', fungal: '#B3423A' }
const SEVERITY_PILL = {
  none: 'bg-moss/15 text-moss-bright',
  low: 'bg-amber/15 text-amber-bright',
  medium: 'bg-rust/15 text-rust-bright',
  high: 'bg-crimson/15 text-crimson-bright',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-raised border border-border rounded-lg px-3 py-2 text-xs">
      <p className="capitalize text-ink mb-0.5">{label}</p>
      <p className="font-mono text-ink-dim">{payload[0].value} detections</p>
    </div>
  )
}

export default function History() {
  const [records, setRecords] = useState([])

  useEffect(() => {
    client
      .get('/api/history')
      .then(({ data }) => setRecords(data))
      .catch(() => setRecords(DEMO_HISTORY))
  }, [])

  const counts = ['healthy', 'bacterial', 'fungal'].map((cls) => ({
    class: cls,
    count: records.filter((r) => r.class === cls).length,
  }))

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-display font-semibold mb-1">Detection history</h2>
      <p className="text-ink-dim text-sm mb-7">Every scan logged by the field camera, most recent first.</p>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-panel mb-6" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={counts} barCategoryGap={40}>
            <CartesianGrid strokeDasharray="3 3" stroke="#263731" vertical={false} />
            <XAxis
              dataKey="class"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#9DAEA3', fontSize: 12, textTransform: 'capitalize' }}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9DAEA3', fontSize: 12 }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ChartTooltip />} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {counts.map((c) => (
                <Cell key={c.class} fill={CLASS_COLOR[c.class]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-panel">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-faint">
            <tr>
              <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Time</th>
              <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Class</th>
              <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Confidence</th>
              <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Severity</th>
              <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Dispensed</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                  No detections logged yet.
                </td>
              </tr>
            )}
            {records.map((r, i) => (
              <tr key={i} className="border-t border-border-soft hover:bg-surface-raised/50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-ink-dim">{r.timestamp}</td>
                <td className="px-5 py-3 capitalize">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: CLASS_COLOR[r.class] }} />
                    {r.class.replace('_', '-')}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs">{Math.round(r.confidence * 100)}%</td>
                <td className="px-5 py-3">
                  <span className={`text-xs capitalize rounded-full px-2.5 py-1 ${SEVERITY_PILL[r.severity]}`}>
                    {r.severity}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-dim">{r.dispensed ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
