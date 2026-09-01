// App shell: mobile-first with bottom nav; desktop (≥768px) gets a sidebar.
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'
import {
  IconCalendar,
  IconMoon,
  IconPeople,
  IconProgress,
  IconSettings,
  IconSun,
  IconToday,
  IconUser,
} from './Icons'
import { capabilitiesFor } from '../lib/capabilities'
import { syncBarStatus } from '../lib/syncStatus'
import { BrandLogo } from './BrandLogo'
import { PrimaryWorkoutAction } from './PrimaryWorkoutAction'
import { primarySectionForPath } from '../lib/navigation'
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
  const location = useLocation()
  const { theme, setPreference } = useTheme()
  const { t } = useT()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const primarySection = primarySectionForPath(location.pathname)

  const tabs = [
    { to: '/', label: t('nav.today'), Icon: IconToday, active: primarySection === 'today' },
    {
      to: '/calendar',
      label: t('nav.plan'),
      Icon: IconCalendar,
      active: primarySection === 'plan',
    },
    {
      to: '/progress',
      label: t('nav.progress'),
      Icon: IconProgress,
      active: primarySection === 'progress',
    },
  ]

  useEffect(() => {
    if (!profileOpen) return
    function close(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

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
          {tabs.map(({ to, label, Icon, active }) => (
            <Link key={to} to={to} className={`app-nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon width={22} height={22} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <PrimaryWorkoutAction desktop />
        <div className="app-sidebar__foot">
          {caps.navCoach ? (
            <button type="button" className="app-sidebar__utility" onClick={() => void navigate('/coach')}>
              <IconPeople width={20} height={20} /> {t('nav.coach')}
            </button>
          ) : null}
          <button type="button" className="app-sidebar__utility" onClick={() => void navigate('/settings')}>
            <IconSettings width={20} height={20} /> {t('settings.title')}
          </button>
        </div>
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
          <div className="profile-menu" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-menu__trigger"
              aria-label={t('nav.openProfileMenu')}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              {(profile?.display_name?.trim().charAt(0) || '') ? (
                <span aria-hidden="true">{profile?.display_name?.trim().charAt(0).toUpperCase()}</span>
              ) : <IconUser width={20} height={20} />}
            </button>
            {profileOpen ? (
              <div className="profile-menu__panel" role="menu">
                {profile?.display_name ? <strong>{profile.display_name}</strong> : null}
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); void navigate('/settings') }}>
                  <IconSettings width={19} height={19} /> {t('settings.title')}
                </button>
                {caps.navCoach ? (
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); void navigate('/coach') }}>
                    <IconPeople width={19} height={19} /> {t('nav.coach')}
                  </button>
                ) : null}
                <button type="button" role="menuitem" onClick={() => { toggleTheme(); setProfileOpen(false) }}>
                  {theme === 'dark' ? <IconSun width={19} height={19} /> : <IconMoon width={19} height={19} />}
                  {t('nav.switchTheme', { theme: theme === 'dark' ? t('nav.light') : t('nav.dark') })}
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="app-content" id="main-content">
          <Outlet />
        </main>

        <PrimaryWorkoutAction />

        <nav className="app-bottom-nav" aria-label={t('nav.main')}>
          {tabs.map(({ to, label, Icon, active }) => (
            <Link key={to} to={to} className={`app-bottom-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon width={24} height={24} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
