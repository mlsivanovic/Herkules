import './samsungHealthImport.css'
import { useMemo, useRef, useState } from 'react'
import type { ParsedWorkoutImport } from '../lib/csv'
import { formatDateCompact, toDateKey } from '../lib/dates'
import { sessionIdsWithHeartRate } from '../lib/db'
import { bcp47, useT } from '../lib/i18n'
import {
  isLongWorkout,
  isSamsungExerciseCsv,
  linkCandidates,
  matchesHeartRateFile,
  parseSamsungExerciseCsv,
  parseSamsungHeartRate,
  samsungSessionId,
  selectedByDefault,
  sessionWindow,
  toWorkoutImport,
  XIAOMI_SOURCE,
  type SamsungWorkout,
  type SessionWindow,
} from '../lib/samsungHealth'
import { useStore } from '../lib/store'
import { formatDuration } from '../lib/units'
import type { SessionDoc } from '../types/db'
import { Modal } from './ui'

const PHONE_SOURCE = 'com.sec.android.app.shealth'
const ALL = 'all'
/** Target value for "save as a new gym session". */
const NEW = 'new'

interface Row {
  workout: SamsungWorkout
  /** Earlier standalone import of this same Samsung record, if any. */
  alreadyImported: boolean
  hasFile: boolean
  /** Herkules sessions to link to, best match first. */
  options: SessionWindow[]
}

interface Loaded {
  rows: Row[]
  heartRateFiles: File[]
  withHeartRate: Set<string>
}

async function findExerciseCsv(files: File[]): Promise<SamsungWorkout[]> {
  for (const file of files) {
    if (/\.json$/i.test(file.name)) continue
    // Only the exercise CSV qualifies; peek at its first line before reading it all.
    if (!isSamsungExerciseCsv(await file.slice(0, 64).text())) continue
    return parseSamsungExerciseCsv(await file.text())
  }
  return []
}

function buildRows(workouts: SamsungWorkout[], heartRateFiles: File[], sessions: SessionDoc[]): Row[] {
  const sessionIds = new Set(sessions.map((s) => s.id))
  const importIds = new Set(workouts.map((w) => samsungSessionId(w.uuid)))
  // Standalone sessions from earlier Samsung imports are not link targets.
  const windows = sessions
    .filter((s) => !importIds.has(s.id))
    .map(sessionWindow)
    .filter((w): w is SessionWindow => w !== null)
  return workouts.map((workout) => {
    const near = linkCandidates(workout, windows)
    const sameDay = windows
      .filter((w) => toDateKey(new Date(w.startMs)) === workout.localDate && !near.includes(w))
      .sort((a, b) => a.startMs - b.startMs)
    return {
      workout,
      alreadyImported: sessionIds.has(samsungSessionId(workout.uuid)),
      hasFile: heartRateFiles.some((f) => matchesHeartRateFile(workout, f.name)),
      options: [...near, ...sameDay],
    }
  })
}

