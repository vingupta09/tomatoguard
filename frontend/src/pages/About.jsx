import TopNav from '../components/TopNav.jsx'
import { DISEASE_INFO } from '../data/demo.js'

const LOOP = [
  'ESP32-CAM captures a leaf image on a schedule or on trigger.',
  'The image is sent to the server, which runs it through the classifier.',
  'The server sends a command back to an ESP32 dev board.',
  'The dev board switches a relay, driving a pump to spray pesticide if disease was found.',
]

export default function About() {
  return (
    <div>
      <TopNav />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-xs font-mono tracking-wide text-moss-bright mb-4">ABOUT THE SYSTEM</p>
        <h2 className="text-3xl font-display font-semibold mb-4 max-w-2xl">
          A closed loop between camera, model, and pump
        </h2>
        <p className="text-ink-dim max-w-2xl mb-14 leading-relaxed">
          The system watches a tomato crop through an ESP32-CAM, classifies each leaf image with a MobileNetV3
          model, and triggers a relay-controlled pump to dispense pesticide automatically when disease is detected
          — removing the need for a person to walk the field checking every plant by hand.
        </p>

        <h3 className="text-lg font-display font-semibold mb-5">Disease reference</h3>
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {Object.entries(DISEASE_INFO).map(([name, info]) => (
            <div key={name} className="bg-surface border border-border rounded-xl p-5">
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-1">{info.category}</p>
              <p className="font-display font-semibold mb-3">{info.disease}</p>
              <p className="text-sm text-ink-dim mb-4 leading-relaxed">{info.description}</p>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Symptoms</p>
              <ul className="space-y-1 mb-4">
                {info.symptoms.map((s, i) => (
                  <li key={i} className="text-sm text-ink/80 flex gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-rust shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Remedy</p>
              <ul className="space-y-1">
                {info.remedy.map((s, i) => (
                  <li key={i} className="text-sm text-moss-bright flex gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-moss shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-display font-semibold mb-5">Hardware loop</h3>
        <div className="grid sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border max-w-3xl">
          {LOOP.map((step, i) => (
            <div key={i} className="bg-surface p-5 flex gap-4">
              <span className="font-mono text-xs text-moss-bright shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <p className="text-sm text-ink-dim leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
