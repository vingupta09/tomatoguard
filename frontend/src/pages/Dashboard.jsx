import { useEffect, useState } from 'react'
import client from '../api/client.js'
import StatusCard from '../components/StatusCard.jsx'
import DiagnosisPanel from '../components/DiagnosisPanel.jsx'
import { getDemoPrediction, DEMO_STATUS } from '../data/demo.js'

export default function Dashboard() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState({ esp32_online: false, last_dispensed: '—' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dispensed, setDispensed] = useState(false)

  useEffect(() => {
    client
      .get('/api/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus(DEMO_STATUS))
  }, [])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setDispensed(false)
  }

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await client.post('/api/predict', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (err) {
      setResult(getDemoPrediction())
      setError('Backend unreachable — showing a demo result instead.')
    } finally {
      setLoading(false)
    }
  }

  const dispense = async () => {
    try {
      await client.post('/api/dispense')
      const { data } = await client.get('/api/status')
      setStatus(data)
      setDispensed(true)
    } catch {
      setDispensed(true)
      setError('Could not reach the pump controller — recorded locally instead.')
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-semibold">Dashboard</h2>
        <span className="text-xs font-mono text-ink-faint">{new Date().toLocaleDateString()}</span>
      </div>
      <p className="text-ink-dim mb-7 text-sm">Capture or upload a leaf image to check for disease.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatusCard
          label="ESP32-CAM"
          value={status.esp32_online ? 'Online' : 'Offline'}
          tone={status.esp32_online ? 'good' : 'critical'}
          hint="CAM-01 · North row"
        />
        <StatusCard label="Last dispensed" value={status.last_dispensed || '—'} tone="neutral" hint="Auto pump" />
        <StatusCard
          label="Detections today"
          value={status.detections_today ?? '—'}
          tone="warning"
          hint="Across all rows"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-panel h-fit">
          <label className="block text-sm text-ink-dim mb-3">Leaf image</label>
          <label
            htmlFor="dash-upload"
            className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl h-52 cursor-pointer hover:border-moss/50 transition-colors overflow-hidden bg-bg-soft"
          >
            {preview ? (
              <img src={preview} alt="Selected leaf" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center px-6">
                <p className="text-sm text-ink-dim">Click to choose a photo</p>
                <p className="text-xs text-ink-faint mt-1">JPG or PNG, one leaf per frame</p>
              </div>
            )}
          </label>
          <input id="dash-upload" type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            onClick={analyze}
            disabled={!file || loading}
            className="mt-4 w-full bg-rust hover:bg-rust-bright text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing…' : 'Analyze leaf'}
          </button>
          {error && <p className="text-sm text-amber-bright mt-3">{error}</p>}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-panel">
          <h3 className="text-xs uppercase tracking-wide text-ink-faint mb-4">Diagnosis</h3>
          {!result && (
            <div className="h-full flex items-center justify-center text-center py-16">
              <p className="text-sm text-ink-faint max-w-[220px]">
                Run an analysis to see category, symptoms, and remedy here.
              </p>
            </div>
          )}
          {result && (
            <DiagnosisPanel
              result={result}
              onDispense={dispensed ? undefined : dispense}
              dispenseLabel={dispensed ? 'Dispensed' : 'Dispense pesticide now'}
            />
          )}
          {result && dispensed && (
            <p className="text-xs text-moss-bright font-mono mt-4">✓ Dispensing command sent</p>
          )}
        </div>
      </div>
    </div>
  )
}
