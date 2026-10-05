import { useEffect, useState } from 'react'
import client, { mediaUrl } from '../api/client.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'
import { DEMO_HISTORY } from '../data/demo.js'
import { formatIndiaDateTime } from '../utils/dateTime.js'

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
  const [selectedImage, setSelectedImage] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    client
      .get('/api/history')
      .then(({ data }) => setRecords(data))
      .catch(() => setRecords(DEMO_HISTORY))
  }, [])

  useEffect(() => {
    if (!selectedImage) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedImage(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedImage])

  const clearHistory = async () => {
    if (!window.confirm('Clear all detection history and delete its saved images? This cannot be undone.')) return

    setClearing(true)
    setError('')
    try {
      await client.delete('/api/history')
      setRecords([])
      setSelectedImage(null)
    } catch {
      setError('Could not clear history. Please check the backend connection and try again.')
    } finally {
      setClearing(false)
    }
  }

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
    <div className="w-full max-w-6xl min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mb-7 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold mb-1">Detection history</h2>
          <p className="text-ink-dim text-sm">Newest five images per class are kept, most recent first.</p>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          disabled={clearing || records.length === 0}
          className="w-full shrink-0 rounded-lg border border-crimson/40 px-4 py-2 text-sm text-crimson-bright transition-colors hover:bg-crimson/10 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {clearing ? 'Clearing…' : 'Clear history'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-crimson-bright mb-5">{error}</p>}

      <div className="mb-6 h-60 bg-surface border border-border rounded-2xl p-3 sm:h-[260px] sm:p-6 shadow-panel">
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
            <div className="flex items-center justify-between gap-3 px-4 py-4 bg-surface-raised sm:px-5">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[category.key] }} />
                {category.label}
              </h3>
              <span className="text-xs text-ink-faint">{category.records.length} detections</span>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide w-[448px]">Image</th>
                    <th className="text-left px-5 py-3 font-normal text-xs uppercase tracking-wide">Date &amp; time (IST)</th>
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
                      <td className="px-5 py-4">
                        {record.image_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedImage({
                                src: mediaUrl(record.image_url),
                                alt: `${category.label} leaf capture`,
                              })
                            }
                            className="block w-[416px] h-[320px] rounded-xl overflow-hidden bg-bg-soft border border-border hover:border-moss transition-colors"
                            aria-label={`View larger ${category.label.toLowerCase()} leaf image`}
                          >
                            <img
                              src={mediaUrl(record.image_url)}
                              alt={`${category.label} leaf capture`}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        ) : (
                          <div className="w-[416px] h-[320px] rounded-xl bg-bg-soft border border-border flex items-center justify-center text-xs text-ink-faint">
                            No image saved
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-dim">
                        {formatIndiaDateTime(record.timestamp)}
                      </td>
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
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {category.records.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-faint">
                  No {category.label.toLowerCase()} detections logged.
                </p>
              )}
              {category.records.map((record, index) => (
                <article
                  key={`mobile-${record.timestamp}-${index}`}
                  className="overflow-hidden rounded-xl border border-border bg-bg-soft"
                >
                  {record.image_url ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImage({
                          src: mediaUrl(record.image_url),
                          alt: `${category.label} leaf capture`,
                        })
                      }
                      className="block h-60 w-full bg-bg-soft sm:h-80"
                      aria-label={`View larger ${category.label.toLowerCase()} leaf image`}
                    >
                      <img
                        src={mediaUrl(record.image_url)}
                        alt={`${category.label} leaf capture`}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ) : (
                    <div className="flex h-48 items-center justify-center text-xs text-ink-faint">
                      No image saved
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border bg-surface p-4">
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-ink-faint">Date &amp; time (IST)</p>
                      <p className="mt-1 text-xs font-mono text-ink-dim">{formatIndiaDateTime(record.timestamp)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-ink-faint">Confidence</p>
                      <p className="mt-1 text-xs font-mono">{Math.round(record.confidence * 100)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-ink-faint">Severity</p>
                      <span className={`mt-1 inline-block text-xs capitalize rounded-full px-2.5 py-1 ${SEVERITY_PILL[record.severity]}`}>
                        {record.severity}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-ink-faint">Dispensed</p>
                      <p className="mt-1 text-xs text-ink-dim">{record.dispensed ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4 sm:p-8 flex items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedImage(null)
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Leaf capture image"
            className="relative flex max-h-full max-w-6xl items-center justify-center"
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 z-10 h-9 w-9 rounded-full bg-surface text-ink border border-border text-xl leading-none"
              aria-label="Close image"
            >
              ×
            </button>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-h-[85vh] max-w-full rounded-xl object-contain bg-bg-soft"
            />
          </div>
        </div>
      )}
    </div>
  )
}
