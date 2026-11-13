import { useEffect, useMemo, useState } from 'react'
import { fetchLatestAndroidRelease, isNewerAndroidRelease, type AndroidRelease } from '../lib/androidRelease'
import { sessionIdsWithHeartRate } from '../lib/db'
import { addDays, formatDateShort, todayKey } from '../lib/dates'
import {
  healthOriginKind,
  healthSessionId,
  healthWorkoutName,
  isLongHealthWorkout,
  planHealthImport,
  toHealthAerobic,
  toHealthImport,
  type HealthDestination,
  type HealthImportRow,
} from '../lib/healthConnect'
import { summarizeHeartRate } from '../lib/heartRate'
import {
  healthConnectStatus,
  isNativeApp,
  readHealthWorkouts,
  requestHealthPermissions,
} from '../lib/herkulesHealth'
import { aerobicActivityLabel, aerobicActivityTypes, bcp47, useT } from '../lib/i18n'
import { useStore } from '../lib/store'
import { formatDistance, formatDuration } from '../lib/units'
import { isAerobicActivityType, type AerobicActivityType } from '../types/db'
import { Modal } from './ui'
import './healthConnectImport.css'

const NEW = 'new'
const DAY_MS = 24 * 60 * 60 * 1000
const RANGES = [7, 14, 30] as const
type RangeDays = (typeof RANGES)[number]

interface Choice {
  selected: boolean
  destination: HealthDestination
  /** Session id for heart rate, or NEW. */
  target: string
  aerobicType: AerobicActivityType
}

