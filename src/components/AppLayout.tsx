// App shell: mobile-first with bottom nav; desktop (≥768px) gets a sidebar.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'
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
import { ActiveWorkoutBanner } from './ActiveWorkoutBanner'
import './appLayout.css'

export function AppLayout() {
  const { pending, syncing, online, ready, syncError } = useStore()
  const navigate = useNavigate()
  const { theme, setPreference } = useTheme()
  const { t } = useT()

  const tabs = [
    { to: '/', label: t('nav.today'), Icon: IconToday },
    { to: '/calendar', label: t('nav.calendar'), Icon: IconCalendar },
    { to: '/routines', label: t('nav.routines'), Icon: IconRoutines },
    { to: '/exercises', label: t('nav.exercises'), Icon: IconExercises },
    { to: '/progress', label: t('nav.progress'), Icon: IconProgress },
  ]

  function toggleTheme() {
    setPreference(theme === 'dark' ? 'light' : 'dark')
  }

  function goHome() {
    void navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <button type="button" className="app-brand-btn" onClick={goHome} aria-label={t('nav.goToday')}>
          <BrandLogo theme={theme} size="sidebar" />
        </button>
        <nav aria-label={t('nav.main')}>
          {tabs.map(({ to, label, Icon }) => (
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
            aria-label={t('nav.goToday')}
          >
            <BrandLogo theme={theme} size="bar" />
          </button>
          <div className="app-topbar-status" role="status">
            {!online ? (
              <span className="badge badge--skipped">
                <IconCloudOff width={14} height={14} /> {t('sync.offline')}
              </span>
            ) : syncing ? (
              <span className="badge badge--in-progress">
                <IconSync width={14} height={14} /> {t('sync.syncing')}
              </span>
            ) : syncError ? (
              <span className="badge badge--error" role="alert">
                <IconSync width={14} height={14} /> {t('sync.failed')}
              </span>
            ) : pending > 0 ? (
              <span className="badge badge--planned">
                <IconCloudOff width={14} height={14} /> {t('sync.pending', { count: pending })}
              </span>
            ) : ready ? (
              <span className="badge badge--completed">{t('sync.saved')}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={t('nav.switchTheme', {
              theme: theme === 'dark' ? t('nav.light') : t('nav.dark'),
            })}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={t('nav.openSettings')}
            onClick={() => void navigate('/settings')}
          >
            <IconUser />
          </button>
        </header>

        <main className="app-content" id="main-content">
          <Outlet />
        </main>

        <ActiveWorkoutBanner />

        <nav className="app-bottom-nav" aria-label={t('nav.main')}>
          {tabs.map(({ to, label, Icon }) => (
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
