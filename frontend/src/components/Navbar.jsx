import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
        <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/location',
    label: 'Field location',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" strokeLinejoin="round" />
        <circle cx="12" cy="9.5" r="2.4" />
      </svg>
    ),
  },
  {
    to: '/pump-test',
    label: 'Pump test',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2.5c3 3.5 6 7.3 6 10.8a6 6 0 1 1-12 0c0-3.5 3-7.3 6-10.8Z" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-border min-h-screen flex flex-col">
      <div className="px-6 py-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="18" r="10" fill="#C15A34" />
            <path d="M16 8c-1.5-2-4-3-6-2.5C11 7 13 8 16 8Z" fill="#5FA877" />
            <path d="M16 8c1.5-2 4-3 6-2.5C21 7 19 8 16 8Z" fill="#7FC496" />
          </svg>
          <div>
            <p className="font-display font-semibold text-[15px] leading-none tracking-tight">TomatoGuard</p>
            <p className="text-[11px] text-ink-faint mt-1">Field monitoring console</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm border-l-2 transition-colors ${
                isActive
                  ? 'bg-surface-raised text-ink border-moss'
                  : 'text-ink-dim border-transparent hover:bg-surface-raised/60 hover:text-ink'
              }`
            }
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 rounded-lg bg-surface-raised px-3 py-2.5 mb-2">
          <span className="h-7 w-7 rounded-full bg-moss/20 text-moss-bright text-xs font-medium flex items-center justify-center shrink-0">
            {(user || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-ink-faint leading-none">Signed in</p>
            <p className="text-sm font-medium truncate">{user}</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="w-full text-left text-xs text-ink-dim hover:text-rust-bright rounded-lg px-3 py-2 transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
