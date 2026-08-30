// App shell: mobile-first with bottom nav; desktop (≥768px) gets a sidebar.
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'
import {
  IconCalendar,
  IconExercises,
  IconMoon,
  IconPeople,
  IconProgress,
  IconRoutines,
  IconSun,
  IconToday,
  IconUser,
} from './Icons'
import { capabilitiesFor } from '../lib/capabilities'
import { syncBarStatus } from '../lib/syncStatus'
import { BrandLogo } from './BrandLogo'
import { ActiveWorkoutBanner } from './ActiveWorkoutBanner'
import './appLayout.css'

function SyncBar() {
  const { pending, syncing, ready, syncError } = useStore()
  const { t } = useT()
  const [errorOpen, setErrorOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const kind = syncBarStatus({ ready, syncing, pending, syncError })

  useEffect(() => {
    if (!syncError) setErrorOpen(false)
  }, [syncError])

  useEffect(() => {
    if (!errorOpen) return
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setErrorOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setErrorOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [errorOpen])

  if (!kind) return null

  if (kind !== 'error') {
    return (
      <span
        className={`badge ${kind === 'success' ? 'badge--completed' : 'badge--planned'}`}
        data-sync-status={kind}
      >
        {kind === 'success' ? t('sync.statusSuccess') : t('sync.statusPending')}
      </span>
    )
  }

  return (
    <div className="sync-error" ref={rootRef}>
      <button
        type="button"
        className="badge badge--error sync-error__btn"
        data-sync-status="error"
        aria-expanded={errorOpen}
        aria-haspopup="dialog"
        aria-controls="sync-error-pop"
        onClick={() => setErrorOpen((open) => !open)}
      >
        {t('sync.statusError')}
      </button>
      {errorOpen && syncError ? (
        <div
          id="sync-error-pop"
          className="sync-error__pop"
          role="dialog"
          aria-label={t('sync.errorDetails')}
        >
          {syncError}
        </div>
      ) : null}
    </div>
  )
}

export function AppLayout() {
  const { profile } = useStore()
  const caps = capabilitiesFor(profile)
  const navigate = useNavigate()
  const { theme, setPreference } = useTheme()
  const { t } = useT()

  const tabs = [
    { to: '/', label: t('nav.today'), Icon: IconToday },
    { to: '/calendar', label: t('nav.calendar'), Icon: IconCalendar },
    ...(caps.navRoutines ? [{ to: '/routines', label: t('nav.routines'), Icon: IconRoutines }] : []),
    ...(caps.navExercises ? [{ to: '/exercises', label: t('nav.exercises'), Icon: IconExercises }] : []),
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
            <SyncBar />
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
          {caps.navCoach ? (
            <button
              type="button"
              className="btn btn--icon"
              aria-label={t('nav.openCoach')}
              onClick={() => void navigate('/coach')}
            >
              <IconPeople />
            </button>
          ) : null}
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
