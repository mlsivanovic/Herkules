// App shell: mobile-first with bottom nav; desktop (≥768px) gets a sidebar.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  applyTheme,
  currentTheme,
  followSystemTheme,
  saveTheme,
  type Theme,
} from '../lib/theme'
import {
  IconCalendar,
  IconCloudOff,
  IconExercises,
  IconMoon,
  IconProgress,
  IconRoutines,
  IconSun,
  IconSync,
  IconToday,
  IconUser,
} from './Icons'
import { BrandLogo } from './BrandLogo'
import './appLayout.css'

const TABS = [
  { to: '/', label: 'Today', Icon: IconToday },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { to: '/routines', label: 'Routines', Icon: IconRoutines },
  { to: '/exercises', label: 'Exercises', Icon: IconExercises },
  { to: '/progress', label: 'Progress', Icon: IconProgress },
]

export function AppLayout() {
  const { pending, syncing, online, ready } = useStore()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => followSystemTheme(setTheme), [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    saveTheme(next)
    setTheme(next)
  }

  function goHome() {
    void navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button type="button" className="app-brand-btn" onClick={goHome} aria-label="Go to Today">
          <BrandLogo theme={theme} size="sidebar" />
        </button>
        <nav aria-label="Main navigation">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="app-nav-link">
              <Icon width={22} height={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-brand-btn app-brand-btn--mobile"
            onClick={goHome}
            aria-label="Go to Today"
          >
            <BrandLogo theme={theme} size="bar" />
          </button>
          <div className="app-topbar-status" role="status">
            {!online ? (
              <span className="badge badge--skipped">
                <IconCloudOff width={14} height={14} /> Offline
              </span>
            ) : syncing ? (
              <span className="badge badge--in-progress">
                <IconSync width={14} height={14} /> Syncing
              </span>
            ) : pending > 0 ? (
              <span className="badge badge--planned">
                <IconCloudOff width={14} height={14} /> Pending sync ({pending})
              </span>
            ) : ready ? (
              <span className="badge badge--completed">All changes saved</span>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label="Open settings"
            onClick={() => void navigate('/settings')}
          >
            <IconUser />
          </button>
        </header>

        <main className="app-content" id="main-content">
          <Outlet />
        </main>

        <nav className="app-bottom-nav" aria-label="Main navigation">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="app-bottom-link">
              <Icon width={24} height={24} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
