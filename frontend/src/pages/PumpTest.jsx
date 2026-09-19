import { useEffect, useState } from 'react'
import client from '../api/client.js'
import StatusCard from '../components/StatusCard.jsx'
import { DEMO_STATUS } from '../data/demo.js'

const PUMPS = [
  { id: 1, label: 'Pump 1', hint: 'Pesticide sprayer · relay pin 26' },
  { id: 2, label: 'Pump 2', hint: 'Water pump · relay pin 27' },
]

export default function PumpTest() {
  const [status, setStatus] = useState({ pump_online: false, pump1_last_dispensed: '—', pump2_last_dispensed: '—' })
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState({})
  const [error, setError] = useState('')

  const loadStatus = () => {
    client
      .get('/api/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus(DEMO_STATUS))
  }

  useEffect(loadStatus, [])

  const testPump = async (pump) => {
    setBusy(pump)
    setError('')
    try {
      await client.post('/api/dispense', { pump })
      setResult((r) => ({ ...r, [pump]: 'sent' }))
      loadStatus()
    } catch {
      setResult((r) => ({ ...r, [pump]: 'failed' }))
      setError('Could not reach the pump controller. It will still pick up the command on its next poll if the request queued server-side.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-semibold">Pump test</h2>
        <span className="text-xs font-mono text-ink-faint">{new Date().toLocaleDateString()}</span>
      </div>
      <p className="text-ink-dim mb-7 text-sm">
        Manually fire either pump for a few seconds — useful for checking wiring and relay
        function without waiting for a disease detection.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatusCard
          label="Pump controller"
          value={status.pump_online ? 'Online' : 'Offline'}
          tone={status.pump_online ? 'good' : 'critical'}
          hint="ESP32 pump board"
        />
        <StatusCard label="Pump 1 last run" value={status.pump1_last_dispensed || '—'} tone="neutral" hint="Pesticide" />
        <StatusCard label="Pump 2 last run" value={status.pump2_last_dispensed || '—'} tone="neutral" hint="Water" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {PUMPS.map((p) => (
          <div key={p.id} className="bg-surface border border-border rounded-2xl p-6 shadow-panel">
            <h3 className="text-xs uppercase tracking-wide text-ink-faint mb-1">{p.label}</h3>
            <p className="text-sm text-ink-dim mb-6">{p.hint}</p>
            <button
              onClick={() => testPump(p.id)}
              disabled={busy === p.id}
              className="w-full bg-rust hover:bg-rust-bright text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === p.id ? 'Sending…' : `Test ${p.label}`}
            </button>
            {result[p.id] === 'sent' && (
              <p className="text-xs text-moss-bright font-mono mt-3">✓ Command sent — pump runs on next poll</p>
            )}
            {result[p.id] === 'failed' && (
              <p className="text-xs text-amber-bright font-mono mt-3">⚠ Request failed, see below</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-amber-bright mt-6">{error}</p>}
    </div>
  )
}
