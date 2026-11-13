import { useEffect, useMemo, useState } from 'react'
import {
  isNewerAndroidRelease,
  parseAndroidRelease,
  type AndroidRelease,
  type ReleasePayload,
} from '../lib/androidRelease'
import { sessionIdsWithHeartRate } from '../lib/db'
import {
  healthOriginKind,
  healthSessionId,
  healthWorkoutName,
  isLongHealthWorkout,
  planHealthImport,
  toHealthImport,
  type HealthImportRow,
} from '../lib/healthConnect'
import { summarizeHeartRate } from '../lib/heartRate'
import {
  healthConnectStatus,
  isNativeApp,
  readHealthWorkouts,
  requestHealthPermissions,
} from '../lib/herkulesHealth'
import { bcp47, useT } from '../lib/i18n'
import { useStore } from '../lib/store'
import { formatDistance, formatDuration } from '../lib/units'
import { Modal } from './ui'
import './samsungHealthImport.css'

const NEW = 'new'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const RELEASES_URL = 'https://api.github.com/repos/mlsivanovic/Herkules/releases?per_page=20'

export function AndroidUpdateNotice() {
  const { t } = useT()
  const [release, setRelease] = useState<AndroidRelease | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return
    const current = __HERKULES_VERSION__
    void fetch(RELEASES_URL)
      .then((response) => (response.ok ? (response.json() as Promise<ReleasePayload[]>) : []))
      .then((payloads) => {
        for (const payload of payloads) {
          const parsed = parseAndroidRelease(payload)
          if (parsed && isNewerAndroidRelease(current, parsed.tag)) {
            setRelease(parsed)
            return
          }
        }
      })
      .catch(() => {
        /* The app works without a release check. */
      })
  }, [])

  if (!release) return null
  return (
    <p className="muted" style={{ margin: 0 }}>
      {t('settings.androidUpdate', { tag: release.tag })}{' '}
      <a href={release.url}>{t('settings.androidUpdateAction')}</a>
    </p>
  )
}

