import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const DEMO_USER = import.meta.env.VITE_DEMO_USER || 'admin'
const DEMO_PASS = import.meta.env.VITE_DEMO_PASS || 'tomato123'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (username === DEMO_USER && password === DEMO_PASS) {
      login(username, 'demo-token')
      navigate('/dashboard')
    } else {
      setError('Invalid username or password.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 relative overflow-hidden">
      <div className="absolute inset-0 field-grid bg-grid-fade pointer-events-none" />
      <div className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-panel px-8 py-10">
        <Link to="/" className="flex items-center gap-2.5 mb-8">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="18" r="10" fill="#C15A34" />
            <path d="M16 8c-1.5-2-4-3-6-2.5C11 7 13 8 16 8Z" fill="#5FA877" />
            <path d="M16 8c1.5-2 4-3 6-2.5C21 7 19 8 16 8Z" fill="#7FC496" />
          </svg>
          <span className="font-display font-semibold tracking-tight">TomatoGuard</span>
        </Link>
        <h1 className="text-xl font-display font-semibold">Sign in to your field</h1>
        <p className="text-sm text-ink-dim mt-1 mb-7">Monitor detections and control the dispenser.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-faint block mb-1.5">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg bg-bg-soft border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-moss focus:border-moss"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-ink-faint block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg bg-bg-soft border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-moss focus:border-moss"
            />
          </div>
          {error && <p className="text-sm text-crimson-bright">{error}</p>}
          <button
            type="submit"
            className="w-full bg-moss hover:bg-moss-bright text-bg rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Sign in
          </button>
        </form>
        <p className="text-xs text-ink-faint mt-6">Demo credentials are set in your .env file.</p>
        <Link to="/" className="text-xs text-moss-bright mt-2 inline-block hover:underline">
          &larr; Back to home
        </Link>
      </div>
    </div>
  )
}
