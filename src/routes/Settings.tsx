// Settings: profile preferences (units, week start, default rest, display
// name), theme, password change and sign-out with pending-sync protection.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { applyTheme, currentTheme, followSystemTheme, saveTheme, type Theme } from '../lib/theme'
import { Modal } from '../components/ui'
import { IconMoon, IconSun } from '../components/Icons'

export function Settings() {
  const navigate = useNavigate()
  const store = useStore()
  const { session } = useAuth()
  const profile = store.profile

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saved, setSaved] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    saveTheme(next)
    setTheme(next)
  }

  // Follow the OS theme until an explicit choice exists
  useEffect(() => followSystemTheme(setTheme), [])

  async function saveProfile() {
    await store.updateProfile({ display_name: displayName })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    setLogoutBusy(true)
    setLogoutError(null)
    if (store.pending === 0) {
      await store.forceWipeAndSignOut()
      return
    }
    if (!store.online) {
      // The confirm modal is already open in this state
      await store.forceWipeAndSignOut()
      return
    }
    const ok = await store.attemptSync()
    if (ok) {
      await store.forceWipeAndSignOut()
      return
    }
    setLogoutBusy(false)
    setLogoutError(
      'Some changes could not be synced. Go online and try again, or discard local changes.',
    )
  }

  function requestLogout() {
    if (store.pending > 0 && !store.online) {
      setLogoutConfirm(true)
      return
    }
    void handleLogout()
  }

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="section-title">Profile</div>
      <div className="card stack">
        <div className="field">
          <label htmlFor="settings-name">Display name</label>
          <input
            id="settings-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => void saveProfile()}
          />
        </div>
        <small className="muted">Signed in as {session?.user.email}</small>
        {saved ? <small className="badge badge--completed">Saved</small> : null}
      </div>

      <div className="section-title">Preferences</div>
      <div className="card stack">
        <div className="field">
          <label htmlFor="settings-units">Units</label>
          <select
            id="settings-units"
            className="input"
            value={profile?.unit_system ?? 'metric'}
            onChange={(e) =>
              void store.updateProfile({ unit_system: e.target.value as 'metric' | 'imperial' })
            }
          >
            <option value="metric">Metric (kg, km)</option>
            <option value="imperial">Imperial (lb, mi)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="settings-week">Week starts on</label>
          <select
            id="settings-week"
            className="input"
            value={profile?.week_start ?? 'monday'}
            onChange={(e) =>
              void store.updateProfile({ week_start: e.target.value as 'monday' | 'sunday' })
            }
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="settings-rest">Default rest timer (seconds)</label>
          <input
            id="settings-rest"
            className="input"
            type="number"
            min={0}
            max={3600}
            value={profile?.default_rest_seconds ?? 90}
            onChange={(e) =>
              void store.updateProfile({
                default_rest_seconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
              })
            }
          />
        </div>
      </div>

      <div className="section-title">Appearance</div>
      <div className="card row row--between">
        <span>Theme</span>
        <button
          type="button"
          className="btn"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <div className="section-title">Account</div>
      <div className="card stack">
        <button
          type="button"
          className="btn"
          onClick={() => void navigate('/update-password')}
        >
          Change password
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={requestLogout}
          disabled={logoutBusy}
        >
          {logoutBusy ? 'Signing out…' : 'Sign out'}
        </button>
        {logoutError ? (
          <p className="field-error" role="alert">
            {logoutError}
          </p>
        ) : null}
      </div>

      <p className="muted" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        Herkules v1.0 · offline-first workout log
      </p>

      {logoutConfirm ? (
        <Modal title="Discard unsynced changes?" onClose={() => setLogoutConfirm(false)}>
          <p>
            You are offline with <strong>{store.pending}</strong> unsynced change(s). Signing out
            now will permanently discard them.
          </p>
          <div className="stack">
            <button type="button" className="btn btn--danger btn--block" onClick={() => void handleLogout()}>
              Discard and sign out
            </button>
            <button type="button" className="btn btn--block" onClick={() => setLogoutConfirm(false)}>
              Stay signed in
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
