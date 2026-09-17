import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client.js'
import TopNav from '../components/TopNav.jsx'
import DiagnosisPanel from '../components/DiagnosisPanel.jsx'
import { getDemoPrediction, DISEASE_INFO } from '../data/demo.js'

const STEPS = [
  {
    n: '01',
    title: 'Capture',
    body: 'An ESP32-CAM mounted over the crop takes a photo of a tomato leaf and sends it to the server.',
  },
  {
    n: '02',
    title: 'Classify',
    body: 'A MobileNetV3 model checks the leaf for healthy, bacterial, or fungal signs and scores severity.',
  },
  {
    n: '03',
    title: 'Dispense',
    body: 'If disease is found, the server signals an ESP32 dev board, which drives a relay to pump pesticide.',
  },
]

const CLASS_TONE = {
  healthy: 'text-moss-bright',
  non_fungal: 'text-amber-bright',
  fungal: 'text-crimson-bright',
}

export default function Home() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
  }

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await client.post('/api/predict', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch {
      // Backend not reachable — fall back to a labelled demo result so the
      // page still works during local dev or a live walkthrough.
      await new Promise((r) => setTimeout(r, 700))
      setResult(getDemoPrediction())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 field-grid bg-grid-fade pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <p className="text-xs font-mono tracking-wide text-moss-bright mb-5">
              FOR TOMATO GROWERS &amp; FIELD RESEARCHERS
            </p>
            <h1 className="font-display font-semibold text-[2.75rem] sm:text-5xl leading-[1.08] max-w-xl">
              A camera in the field that knows a sick leaf before you do
            </h1>
            <p className="mt-6 text-ink-dim max-w-md text-base leading-relaxed">
              An ESP32-CAM watches your crop around the clock. An on-device model tells healthy leaves from
              bacterial or fungal infection, and a relay-controlled pump treats the plant the moment it's needed —
              no manual scouting required.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#classify"
                className="bg-moss hover:bg-moss-bright text-bg font-medium rounded-lg px-5 py-3 text-sm transition-colors"
              >
                Try the classifier
              </a>
              <Link
                to="/login"
                className="border border-border text-ink font-medium rounded-lg px-5 py-3 text-sm hover:bg-surface transition-colors"
              >
                Open dashboard
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <p className="font-mono text-2xl font-medium">3</p>
                <p className="text-xs text-ink-faint mt-1">Classes detected</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium">&lt;1s</p>
                <p className="text-xs text-ink-faint mt-1">On-device inference</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-medium">24/7</p>
                <p className="text-xs text-ink-faint mt-1">Unattended watch</p>
              </div>
            </div>
          </div>

          {/* Live instrument readout */}
          <div className="bg-surface border border-border rounded-2xl shadow-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono text-ink-faint">CAM-01 · NORTH ROW</p>
              <span className="flex items-center gap-1.5 text-xs text-moss-bright">
                <span className="h-1.5 w-1.5 rounded-full bg-moss animate-pulse" />
                Online
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-border-soft mb-4">
              <img
                src="https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=600&q=80"
                alt="Tomato leaf under inspection"
                className="w-full h-44 object-cover"
              />
            </div>
            <div className="space-y-3">
              {Object.keys(DISEASE_INFO).map((cls) => (
                <div key={cls} className="flex items-center justify-between text-sm">
                  <span className={`capitalize ${CLASS_TONE[cls]}`}>{DISEASE_INFO[cls].disease}</span>
                  <span className="font-mono text-ink-faint text-xs">
                    {cls === 'healthy' ? '—' : cls === 'non_fungal' ? '02 flagged' : '05 flagged'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
              <span className="text-ink-faint">Last scan</span>
              <span className="font-mono text-ink-dim">6 min ago</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl mb-10">
          <h2 className="text-2xl font-display font-semibold mb-3">How it works</h2>
          <p className="text-ink-dim text-sm">
            One closed loop, from image capture to treatment, running without a person in the field.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-surface p-6">
              <span className="font-mono text-xs text-moss-bright">{s.n}</span>
              <h3 className="font-display font-semibold mt-3 mb-2">{s.title}</h3>
              <p className="text-sm text-ink-dim leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live classifier */}
      <section id="classify" className="bg-surface/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-xl mb-10">
            <h2 className="text-2xl font-display font-semibold mb-3">Try the classifier</h2>
            <p className="text-ink-dim text-sm">Upload a tomato leaf photo and see the system's full diagnosis.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-panel">
              <label className="block text-sm text-ink-dim mb-3">Leaf image</label>
              <label
                htmlFor="leaf-upload"
                className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl h-56 cursor-pointer hover:border-moss/50 transition-colors overflow-hidden bg-bg-soft"
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
              <input id="leaf-upload" type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button
                onClick={analyze}
                disabled={!file || loading}
                className="mt-4 w-full bg-rust hover:bg-rust-bright text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Analyzing…' : 'Analyze leaf'}
              </button>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6 shadow-panel">
              <h3 className="text-xs uppercase tracking-wide text-ink-faint mb-4">Diagnosis</h3>
              {!result && (
                <div className="h-full flex items-center justify-center text-center py-12">
                  <p className="text-sm text-ink-faint max-w-[220px]">
                    Upload and analyze a photo to see category, symptoms, and recommended action here.
                  </p>
                </div>
              )}
              {result && <DiagnosisPanel result={result} />}
            </div>
          </div>
        </div>
      </section>

      {/* Disease reference preview */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl mb-10">
          <h2 className="text-2xl font-display font-semibold mb-3">What the model looks for</h2>
          <p className="text-ink-dim text-sm">Three classes, each with a distinct visual signature.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {Object.entries(DISEASE_INFO).map(([name, info]) => (
            <div key={name} className="rounded-xl border border-border p-5 bg-surface">
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">{info.category}</p>
              <p className="font-display font-semibold mb-2">{info.disease}</p>
              <p className="text-sm text-ink-dim leading-relaxed">{info.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-ink-faint flex flex-wrap justify-between gap-2">
          <span>Plant Disease Detection and Automated Pesticide Dispensing System</span>
          <span>B.Tech final year project</span>
        </div>
      </footer>
    </div>
  )
}