export function SamsungHealthImport() {
  const { t } = useT()
  const store = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [source, setSource] = useState(ALL)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Map<string, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionsById = useMemo(() => new Map(store.sessions.map((s) => [s.id, s])), [store.sessions])
  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { workout } of loaded?.rows ?? []) {
      counts.set(workout.source, (counts.get(workout.source) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [loaded])
  const visible = (loaded?.rows ?? []).filter((r) => source === ALL || r.workout.source === source)

  const sourceLabel = (pkg: string) =>
    pkg === XIAOMI_SOURCE ? t('settings.samsungSourceXiaomi')
      : pkg === PHONE_SOURCE ? t('settings.samsungSourcePhone')
      : pkg || '—'
  const typeLabel = (code: string) =>
    code === '0' ? t('settings.samsungTypeOther')
      : code === '1001' ? t('settings.samsungTypeWalking')
      : code === '1002' ? t('settings.samsungTypeRunning')
      : t('settings.samsungTypeCode', { code })
  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString(bcp47(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const optionLabel = (w: SessionWindow, day: string, withHeartRate: Set<string>) => {
    const sameDay = toDateKey(new Date(w.startMs)) === day
    const label = t('settings.samsungTargetOption', {
      name: sessionsById.get(w.id)?.name ?? '—',
      start: `${sameDay ? '' : `${formatDateCompact(toDateKey(new Date(w.startMs)))} `}${clock(w.startMs)}`,
      end: clock(w.endMs),
    })
    return withHeartRate.has(w.id) ? `${label} ${t('settings.samsungHasHeartRateTag')}` : label
  }

  /** The session the heart rate would be written to, if it already exists. */
  function existingTarget(row: Row, target: string): string | null {
    if (row.alreadyImported) return samsungSessionId(row.workout.uuid)
    return target === NEW ? null : target
  }

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    setError(null)
    setMessage(null)
    const heartRateFiles = files.filter((file) => /\.json$/i.test(file.name))
    void Promise.all([findExerciseCsv(files), sessionIdsWithHeartRate()])
      .then(([workouts, withHeartRate]) => {
        if (workouts.length === 0) throw new Error(t('errors.notSamsungExport'))
        const rows = buildRows(workouts, heartRateFiles, store.sessions)
        const nextTargets = new Map<string, string>()
        const nextSelected = new Set<string>()
        for (const row of rows) {
          const target = row.options[0]?.id ?? NEW
          nextTargets.set(row.workout.uuid, target)
          const existing = existingTarget(row, target)
          // An existing session only gains heart rate, so skip it when there is none to add.
          const nothingToAdd = existing !== null && (!row.hasFile || withHeartRate.has(existing))
          if (selectedByDefault(row.workout) && !nothingToAdd) nextSelected.add(row.workout.uuid)
        }
        setLoaded({ rows, heartRateFiles, withHeartRate })
        setTargets(nextTargets)
        setSelected(nextSelected)
        setSource(workouts.some((w) => w.source === XIAOMI_SOURCE) ? XIAOMI_SOURCE : ALL)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t('errors.readFile'))
      })
  }

  function toggle(uuid: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(uuid)
      else next.delete(uuid)
      return next
    })
  }

  async function runImport(current: Loaded) {
    const items: { parsed: ParsedWorkoutImport; targetSessionId: string | null }[] = []
    for (const row of current.rows) {
      if (!selected.has(row.workout.uuid)) continue
      const file = current.heartRateFiles.find((f) => matchesHeartRateFile(row.workout, f.name))
      const samples = file ? parseSamsungHeartRate(await file.text()) : []
      const target = targets.get(row.workout.uuid) ?? NEW
      items.push({
        parsed: toWorkoutImport(row.workout, samples),
        targetSessionId: row.alreadyImported || target === NEW ? null : target,
      })
    }
    return store.importSamsungWorkouts(items)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        multiple
        hidden
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <button type="button" className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? t('settings.importing') : t('settings.samsungImport')}
      </button>
      <small className="muted">{t('settings.samsungHint')}</small>
      {message ? <small className="badge badge--completed">{message}</small> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}

      {loaded ? (
        <Modal title={t('settings.samsungTitle')} onClose={() => setLoaded(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>{t('settings.samsungBody')}</p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="samsung-source">{t('settings.samsungSource')}</label>
              <select
                id="samsung-source"
                className="input"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value={ALL}>
                  {t('settings.samsungAllSources')} ({loaded.rows.length})
                </option>
                {sources.map(([pkg, count]) => (
                  <option key={pkg} value={pkg}>{sourceLabel(pkg)} ({count})</option>
                ))}
              </select>
            </div>

            {visible.length === 0 ? <p className="muted">{t('settings.samsungNone')}</p> : null}
            <ul className="samsung-import__list">
              {visible.map((row) => {
                const w = row.workout
                const target = targets.get(w.uuid) ?? NEW
                const existing = existingTarget(row, target)
                const hasHeartRate = existing !== null && loaded.withHeartRate.has(existing)
                const selectId = `samsung-target-${w.uuid}`
                return (
                  <li key={w.uuid} className="samsung-import__item">
                    <label className="samsung-import__row">
                      <input
                        type="checkbox"
                        checked={selected.has(w.uuid)}
                        onChange={(event) => toggle(w.uuid, event.target.checked)}
                      />
                      <span className="samsung-import__body">
                        <strong>
                          {formatDateCompact(w.localDate)} · {w.localTime} · {formatDuration(w.durationS)}
                        </strong>
                        <span className="muted">
                          {typeLabel(w.exerciseType)} · {sourceLabel(w.source)}
                        </span>
                        {w.meanHeartRate !== null && w.maxHeartRate !== null ? (
                          <span>
                            {t('settings.samsungHeartRate', {
                              average: w.meanHeartRate,
                              peak: w.maxHeartRate,
                            })}
                          </span>
                        ) : null}
                        <span className="muted">
                          {t(row.hasFile ? 'settings.samsungHeartRateAttached' : 'settings.samsungHeartRateMissing')}
                        </span>
                        {isLongWorkout(w) || row.alreadyImported ? (
                          <span className="row row--wrap samsung-import__badges">
                            {isLongWorkout(w) ? (
                              <span className="badge badge--error">{t('settings.samsungLong')}</span>
                            ) : null}
                            {row.alreadyImported ? (
                              <span className="badge badge--neutral">{t('settings.samsungAlready')}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {!row.alreadyImported ? (
                      <div className="field samsung-import__target">
                        <label htmlFor={selectId}>{t('settings.samsungTarget')}</label>
                        <select
                          id={selectId}
                          className="input"
                          value={target}
                          onChange={(event) => {
                            const value = event.target.value
                            setTargets((prev) => new Map(prev).set(w.uuid, value))
                          }}
                        >
                          {row.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {optionLabel(option, w.localDate, loaded.withHeartRate)}
                            </option>
                          ))}
                          <option value={NEW}>{t('settings.samsungTargetNew')}</option>
                        </select>
                      </div>
                    ) : null}
                    {hasHeartRate ? (
                      <small className="muted samsung-import__note">{t('settings.samsungTargetHasHeartRate')}</small>
                    ) : existing !== null && !row.hasFile ? (
                      <small className="muted samsung-import__note">{t('settings.samsungNothingToAdd')}</small>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={busy || selected.size === 0}
              onClick={() => {
                const current = loaded
                setBusy(true)
                setError(null)
                void runImport(current)
                  .then((result) => {
                    setLoaded(null)
                    setMessage(t('settings.samsungImported', result))
                  })
                  .catch((reason: unknown) => {
                    setLoaded(null)
                    setError(reason instanceof Error ? reason.message : t('errors.importFile'))
                  })
                  .finally(() => setBusy(false))
              }}
            >
              {t('settings.samsungImportSelected', { count: selected.size })}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setLoaded(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
