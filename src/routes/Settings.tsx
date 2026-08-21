// Settings: collapsible groups for profile, preferences, body weight, sync,
// data (CSV/JSON import/export/backup), password and sign-out.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { todayKey } from '../lib/dates'
import { parseExternalCsv } from '../lib/importExternal'
import {
  downloadTextFile,
  formatRoutineImportMessage,
  routinesExportFilename,
} from '../lib/routinesIo'
import {
  ageYears,
  bodyMassIndex,
  formatWeight,
  heightForInput,
  heightToCm,
  heightUnitLabel,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { parseNonNegative } from '../lib/validation'
import { setSoundEnabled, setVibrationEnabled, soundEnabled, vibrationEnabled } from '../lib/cues'
import { useTheme, type ThemePreference } from '../lib/theme'
import { bcp47, useLocale, useT, type LocalePreference } from '../lib/i18n'
import type { Sex } from '../types/db'
import { LineChart } from '../components/Chart'
import { IconChevronDown } from '../components/Icons'
import { Modal } from '../components/ui'
import './settings.css'

const SETTINGS_PANES = ['profile', 'preferences', 'weight', 'sync', 'data', 'account'] as const
type SettingsPane = (typeof SETTINGS_PANES)[number]
const SETTINGS_OPEN_KEY = 'herkules:settings-open'

function readOpenPane(): SettingsPane | null {
  try {
    const stored = sessionStorage.getItem(SETTINGS_OPEN_KEY)
    if (stored && (SETTINGS_PANES as readonly string[]).includes(stored)) {
      return stored as SettingsPane
    }
  } catch {
    /* private mode */
  }
  return null
}

function persistOpenPane(pane: SettingsPane | null) {
  try {
    if (pane) sessionStorage.setItem(SETTINGS_OPEN_KEY, pane)
    else sessionStorage.removeItem(SETTINGS_OPEN_KEY)
  } catch {
    /* private mode */
  }
}

function joinSummary(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ')
}

function SettingsSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: SettingsPane
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      <div className="card settings-section__card">
        <h2 className="settings-section__heading">
          <button
            type="button"
            className="settings-section__toggle"
            data-settings-section={id}
            aria-expanded={open}
            aria-controls={`settings-panel-${id}`}
            onClick={onToggle}
          >
            <span className="settings-section__copy">
              <span className="settings-section__title">{title}</span>
              <span className="settings-section__summary">{summary}</span>
            </span>
            <IconChevronDown className="settings-section__chevron" width={20} height={20} />
          </button>
        </h2>
        {open ? (
          <div id={`settings-panel-${id}`} className="stack settings-section__body">
            {children}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function Settings() {
  const { t } = useT()
  const navigate = useNavigate()
  const store = useStore()
  const { session } = useAuth()
  const profile = store.profile
  const { preference, setPreference } = useTheme()
  const { preference: localePreference, setPreference: setLocalePreference } = useLocale()
  const [cueSound, setCueSound] = useState(() => soundEnabled())
  const [cueVibration, setCueVibration] = useState(() => vibrationEnabled())
  const [openPane, setOpenPane] = useState<SettingsPane | null>(readOpenPane)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [weightDate, setWeightDate] = useState(todayKey())
  const [weightBusy, setWeightBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const externalFileRef = useRef<HTMLInputElement>(null)
  const backupFileRef = useRef<HTMLInputElement>(null)
  const routinesFileRef = useRef<HTMLInputElement>(null)
  const [externalPreview, setExternalPreview] = useState<{
    text: string
    sessions: number
    sets: number
    exercises: number
  } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [routinesBusy, setRoutinesBusy] = useState(false)
  const [routinesMessage, setRoutinesMessage] = useState<string | null>(null)
  const [routinesError, setRoutinesError] = useState<string | null>(null)
  const units = profile?.unit_system ?? 'metric'
  const weights = useMemo(
    () => [...store.bodyWeights].sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1)),
    [store.bodyWeights],
  )
  const latestWeight = weights[0] ?? null
  const bmi =
    latestWeight && profile?.height_cm
      ? bodyMassIndex(latestWeight.weight_kg, profile.height_cm)
      : null
  const savedTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!openPane) return
    const section = document.getElementById(`settings-panel-${openPane}`)?.closest('.settings-section')
    section?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [openPane])

  function togglePane(id: SettingsPane) {
    setOpenPane((current) => {
      const next = current === id ? null : id
      persistOpenPane(next)
      return next
    })
  }

  async function saveProfile() {
    try {
      await store.updateProfile({ display_name: displayName })
      setSaveError(null)
      setSaved(true)
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
    } catch (caught) {
      setSaved(false)
      setSaveError(caught instanceof Error ? caught.message : t('errors.saveProfile'))
    }
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
    setLogoutError(t('settings.logoutSyncFail'))
  }

  function requestLogout() {
    if (store.pending > 0 && !store.online) {
      setLogoutConfirm(true)
      return
    }
    void handleLogout()
  }

  const age =
    profile?.birth_date != null
      ? t('settings.years', { n: ageYears(profile.birth_date, todayKey()) })
      : null
  const heightSummary =
    profile?.height_cm != null
      ? `${heightForInput(profile.height_cm, units)} ${heightUnitLabel(units)}`
      : null
  const restSeconds = profile?.default_rest_seconds ?? 90
  const syncSummary = store.syncing
    ? t('sync.syncingEllipsis')
    : store.pending > 0
      ? store.pending === 1
        ? t('sync.waitingOne', { count: store.pending })
        : t('sync.waitingOther', { count: store.pending })
      : t('sync.saved')

  return (
    <div>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
      </div>

      <SettingsSection
        id="profile"
        title={t('settings.profile')}
        summary={
          joinSummary([
            displayName.trim() || null,
            age,
            heightSummary,
            session?.user.email,
          ]) || t('settings.profileSummary')
        }
        open={openPane === 'profile'}
        onToggle={() => togglePane('profile')}
      >
        <div className="field">
          <label htmlFor="settings-name">{t('settings.displayName')}</label>
          <input
            id="settings-name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => void saveProfile()}
          />
        </div>
        <div className="settings-fields">
          <div className="field">
            <label htmlFor="settings-sex">{t('settings.sex')}</label>
            <select
              id="settings-sex"
              className="input"
              value={profile?.sex ?? ''}
              onChange={(e) => {
                const value = e.target.value
                void store.updateProfile({
                  sex: value === '' ? null : (value as Sex),
                })
              }}
            >
              <option value="">{t('settings.preferNot')}</option>
              <option value="male">{t('settings.male')}</option>
              <option value="female">{t('settings.female')}</option>
              <option value="other">{t('settings.other')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-birth">{t('settings.birth')}</label>
            <input
              id="settings-birth"
              className="input"
              type="date"
              max={todayKey()}
              value={profile?.birth_date ?? ''}
              onChange={(e) =>
                void store.updateProfile({
                  birth_date: e.target.value === '' ? null : e.target.value,
                })
              }
            />
            {profile?.birth_date ? (
              <small className="muted">
                {t('settings.yearsOld', { n: ageYears(profile.birth_date, todayKey()) })}
              </small>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="settings-height">
            {t('settings.height', { unit: heightUnitLabel(profile?.unit_system ?? 'metric') })}
          </label>
          <input
            id="settings-height"
            className="input"
            type="number"
            min={0}
            step="0.1"
            value={heightForInput(profile?.height_cm ?? null, profile?.unit_system ?? 'metric')}
            onChange={(e) => {
              const parsed = parseNonNegative(e.target.value)
              void store.updateProfile({
                height_cm:
                  parsed === null
                    ? null
                    : heightToCm(parsed, profile?.unit_system ?? 'metric'),
              })
            }}
          />
        </div>
        <small className="muted">{t('settings.signedInAs', { email: session?.user.email ?? '' })}</small>
        {saved ? <small className="badge badge--completed">{t('common.saved')}</small> : null}
        {saveError ? (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        id="preferences"
        title={t('settings.preferences')}
        summary={joinSummary([
          t(localePreference === 'sr' ? 'language.sr' : localePreference === 'en' ? 'language.en' : 'language.system'),
          t(preference === 'light' ? 'theme.light' : preference === 'dark' ? 'theme.dark' : 'theme.system'),
          units === 'imperial' ? t('units.imperial') : t('units.metric'),
          (profile?.week_start ?? 'monday') === 'sunday' ? t('weekdays.sunday') : t('weekdays.monday'),
          t('settings.restSummary', { n: restSeconds }),
          cueSound ? null : t('settings.soundOff'),
          cueVibration ? null : t('settings.vibrationOff'),
        ])}
        open={openPane === 'preferences'}
        onToggle={() => togglePane('preferences')}
      >
        <div className="settings-fields">
          <div className="field">
            <label htmlFor="settings-language">{t('language.label')}</label>
            <select
              id="settings-language"
              className="input"
              value={localePreference}
              onChange={(e) => setLocalePreference(e.target.value as LocalePreference)}
            >
              <option value="system">{t('language.system')}</option>
              <option value="en">{t('language.en')}</option>
              <option value="sr">{t('language.sr')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-theme">{t('settings.theme')}</label>
            <select
              id="settings-theme"
              className="input"
              value={preference}
              onChange={(e) => setPreference(e.target.value as ThemePreference)}
            >
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
              <option value="system">{t('theme.system')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-units">{t('settings.units')}</label>
            <select
              id="settings-units"
              className="input"
              value={profile?.unit_system ?? 'metric'}
              onChange={(e) =>
                void store.updateProfile({ unit_system: e.target.value as 'metric' | 'imperial' })
              }
            >
              <option value="metric">{t('units.metricFull')}</option>
              <option value="imperial">{t('units.imperialFull')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-week">{t('settings.weekStarts')}</label>
            <select
              id="settings-week"
              className="input"
              value={profile?.week_start ?? 'monday'}
              onChange={(e) =>
                void store.updateProfile({ week_start: e.target.value as 'monday' | 'sunday' })
              }
            >
              <option value="monday">{t('weekdays.monday')}</option>
              <option value="sunday">{t('weekdays.sunday')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-rest">{t('settings.defaultRest')}</label>
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
          <div className="field">
            <label htmlFor="settings-cue-sound">{t('settings.restSound')}</label>
            <select
              id="settings-cue-sound"
              className="input"
              value={cueSound ? 'on' : 'off'}
              onChange={(e) => {
                const enabled = e.target.value === 'on'
                setCueSound(enabled)
                setSoundEnabled(enabled)
              }}
            >
              <option value="on">{t('settings.onBeep')}</option>
              <option value="off">{t('settings.off')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="settings-cue-vibration">{t('settings.restVibration')}</label>
            <select
              id="settings-cue-vibration"
              className="input"
              value={cueVibration ? 'on' : 'off'}
              onChange={(e) => {
                const enabled = e.target.value === 'on'
                setCueVibration(enabled)
                setVibrationEnabled(enabled)
              }}
            >
              <option value="on">{t('settings.onVibrate')}</option>
              <option value="off">{t('settings.off')}</option>
            </select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        id="weight"
        title={t('settings.bodyWeight')}
        summary={
          latestWeight
            ? joinSummary([
                formatWeight(latestWeight.weight_kg, units),
                latestWeight.recorded_on,
                bmi !== null ? t('settings.bmi', { n: bmi }) : null,
              ])
            : t('settings.logWeighIn')
        }
        open={openPane === 'weight'}
        onToggle={() => togglePane('weight')}
      >
        {latestWeight ? (
          <p style={{ margin: 0 }}>
            {t('settings.latest')} <strong>{formatWeight(latestWeight.weight_kg, units)}</strong>
            <small className="muted"> · {latestWeight.recorded_on}</small>
            {bmi !== null ? <small className="muted"> · {t('settings.bmi', { n: bmi })}</small> : null}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {t('settings.firstWeighIn')}
          </p>
        )}
        <div className="settings-fields">
          <div className="field">
            <label htmlFor="settings-weight-date">{t('common.date')}</label>
            <input
              id="settings-weight-date"
              className="input"
              type="date"
              max={todayKey()}
              value={weightDate}
              onChange={(e) => {
                const next = e.target.value || todayKey()
                setWeightDate(next)
                const existing = store.bodyWeights.find((row) => row.recorded_on === next)
                setWeightInput(existing ? weightForInput(existing.weight_kg, units) : '')
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="settings-weight">
              {t('checkin.weight', { unit: weightUnitLabel(units) })}
            </label>
            <input
              id="settings-weight"
              className="input"
              type="number"
              min={0}
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={weightBusy}
          onClick={() => {
            const parsed = parseNonNegative(weightInput)
            if (parsed === null || parsed === 0) return
            setWeightBusy(true)
            void store
              .logWeight(weightDate, weightToKg(parsed, units))
              .then(() => setWeightInput(''))
              .finally(() => setWeightBusy(false))
          }}
        >
          {weightBusy ? t('common.saving') : t('checkin.saveWeighIn')}
        </button>
        {weights.length > 1 ? (
          <LineChart
            points={[...weights].reverse().map((row) => ({
              label: row.recorded_on.slice(5),
              value: row.weight_kg,
            }))}
            formatValue={(value) => formatWeight(value, units)}
            ariaLabel={t('progress.bodyWeightAria')}
          />
        ) : null}
        {weights.length > 0 ? (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {weights.slice(0, 3).map((row) => (
              <li key={row.id} className="row row--between">
                <span>
                  {row.recorded_on} · {formatWeight(row.weight_kg, units)}
                </span>
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  aria-label={t('checkin.deleteWeighIn', { date: row.recorded_on })}
                  onClick={() => void store.deleteWeight(row.id)}
                >
                  {t('common.delete')}
                </button>
              </li>
            ))}
            {weights.length > 3 ? (
              <li className="settings-older">
                <details>
                  <summary>{t('settings.older', { n: Math.min(weights.length - 3, 5) })}</summary>
                  <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                    {weights.slice(3, 8).map((row) => (
                      <li key={row.id} className="row row--between">
                        <span>
                          {row.recorded_on} · {formatWeight(row.weight_kg, units)}
                        </span>
                        <button
                          type="button"
                          className="btn btn--small btn--danger"
                          aria-label={t('checkin.deleteWeighIn', { date: row.recorded_on })}
                          onClick={() => void store.deleteWeight(row.id)}
                        >
                          {t('common.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ) : null}
          </ul>
        ) : null}
      </SettingsSection>

      <SettingsSection
        id="sync"
        title={t('settings.sync')}
        summary={joinSummary([store.online ? t('sync.online') : t('sync.offline'), syncSummary])}
        open={openPane === 'sync'}
        onToggle={() => togglePane('sync')}
      >
        <div className="row row--between">
          <span>{store.online ? t('sync.online') : t('sync.offline')}</span>
          <span className="muted">{syncSummary}</span>
        </div>
        {store.lastSyncedAt ? (
          <small className="muted">
            {t('sync.lastSync', {
              when: new Date(store.lastSyncedAt).toLocaleString(bcp47(), {
                hour: 'numeric',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              }),
            })}
          </small>
        ) : (
          <small className="muted">{t('sync.never')}</small>
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
          {syncBusy ? t('sync.retrying') : t('sync.retry')}
        </button>
      </SettingsSection>

      <SettingsSection
        id="data"
        title={t('settings.data')}
        summary={t('settings.dataSummary')}
        open={openPane === 'data'}
        onToggle={() => togglePane('data')}
      >
        <div className="settings-group">
          <h3 className="settings-group__title">{t('settings.workouts')}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {t('settings.csvHint')}
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
            {t('settings.exportCsv')}
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
                    t('settings.importedWorkouts', {
                      sessions: result.sessions,
                      sets: result.sets,
                      extra:
                        result.createdExercises > 0
                          ? t('settings.importedExtra', { count: result.createdExercises })
                          : '',
                    }),
                  )
                })
                .catch((error: unknown) => {
                  setImportError(error instanceof Error ? error.message : t('errors.importFile'))
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
            {importBusy ? t('settings.importing') : t('settings.importCsv')}
          </button>
          {importMessage ? <small className="badge badge--completed">{importMessage}</small> : null}
          {importError ? (
            <p className="field-error" role="alert">
              {importError}
            </p>
          ) : null}
          <input
            ref={externalFileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setImportError(null)
              setImportMessage(null)
              void file
                .text()
                .then((text) => {
                  const parsed = parseExternalCsv(text)
                  if (parsed.length === 0) throw new Error('No workouts found in that file.')
                  setExternalPreview({
                    text,
                    sessions: parsed.length,
                    sets: parsed.reduce((sum, s) => sum + s.exercises.reduce((n, e) => n + e.sets.length, 0), 0),
                    exercises: new Set(parsed.flatMap((s) => s.exercises.map((e) => e.name))).size,
                  })
                })
                .catch((error: unknown) => {
                  setImportError(error instanceof Error ? error.message : t('errors.readFile'))
                })
            }}
          />
          <button type="button" className="btn" onClick={() => externalFileRef.current?.click()}>
            {t('settings.importStrong')}
          </button>
          <small className="muted">{t('settings.importStrongHint')}</small>
        </div>

        <div className="settings-group">
          <h3 className="settings-group__title">{t('settings.routines')}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {t('settings.routinesHint')}
          </p>
          <button
            type="button"
            className="btn"
            disabled={routinesBusy || store.templates.length === 0}
            onClick={() => {
              setRoutinesBusy(true)
              setRoutinesError(null)
              setRoutinesMessage(null)
              void store
                .exportRoutines()
                .then((json) => {
                  downloadTextFile(routinesExportFilename(), json, 'application/json')
                  setRoutinesMessage(
                    store.templates.length === 1
                      ? t('routines.exportedOne', { count: store.templates.length })
                      : t('routines.exportedOther', { count: store.templates.length }),
                  )
                })
                .catch((error: unknown) => {
                  setRoutinesError(
                    error instanceof Error ? error.message : t('errors.exportRoutines'),
                  )
                })
                .finally(() => setRoutinesBusy(false))
            }}
          >
            {routinesBusy ? t('settings.preparing') : t('settings.exportRoutines')}
          </button>
          <input
            ref={routinesFileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setRoutinesBusy(true)
              setRoutinesError(null)
              setRoutinesMessage(null)
              void file
                .text()
                .then((text) => store.importRoutines(text))
                .then((result) => {
                  setRoutinesMessage(formatRoutineImportMessage(result))
                })
                .catch((error: unknown) => {
                  setRoutinesError(
                    error instanceof Error ? error.message : t('errors.importFile'),
                  )
                })
                .finally(() => setRoutinesBusy(false))
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={routinesBusy}
            onClick={() => routinesFileRef.current?.click()}
          >
            {routinesBusy ? t('settings.importing') : t('settings.importRoutines')}
          </button>
          {routinesMessage ? (
            <small className="badge badge--completed">{routinesMessage}</small>
          ) : null}
          {routinesError ? (
            <p className="field-error" role="alert">
              {routinesError}
            </p>
          ) : null}
        </div>

        <div className="settings-group">
          <h3 className="settings-group__title">{t('settings.backup')}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {t('settings.backupHint')}
          </p>
          <button
            type="button"
            className="btn"
            disabled={backupBusy}
            onClick={() => {
              setBackupBusy(true)
              setBackupError(null)
              setBackupMessage(null)
              void store
                .exportBackup()
                .then((json) => {
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `herkules-backup-${new Date().toISOString().slice(0, 10)}.json`
                  link.click()
                  URL.revokeObjectURL(url)
                })
                .catch((error: unknown) => {
                  setBackupError(error instanceof Error ? error.message : t('errors.createBackup'))
                })
                .finally(() => setBackupBusy(false))
            }}
          >
            {backupBusy ? t('settings.preparing') : t('settings.exportBackup')}
          </button>
          <input
            ref={backupFileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBackupBusy(true)
              setBackupError(null)
              setBackupMessage(null)
              void file
                .text()
                .then((text) => store.restoreBackup(text))
                .then((result) => {
                  setBackupMessage(
                    t('settings.restored', {
                      sessions: result.sessions,
                      templates: result.templates,
                      exercises: result.exercises,
                      checkins: result.checkins,
                    }),
                  )
                })
                .catch((error: unknown) => {
                  setBackupError(error instanceof Error ? error.message : t('errors.restoreFile'))
                })
                .finally(() => setBackupBusy(false))
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={backupBusy}
            onClick={() => backupFileRef.current?.click()}
          >
            {backupBusy ? t('settings.restoring') : t('settings.restoreBackup')}
          </button>
          {backupMessage ? <small className="badge badge--completed">{backupMessage}</small> : null}
          {backupError ? (
            <p className="field-error" role="alert">
              {backupError}
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        id="account"
        title={t('settings.account')}
        summary={session?.user.email ?? t('settings.accountSummary')}
        open={openPane === 'account'}
        onToggle={() => togglePane('account')}
      >
        <button
          type="button"
          className="btn"
          onClick={() => void navigate('/update-password')}
        >
          {t('auth.changePassword')}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={requestLogout}
          disabled={logoutBusy}
        >
          {logoutBusy ? t('auth.signingOut') : t('auth.signOut')}
        </button>
        {logoutError ? (
          <p className="field-error" role="alert">
            {logoutError}
          </p>
        ) : null}
      </SettingsSection>

      <p className="muted" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        {t('brand.tagline')}
      </p>

      {logoutConfirm ? (
        <Modal title={t('settings.discardTitle')} onClose={() => setLogoutConfirm(false)}>
          <p>{t('settings.discardBody', { count: store.pending })}</p>
          <div className="stack">
            <button type="button" className="btn btn--danger btn--block" onClick={() => void handleLogout()}>
              {t('settings.discardSignOut')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setLogoutConfirm(false)}>
              {t('settings.stay')}
            </button>
          </div>
        </Modal>
      ) : null}

      {externalPreview ? (
        <Modal title={t('settings.importStrongTitle')} onClose={() => setExternalPreview(null)}>
          <p>
            {t('settings.importStrongBody', {
              sessions: externalPreview.sessions,
              sets: externalPreview.sets,
              exercises: externalPreview.exercises,
            })}
          </p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                const text = externalPreview.text
                setExternalPreview(null)
                setImportBusy(true)
                void store
                  .importExternalCsv(text)
                  .then((result) => {
                    setImportMessage(
                      t('settings.importedWorkouts', {
                        sessions: result.sessions,
                        sets: result.sets,
                        extra:
                          result.createdExercises > 0
                            ? t('settings.importedExtra', { count: result.createdExercises })
                            : '',
                      }),
                    )
                  })
                  .catch((error: unknown) => {
                    setImportError(error instanceof Error ? error.message : t('errors.importFile'))
                  })
                  .finally(() => setImportBusy(false))
              }}
            >
              {t('settings.importWorkouts')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setExternalPreview(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
