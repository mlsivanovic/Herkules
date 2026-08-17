// App shell: mobile-first with bottom navigation; desktop (≥768px) gets a
// sidebar instead. Auth gating happens in RequireAuth (App.tsx); this layout
// only renders for signed-in users.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  IconCalendar,
  IconCloudOff,
  IconExercises,
  IconProgress,
  IconRoutines,
  IconSync,
  IconToday,
  IconUser,
} from './Icons'
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

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          Herkules
        </div>
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
          <div className="app-brand app-brand--mobile">
            <span className="app-brand-mark" aria-hidden="true" />
            Herkules
          </div>
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
