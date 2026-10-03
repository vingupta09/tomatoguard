import { useEffect, useState } from 'react'
import client, { mediaUrl } from '../api/client.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'
import { DEMO_HISTORY } from '../data/demo.js'

const HISTORY_CATEGORIES = [
  { key: 'healthy', label: 'Healthy' },
  { key: 'fungal', label: 'Fungal' },
  { key: 'non_fungal', label: 'Non-fungal' },
]
const CLASS_COLOR = { healthy: '#5FA877', non_fungal: '#CC9640', fungal: '#B3423A' }
const SEVERITY_PILL = {
  none: 'bg-moss/15 text-moss-bright',
  low: 'bg-amber/15 text-amber-bright',
  medium: 'bg-rust/15 text-rust-bright',
  high: 'bg-crimson/15 text-crimson-bright',
}

function historyCategory(className) {
  const normalized = className?.toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'bacterial') return 'non_fungal'
  return normalized
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

  const categoryRecords = HISTORY_CATEGORIES.map((category) => ({
    ...category,
    records: records.filter((record) => historyCategory(record.class) === category.key),
  }))
  const counts = categoryRecords.map((category) => ({
    class: category.label,
    key: category.key,
    count: category.records.length,
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
              {counts.map((category) => (
                <Cell key={category.key} fill={CLASS_COLOR[category.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-5">
        {categoryRecords.map((category) => (
          <section key={category.key} className="bg-surface border border-border rounded-2xl overflow-hidden shadow-panel">
            <div className="flex items-center justify-between px-5 py-4 bg-surface-raised">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[category.key] }} />
                {category.label}
              </h3>
              <span className="text-xs text-ink-faint">{category.records.length} detections</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-ink-faint">
                <tr>
                  <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Image</th>
                  <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Time</th>
                  <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Confidence</th>
                  <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Severity</th>
                  <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Dispensed</th>
                </tr>
              </thead>
              <tbody>
                {category.records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                      No {category.label.toLowerCase()} detections logged.
                    </td>
                  </tr>
                )}
                {category.records.map((record, index) => (
                  <tr
                    key={`${record.timestamp}-${index}`}
                    className="border-t border-border-soft hover:bg-surface-raised/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      {record.image_url ? (
                        <img
                          src={mediaUrl(record.image_url)}
                          alt={`${category.label} leaf capture`}
                          className="w-12 h-12 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-bg-soft border border-border" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-dim">{record.timestamp}</td>
                    <td className="px-5 py-3 font-mono text-xs">{Math.round(record.confidence * 100)}%</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs capitalize rounded-full px-2.5 py-1 ${SEVERITY_PILL[record.severity]}`}>
                        {record.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-dim">{record.dispensed ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}
