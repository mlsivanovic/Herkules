// Settings: profile preferences (units, week start, default rest, display
// name), theme, password change and sign-out with pending-sync protection.
import { useEffect, useRef, useState } from 'react'
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
  const [syncBusy, setSyncBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

      <div className="section-title">Sync</div>
      <div className="card stack">
        <div className="row row--between">
          <span>{store.online ? 'Online' : 'Offline'}</span>
          <span className="muted">
            {store.syncing
              ? 'Syncing…'
              : store.pending > 0
                ? `${store.pending} change${store.pending === 1 ? '' : 's'} waiting`
                : 'All changes saved'}
          </span>
        </div>
        {store.lastSyncedAt ? (
          <small className="muted">
            Last successful sync{' '}
            {new Date(store.lastSyncedAt).toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </small>
        ) : (
          <small className="muted">No successful sync on this device yet.</small>
        )}
        {store.pendingByTable.length > 0 ? (
          <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {store.pendingByTable.map((entry) => (
              <li key={entry.table}>
                {entry.table.replace(/_/g, ' ')} — {entry.count}
              </li>
            ))}
          </ul>
        ) : null}
        {store.syncError ? (
          <p className="field-error" role="alert">
            {store.syncError}
          </p>
        ) : null}
        <button
          type="button"
          className="btn"
          disabled={syncBusy || !store.online}
          onClick={() => {
            setSyncBusy(true)
            void store.syncNow().finally(() => setSyncBusy(false))
          }}
        >
          {syncBusy ? 'Retrying…' : 'Retry sync'}
        </button>
      </div>

      <div className="section-title">Workouts</div>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          Export or import completed and skipped workouts as CSV. Units are stored as kg, meters and
          seconds.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void store.exportWorkoutsCsv().then((csv) => {
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `herkules-workouts-${new Date().toISOString().slice(0, 10)}.csv`
              link.click()
              URL.revokeObjectURL(url)
            })
          }}
        >
          Export workouts CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            setImportBusy(true)
            setImportError(null)
            setImportMessage(null)
            void file
              .text()
              .then((text) => store.importWorkoutsCsv(text))
              .then((result) => {
                setImportMessage(
                  `Imported ${result.sessions} workout${result.sessions === 1 ? '' : 's'} (${result.sets} sets${
                    result.createdExercises > 0
                      ? `, ${result.createdExercises} new custom exercise${result.createdExercises === 1 ? '' : 's'}`
                      : ''
                  }).`,
                )
              })
              .catch((error: unknown) => {
                setImportError(error instanceof Error ? error.message : 'Could not import that file.')
              })
              .finally(() => setImportBusy(false))
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={importBusy}
          onClick={() => fileRef.current?.click()}
        >
          {importBusy ? 'Importing…' : 'Import workouts CSV'}
        </button>
        {importMessage ? <small className="badge badge--completed">{importMessage}</small> : null}
        {importError ? (
          <p className="field-error" role="alert">
            {importError}
          </p>
        ) : null}
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
