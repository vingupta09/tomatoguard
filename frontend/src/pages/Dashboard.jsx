import { useEffect, useState } from 'react'
import client, { mediaUrl } from '../api/client.js'
import StatusCard from '../components/StatusCard.jsx'
import DiagnosisPanel from '../components/DiagnosisPanel.jsx'
import { getDemoPrediction, DEMO_STATUS, DEMO_HISTORY } from '../data/demo.js'
import { formatIndiaDateTime } from '../utils/dateTime.js'

const CLASS_DOT = { healthy: 'bg-moss', non_fungal: 'bg-amber', fungal: 'bg-crimson' }

export default function Dashboard() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState({ esp32_online: false, last_dispensed: '—', auto_mode: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dispensed, setDispensed] = useState(false)
  const [latestCapture, setLatestCapture] = useState(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoError, setAutoError] = useState('')

  const loadLatestCapture = () => {
    client
      .get('/api/history', { params: { limit: 1 } })
      .then(({ data }) => setLatestCapture(data[0] || null))
      .catch(() => setLatestCapture(DEMO_HISTORY[0]))
  }

  useEffect(() => {
    const refreshStatus = () => {
      client
        .get('/api/status')
        .then(({ data }) => setStatus(data))
        .catch(() => setStatus({ ...DEMO_STATUS, esp32_online: false }))
    }
    refreshStatus()
    loadLatestCapture()
    const statusInterval = window.setInterval(refreshStatus, 5000)

    return () => {
      window.clearInterval(statusInterval)
    }
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
      loadLatestCapture()
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

  // Switch automatic spraying ON / OFF (the camera can only start a pump while this is ON)
  const toggleAutoMode = async () => {
    setAutoBusy(true)
    setAutoError('')
    try {
      const { data } = await client.post('/api/auto-mode', { enabled: !status.auto_mode })
      setStatus((s) => ({ ...s, auto_mode: data.enabled }))
    } catch {
      setAutoError('Could not reach the server')
    } finally {
      setAutoBusy(false)
    }
  }

  return (
    <div className="w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-display font-semibold">Dashboard</h2>
        <span className="text-xs font-mono text-ink-faint">{formatIndiaDateTime(new Date().toISOString())}</span>
      </div>
      <p className="text-ink-dim mb-7 text-sm">Capture or upload a leaf image to check for disease.</p>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
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
        <div className="bg-surface border border-border rounded-xl px-5 py-4 shadow-panel">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Auto spray</p>
            <span
              className={`h-2 w-2 rounded-full ${
                status.auto_mode ? 'bg-moss shadow-[0_0_0_3px_rgba(95,168,119,0.18)]' : 'bg-ink/30'
              }`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-display font-semibold leading-none">{status.auto_mode ? 'ON' : 'OFF'}</p>
            <button
              type="button"
              role="switch"
              aria-checked={!!status.auto_mode}
              aria-label="Automatic spraying"
              onClick={toggleAutoMode}
              disabled={autoBusy}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                status.auto_mode ? 'bg-moss' : 'bg-ink/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  status.auto_mode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-ink-faint mt-2 font-mono">
            {autoError || (status.auto_mode ? 'Camera can start the pump' : 'Camera will not spray')}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 bg-surface border border-border rounded-2xl p-4 sm:p-6 shadow-panel h-fit">
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

        <div className="min-w-0 bg-surface border border-border rounded-2xl p-4 sm:p-6 shadow-panel">
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

      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 shadow-panel mt-6">
        <h3 className="text-xs uppercase tracking-wide text-ink-faint mb-4">Latest camera capture</h3>
        {!latestCapture && <p className="text-sm text-ink-faint">No captures logged yet.</p>}
        {latestCapture && (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-bg-soft border border-border shrink-0">
              {latestCapture.image_url ? (
                <img
                  src={mediaUrl(latestCapture.image_url)}
                  alt="Latest field capture"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-ink-faint text-center px-2">
                  No image saved
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-mono text-ink-faint mb-1">{formatIndiaDateTime(latestCapture.timestamp)}</p>
              <p className="capitalize font-medium flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${CLASS_DOT[latestCapture.class] || 'bg-ink/30'}`} />
                {latestCapture.class.replace('_', '-')}
              </p>
              <p className="text-xs text-ink-dim mt-1 capitalize">Severity: {latestCapture.severity}</p>
              <p className="text-xs text-ink-dim mt-1">{latestCapture.dispensed ? 'Pump dispensed' : 'Not dispensed'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}