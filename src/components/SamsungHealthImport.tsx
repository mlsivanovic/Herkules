import './samsungHealthImport.css'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { ParsedWorkoutImport } from '../lib/csv'
import { formatDateCompact, toDateKey } from '../lib/dates'
import { sessionIdsWithHeartRate } from '../lib/db'
import { bcp47, useT } from '../lib/i18n'
import {
  exerciseCsvCandidates,
  heartRateFileFor,
  indexHeartRateFiles,
  isLongWorkout,
  isSamsungExerciseCsv,
  linkCandidates,
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
/** Folder picking (Chrome for Android 132+, desktop browsers); otherwise only files. */
const FOLDER_PICKER = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input')

interface Row {
  workout: SamsungWorkout
  /** Earlier standalone import of this same Samsung record, if any. */
  alreadyImported: boolean
  /** Nothing left to do: the default target already holds heart rate. */
  handled: boolean
  heartRateFile: File | undefined
  /** Herkules sessions to link to, best match first. */
  options: SessionWindow[]
}

interface Loaded {
  rows: Row[]
  heartRateFileCount: number
  withHeartRate: Set<string>
}

/** The exercise CSV of the newest export; peeks at content when names do not tell. */
async function findExerciseCsv(files: File[]): Promise<SamsungWorkout[]> {
  const named = exerciseCsvCandidates(files)
  const candidates = named.length > 0 ? named : files.filter((file) => /\.csv$/i.test(file.name))
  for (const file of candidates) {
    if (!isSamsungExerciseCsv(await file.slice(0, 64).text())) continue
    return parseSamsungExerciseCsv(await file.text())
  }
  return []
}

function buildRows(
  workouts: SamsungWorkout[],
  heartRateIndex: Map<string, File>,
  sessions: SessionDoc[],
  withHeartRate: Set<string>,
): Row[] {
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
    const ownId = samsungSessionId(workout.uuid)
    const alreadyImported = sessionIds.has(ownId)
    const defaultTarget = alreadyImported ? ownId : near[0]?.id ?? null
    return {
      workout,
      alreadyImported,
      handled: defaultTarget !== null && withHeartRate.has(defaultTarget),
      heartRateFile: heartRateFileFor(workout, heartRateIndex),
      options: [...near, ...sameDay],
    }
  })
}

export function SamsungHealthImport() {
  const { t } = useT()
  const store = useStore()
  const folderRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [source, setSource] = useState(ALL)
  const [showHandled, setShowHandled] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Map<string, string>>(new Map())
  const [scanning, setScanning] = useState(false)
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
  const inSource = (loaded?.rows ?? []).filter((r) => source === ALL || r.workout.source === source)
  const handledCount = inSource.filter((r) => r.handled).length
  const visible = showHandled ? inSource : inSource.filter((r) => !r.handled)

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
    setScanning(true)
    const heartRateIndex = indexHeartRateFiles(files)
    void Promise.all([findExerciseCsv(files), sessionIdsWithHeartRate()])
      .then(([workouts, withHeartRate]) => {
        if (workouts.length === 0) throw new Error(t('errors.notSamsungExport'))
        const rows = buildRows(workouts, heartRateIndex, store.sessions, withHeartRate)
        const nextTargets = new Map<string, string>()
        const nextSelected = new Set<string>()
        for (const row of rows) {
          const target = row.options[0]?.id ?? NEW
          nextTargets.set(row.workout.uuid, target)
          const existing = existingTarget(row, target)
          // An existing session only gains heart rate, so skip it when there is none to add.
          const nothingToAdd = existing !== null && (!row.heartRateFile || withHeartRate.has(existing))
          if (selectedByDefault(row.workout) && !nothingToAdd) nextSelected.add(row.workout.uuid)
        }
        setLoaded({ rows, heartRateFileCount: heartRateIndex.size, withHeartRate })
        setTargets(nextTargets)
        setSelected(nextSelected)
        setShowHandled(false)
        setSource(workouts.some((w) => w.source === XIAOMI_SOURCE) ? XIAOMI_SOURCE : ALL)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t('errors.readFile'))
      })
      .finally(() => setScanning(false))
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
      const samples = row.heartRateFile ? parseSamsungHeartRate(await row.heartRateFile.text()) : []
      const target = targets.get(row.workout.uuid) ?? NEW
      items.push({
        parsed: toWorkoutImport(row.workout, samples),
        targetSessionId: row.alreadyImported || target === NEW ? null : target,
      })
    }
    return store.importSamsungWorkouts(items)
  }

  const pickerProps = {
    type: 'file',
    hidden: true,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      onFiles(event.target.files)
      event.target.value = ''
    },
  } as const
  const working = busy || scanning

  return (
    <>
      {FOLDER_PICKER ? (
        <input
          {...pickerProps}
          ref={(el) => {
            folderRef.current = el
            el?.setAttribute('webkitdirectory', '')
          }}
        />
      ) : null}
      <input {...pickerProps} ref={filesRef} accept=".csv,.json,text/csv,application/json" multiple />
      {FOLDER_PICKER ? (
        <button type="button" className="btn" disabled={working} onClick={() => folderRef.current?.click()}>
          {scanning ? t('settings.samsungScanning') : busy ? t('settings.importing') : t('settings.samsungChooseFolder')}
        </button>
      ) : null}
      <button type="button" className="btn" disabled={working} onClick={() => filesRef.current?.click()}>
        {!FOLDER_PICKER && scanning ? t('settings.samsungScanning')
          : t(FOLDER_PICKER ? 'settings.samsungChooseFiles' : 'settings.samsungImport')}
      </button>
      <small className="muted">{t(FOLDER_PICKER ? 'settings.samsungHint' : 'settings.samsungHintFiles')}</small>
      {message ? <small className="badge badge--completed">{message}</small> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}

      {loaded ? (
        <Modal title={t('settings.samsungTitle')} onClose={() => setLoaded(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>{t('settings.samsungBody')}</p>
            <small className="muted">
              {t('settings.samsungFound', {
                workouts: loaded.rows.length,
                files: loaded.heartRateFileCount,
              })}
            </small>
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
            {handledCount > 0 ? (
              <label className="samsung-import__toggle">
                <input
                  type="checkbox"
                  checked={showHandled}
                  onChange={(event) => setShowHandled(event.target.checked)}
                />
                <span>{t('settings.samsungShowHandled', { count: handledCount })}</span>
              </label>
            ) : null}

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
                          {t(row.heartRateFile ? 'settings.samsungHeartRateAttached' : 'settings.samsungHeartRateMissing')}
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
                    ) : existing !== null && !row.heartRateFile ? (
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
