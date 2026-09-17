import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function TopNav() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="18" r="10" fill="#C15A34" />
            <path d="M16 8c-1.5-2-4-3-6-2.5C11 7 13 8 16 8Z" fill="#5FA877" />
            <path d="M16 8c1.5-2 4-3 6-2.5C21 7 19 8 16 8Z" fill="#7FC496" />
          </svg>
          <span className="font-display font-semibold tracking-tight">TomatoGuard</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-7 text-sm text-ink-dim">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-ink' : 'hover:text-ink transition-colors')}>
            Home
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) => (isActive ? 'text-ink' : 'hover:text-ink transition-colors')}
          >
            About
          </NavLink>
        </nav>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="text-sm font-medium bg-moss hover:bg-moss-bright text-bg rounded-lg px-4 py-2 transition-colors"
        >
          {user ? 'Open dashboard' : 'Sign in'}
        </Link>
      </div>
    </header>
  )
}