export function AndroidUpdateNotice() {
  const { t } = useT()
  const [release, setRelease] = useState<AndroidRelease | null>(null)

  useEffect(() => {
    if (!isNativeApp()) return
    let alive = true
    // The app works without a release check; null means no notice.
    void fetchLatestAndroidRelease().then((latest) => {
      if (alive && latest && isNewerAndroidRelease(__HERKULES_VERSION__, latest.tag)) setRelease(latest)
    })
    return () => {
      alive = false
    }
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
  const [days, setDays] = useState<RangeDays>(7)
  const [rows, setRows] = useState<HealthImportRow[] | null>(null)
  const [withHeartRate, setWithHeartRate] = useState<Set<string>>(new Set())
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionsById = useMemo(() => new Map(store.sessions.map((session) => [session.id, session])), [store.sessions])

  const groups = useMemo(() => {
    const byDate = new Map<string, HealthImportRow[]>()
    for (const row of rows ?? []) {
      const list = byDate.get(row.date)
      if (list) list.push(row)
      else byDate.set(row.date, [row])
    }
    return [...byDate.entries()]
  }, [rows])

  if (!isNativeApp()) return null

  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString(bcp47(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const dayLabel = (date: string) => {
    const today = todayKey()
    const short = formatDateShort(date)
    if (date === today) return `${t('settings.healthToday')} · ${short}`
    if (date === addDays(today, -1)) return `${t('settings.healthYesterday')} · ${short}`
    return short
  }

  const originText = (pkg: string) => {
    const kind = healthOriginKind(pkg)
    if (kind === 'xiaomi') return t('settings.healthOriginXiaomi')
    if (kind === 'samsung') return t('settings.healthOriginSamsung')
    return pkg || t('settings.healthOriginOther')
  }

  const titleFor = (row: HealthImportRow) =>
    row.aerobicType === 'other' ? healthWorkoutName(row.workout.exerciseType) : aerobicActivityLabel(row.aerobicType)

  /** Nothing new to write for this destination. */
  const isDone = (row: HealthImportRow, choice: Choice, haveHeartRate: ReadonlySet<string>) =>
    choice.destination === 'aerobic'
      ? row.aerobicImported
      : choice.target !== NEW && haveHeartRate.has(choice.target)

  function update(key: string, patch: Partial<Choice>) {
    setChoices((prev) => {
      const current = prev.get(key)
      if (!current) return prev
      return new Map(prev).set(key, { ...current, ...patch })
    })
  }

  async function load(range: RangeDays) {
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
      const workouts = await readHealthWorkouts(end - range * DAY_MS, end)
      const planned = planHealthImport(workouts, store.sessions, store.aerobicActivities)
      const haveHeartRate = await sessionIdsWithHeartRate()
      const next = new Map<string, Choice>()
      for (const row of planned) {
        const choice: Choice = {
          selected: false,
          destination: row.defaultDestination,
          target: row.defaultTarget ?? NEW,
          aerobicType: row.aerobicType,
        }
        choice.selected = !isDone(row, choice, haveHeartRate) && !isLongHealthWorkout(row.workout)
        next.set(healthSessionId(row.workout), choice)
      }
      setDays(range)
      setRows(planned)
      setWithHeartRate(haveHeartRate)
      setChoices(next)
      setOpen(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('settings.healthReadFailed'))
    } finally {
      setBusy(false)
    }
  }

  const picked = (rows ?? []).filter((row) => choices.get(healthSessionId(row.workout))?.selected)
  const aerobicCount = picked.filter((row) => choices.get(healthSessionId(row.workout))?.destination === 'aerobic').length
  const sessionCount = picked.length - aerobicCount

  function selectAll(on: boolean) {
    setChoices((prev) => {
      const next = new Map<string, Choice>()
      for (const [key, choice] of prev) next.set(key, { ...choice, selected: on })
      return next
    })
  }

  async function runImport() {
    if (!rows) return
    setBusy(true)
    setError(null)
    try {
      const sessionItems: Parameters<typeof store.importSamsungWorkouts>[0] = []
      const aerobicItems: Parameters<typeof store.importAerobicActivities>[0] = []
      for (const row of picked) {
        const choice = choices.get(healthSessionId(row.workout))
        if (!choice) continue
        if (choice.destination === 'aerobic') {
          aerobicItems.push(toHealthAerobic(row.workout, choice.aerobicType))
        } else {
          sessionItems.push({
            parsed: toHealthImport(row.workout),
            targetSessionId: choice.target === NEW ? null : choice.target,
          })
        }
      }
      const aerobic = await store.importAerobicActivities(aerobicItems)
      const result =
        sessionItems.length > 0
          ? await store.importSamsungWorkouts(sessionItems)
          : { created: 0, linked: 0, skipped: 0 }
      setMessage(
        t('settings.healthImported', {
          aerobic,
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

  const renderRow = (row: HealthImportRow) => {
    const key = healthSessionId(row.workout)
    const choice = choices.get(key)
    if (!choice) return null
    const summary = summarizeHeartRate(row.workout.heartRate)
    const durationS = Math.round((row.workout.endMs - row.workout.startMs) / 1000)
    const minutes = Math.max(1, Math.round(durationS / 60))
    const long = isLongHealthWorkout(row.workout)
    const done = isDone(row, choice, withHeartRate)
    const checkId = `health-pick-${key}`
    const sportId = `health-sport-${key}`
    const targetId = `health-target-${key}`
    return (
      <li key={key} className={`hc-card${choice.selected ? ' hc-card--on' : ''}`}>
        <label className="hc-card__head" htmlFor={checkId}>
          <input
            id={checkId}
            type="checkbox"
            className="hc-card__check"
            checked={choice.selected}
            onChange={(event) => update(key, { selected: event.target.checked })}
          />
          <span className="hc-card__main">
            <span className="hc-card__title">
              <strong>{titleFor(row)}</strong>
              <span className="hc-card__time mono">
                {clock(row.workout.startMs)}–{clock(row.workout.endMs)}
              </span>
            </span>
            <span className="hc-card__stats mono">
              <span>{formatDuration(durationS)}</span>
              {row.workout.distanceM ? <span>{formatDistance(row.workout.distanceM, units)}</span> : null}
              {row.workout.caloriesKcal ? <span>{Math.round(row.workout.caloriesKcal)} kcal</span> : null}
            </span>
            <span className="hc-card__chips">
              {summary ? (
                <span className="badge hc-chip--heart">
                  {t('settings.healthHeartRate', { average: summary.average, peak: summary.peak })}
                </span>
              ) : (
                <span className="badge badge--neutral">{t('settings.healthNoHeartRate')}</span>
              )}
              <span className="badge badge--neutral">{originText(row.workout.origin)}</span>
              {done ? <span className="badge badge--completed">{t('settings.healthAlready')}</span> : null}
              {long ? <span className="badge badge--in-progress">{t('settings.healthLong')}</span> : null}
            </span>
          </span>
        </label>
        {choice.selected ? (
          <div className="hc-card__dest">
            <div className="hc-seg" role="radiogroup" aria-label={t('settings.healthSaveAs')}>
              {(['aerobic', 'session'] as const).map((destination) => (
                <button
                  key={destination}
                  type="button"
                  role="radio"
                  aria-checked={choice.destination === destination}
                  className={`hc-seg__option${choice.destination === destination ? ' hc-seg__option--on' : ''}`}
                  onClick={() => update(key, { destination })}
                >
                  {destination === 'aerobic' ? t('settings.healthAsAerobic') : t('settings.healthAsSession')}
                </button>
              ))}
            </div>
            {choice.destination === 'aerobic' ? (
              <>
                <label className="field" htmlFor={sportId}>
                  <span>{t('settings.healthSport')}</span>
                  <select
                    id={sportId}
                    className="input"
                    value={choice.aerobicType}
                    onChange={(event) => {
                      const value = event.target.value
                      if (isAerobicActivityType(value)) update(key, { aerobicType: value })
                    }}
                  >
                    {aerobicActivityTypes().map((value) => (
                      <option key={value} value={value}>
                        {aerobicActivityLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <small className="muted">
                  {t('settings.healthAerobicPreview', { minutes, date: formatDateShort(row.date) })}
                  {summary ? ` ${t('settings.healthAerobicHeartRate')}` : ''}
                </small>
              </>
            ) : (
              <label className="field" htmlFor={targetId}>
                <span>{t('settings.samsungTarget')}</span>
                <select
                  id={targetId}
                  className="input"
                  value={choice.target}
                  onChange={(event) => update(key, { target: event.target.value })}
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
                      {sessionsById.get(row.defaultTarget)?.name ?? t('settings.healthAlready')}
                    </option>
                  ) : null}
                </select>
              </label>
            )}
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => void load(days)}>
        {busy && !open ? t('settings.healthReading') : t('settings.healthImport')}
      </button>
      <small className="muted">{t('settings.healthHint')}</small>
      {message ? <p role="status">{message}</p> : null}
      {error && !open ? <p role="alert">{error}</p> : null}
      {open && rows ? (
        <Modal title={t('settings.healthTitle')} onClose={() => setOpen(false)} className="hc-import">
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              {t('settings.healthBody')}
            </p>
            <div className="hc-seg" role="radiogroup" aria-label={t('settings.healthRange')}>
              {RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  role="radio"
                  aria-checked={days === range}
                  disabled={busy}
                  className={`hc-seg__option${days === range ? ' hc-seg__option--on' : ''}`}
                  onClick={() => {
                    if (range !== days) void load(range)
                  }}
                >
                  {t('settings.healthRangeDays', { days: range })}
                </button>
              ))}
            </div>
            {error ? <p role="alert" style={{ margin: 0 }}>{error}</p> : null}
            {busy ? (
              <p className="muted" role="status" style={{ margin: 0 }}>
                {t('settings.healthReading')}
              </p>
            ) : rows.length === 0 ? (
              <div className="hc-empty">
                <strong>{t('settings.healthEmpty', { days })}</strong>
                <small className="muted">{t('settings.healthEmptyHint')}</small>
                <small className="muted">{t('settings.healthRefresh')}</small>
              </div>
            ) : (
              <>
                <div className="row row--between hc-toolbar">
                  <small className="muted">
                    {t('settings.healthSelectedCount', { count: picked.length, total: rows.length })}
                  </small>
                  <span className="row">
                    <button type="button" className="btn btn--small" onClick={() => selectAll(true)}>
                      {t('settings.healthSelectAll')}
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => selectAll(false)}>
                      {t('settings.healthSelectNone')}
                    </button>
                  </span>
                </div>
                {groups.map(([date, dayRows]) => (
                  <section key={date} className="hc-day" aria-label={dayLabel(date)}>
                    <h3 className="hc-day__title">{dayLabel(date)}</h3>
                    <ul className="hc-list">{dayRows.map(renderRow)}</ul>
                  </section>
                ))}
                <small className="muted">{t('settings.healthRefresh')}</small>
              </>
            )}
            {rows.length > 0 ? (
              <div className="hc-footer">
                <small className="muted">
                  {t('settings.healthImportBreakdown', { aerobic: aerobicCount, sessions: sessionCount })}
                </small>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy || picked.length === 0}
                  onClick={() => void runImport()}
                >
                  {t('settings.healthImportButton', { count: picked.length })}
                </button>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  )
}