export function HealthConnectImport() {
  const { t } = useT()
  const store = useStore()
  const units = store.profile?.unit_system ?? 'metric'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<HealthImportRow[] | null>(null)
  const [withHeartRate, setWithHeartRate] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Map<string, string>>(new Map())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionsById = useMemo(() => new Map(store.sessions.map((session) => [session.id, session])), [store.sessions])

  if (!isNativeApp()) return null

  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString(bcp47(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const originText = (pkg: string) => {
    const kind = healthOriginKind(pkg)
    if (kind === 'xiaomi') return t('settings.healthOriginXiaomi')
    if (kind === 'samsung') return t('settings.healthOriginSamsung')
    return pkg || t('settings.healthOriginOther')
  }

  async function load() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const status = await healthConnectStatus()
      if (status === 'unavailable') throw new Error(t('settings.healthUnavailable'))
      if (status === 'update_required') throw new Error(t('settings.healthUpdateRequired'))
      const granted = await requestHealthPermissions()
      if (!granted) throw new Error(t('settings.healthDenied'))
      const end = Date.now()
      const workouts = await readHealthWorkouts(end - WEEK_MS, end)
      const planned = planHealthImport(workouts, store.sessions)
      const haveHeartRate = await sessionIdsWithHeartRate()
      const nextTargets = new Map<string, string>()
      const nextSelected = new Set<string>()
      for (const row of planned) {
        const key = healthSessionId(row.workout)
        nextTargets.set(key, row.defaultTarget ?? NEW)
        const target = row.defaultTarget
        const blocked = target !== null && haveHeartRate.has(target)
        if (!blocked && !isLongHealthWorkout(row.workout)) nextSelected.add(key)
      }
      setRows(planned)
      setWithHeartRate(haveHeartRate)
      setTargets(nextTargets)
      setSelected(nextSelected)
      setOpen(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('settings.healthReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!rows) return
    setBusy(true)
    setError(null)
    try {
      const items = rows
        .filter((row) => selected.has(healthSessionId(row.workout)))
        .map((row) => {
          const key = healthSessionId(row.workout)
          const target = targets.get(key) ?? NEW
          return {
            parsed: toHealthImport(row.workout),
            targetSessionId: target === NEW ? null : target,
          }
        })
      const result = await store.importSamsungWorkouts(items)
      setMessage(
        t('settings.samsungImported', {
          created: result.created,
          linked: result.linked,
          skipped: result.skipped,
        }),
      )
      setOpen(false)
      setRows(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('settings.healthReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
        {busy ? t('settings.importing') : t('settings.healthImport')}
      </button>
      <small className="muted">{t('settings.healthHint')}</small>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {open && rows ? (
        <Modal title={t('settings.healthTitle')} onClose={() => setOpen(false)}>
          <div className="stack">
            <p style={{ margin: 0 }}>{t('settings.healthBody')}</p>
            <p className="muted" style={{ margin: 0 }}>
              {t('settings.healthRefresh')}
            </p>
            {rows.length === 0 ? <p className="muted">{t('settings.healthEmpty')}</p> : null}
            <ul className="samsung-import__list">
              {rows.map((row) => {
                const key = healthSessionId(row.workout)
                const summary = summarizeHeartRate(row.workout.heartRate)
                const target = targets.get(key) ?? NEW
                const selectId = `health-target-${key}`
                return (
                  <li key={key} className="samsung-import__item">
                    <label className="samsung-import__row">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={(event) => {
                          const on = event.target.checked
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (on) next.add(key)
                            else next.delete(key)
                            return next
                          })
                        }}
                      />
                      <span className="samsung-import__body">
                        <strong>
                          {healthWorkoutName(row.workout.exerciseType)} · {clock(row.workout.startMs)}–
                          {clock(row.workout.endMs)}
                        </strong>
                        <span className="muted">
                          {originText(row.workout.origin)}
                          {' · '}
                          {formatDuration(Math.round((row.workout.endMs - row.workout.startMs) / 1000))}
                          {row.workout.distanceM ? ` · ${formatDistance(row.workout.distanceM, units)}` : ''}
                        </span>
                        <span className="muted">
                          {summary
                            ? t('settings.samsungHeartRate', { average: summary.average, peak: summary.peak })
                            : t('settings.samsungHeartRateMissing')}
                          {isLongHealthWorkout(row.workout) ? ` · ${t('settings.samsungLong')}` : ''}
                          {row.alreadyImported ? ` · ${t('settings.samsungAlready')}` : ''}
                        </span>
                      </span>
                    </label>
                    <label className="field" htmlFor={selectId}>
                      <span>{t('settings.samsungTarget')}</span>
                      <select
                        id={selectId}
                        value={target}
                        onChange={(event) => {
                          const value = event.target.value
                          setTargets((prev) => new Map(prev).set(key, value))
                        }}
                      >
                        <option value={NEW}>{t('settings.samsungTargetNew')}</option>
                        {row.options.map((option) => {
                          const name = sessionsById.get(option.id)?.name ?? '—'
                          const tag = withHeartRate.has(option.id) ? ` ${t('settings.samsungHasHeartRateTag')}` : ''
                          return (
                            <option key={option.id} value={option.id}>
                              {t('settings.samsungTargetOption', {
                                name,
                                start: clock(option.startMs),
                                end: clock(option.endMs),
                              })}
                              {tag}
                            </option>
                          )
                        })}
                        {row.defaultTarget && !row.options.some((option) => option.id === row.defaultTarget) ? (
                          <option value={row.defaultTarget}>
                            {sessionsById.get(row.defaultTarget)?.name ?? t('settings.samsungAlready')}
                          </option>
                        ) : null}
                      </select>
                    </label>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="btn btn--primary" disabled={busy || selected.size === 0} onClick={() => void runImport()}>
              {t('settings.samsungImportSelected', { count: selected.size })}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
