import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

export default function LocationPage() {
  const [coords, setCoords] = useState(null)
  const [address, setAddress] = useState('')
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
          const data = await res.json()
          setAddress(data.display_name || 'Unknown location')
        } catch {
          /* reverse geocoding is optional */
        }

        const key = import.meta.env.VITE_OPENWEATHER_KEY
        if (key) {
          try {
            const res = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${key}`
            )
            const data = await res.json()
            setWeather(data)
          } catch {
            /* weather is optional */
          }
        }
      },
      () => setError('Location permission denied. Enable it to see field position and weather.')
    )
  }, [])

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-display font-semibold mb-1">Field location</h2>
      <p className="text-ink-dim text-sm mb-7">Where CAM-01 is currently positioned, and local conditions.</p>

      {error && (
        <p className="text-sm text-amber-bright mb-4 bg-amber/10 border border-amber/20 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 bg-surface border border-border rounded-2xl overflow-hidden shadow-panel"
          style={{ height: 380 }}
        >
          {coords ? (
            <MapContainer center={[coords.lat, coords.lng]} zoom={15} style={{ height: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <Marker position={[coords.lat, coords.lng]}>
                <Popup>{address || 'Field location'}</Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-ink-faint">
              Waiting for location…
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-panel">
            <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Address</p>
            <p className="text-sm text-ink/90 leading-relaxed">{address || '—'}</p>
          </div>
          {weather && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-panel">
              <p className="text-xs uppercase tracking-wide text-ink-faint mb-2">Conditions</p>
              <p className="text-3xl font-display font-semibold">{Math.round(weather.main.temp)}°C</p>
              <p className="text-sm text-ink-dim capitalize mt-1">{weather.weather[0].description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-sm">
                <span className="text-ink-faint">Humidity</span>
                <span className="font-mono">{weather.main.humidity}%</span>
              </div>
              {weather.main.humidity > 70 && (
                <p className="text-sm text-crimson-bright mt-3 bg-crimson/10 border border-crimson/20 rounded-lg px-3 py-2">
                  High humidity — fungal risk is elevated.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
