import './samsungHealthImport.css'
import { useMemo, useRef, useState } from 'react'
import type { ParsedWorkoutImport } from '../lib/csv'
import { formatDateCompact } from '../lib/dates'
import { useT } from '../lib/i18n'
import {
  isLongWorkout,
  isSamsungExerciseCsv,
  matchesHeartRateFile,
  parseSamsungExerciseCsv,
  parseSamsungHeartRate,
  samsungSessionId,
  selectedByDefault,
  toWorkoutImport,
  XIAOMI_SOURCE,
  type SamsungWorkout,
} from '../lib/samsungHealth'
import { useStore } from '../lib/store'
import { formatDuration } from '../lib/units'
import { Modal } from './ui'

const PHONE_SOURCE = 'com.sec.android.app.shealth'
const ALL = 'all'

interface Loaded {
  workouts: SamsungWorkout[]
  heartRateFiles: File[]
}

async function loadFiles(files: File[]): Promise<Loaded> {
  const heartRateFiles = files.filter((file) => /\.json$/i.test(file.name))
  for (const file of files) {
    if (heartRateFiles.includes(file)) continue
    // Only the exercise CSV qualifies; peek at its first line before reading it all.
    if (!isSamsungExerciseCsv(await file.slice(0, 64).text())) continue
    return { workouts: parseSamsungExerciseCsv(await file.text()), heartRateFiles }
  }
  return { workouts: [], heartRateFiles }
}

export function SamsungHealthImport() {
  const { t } = useT()
  const store = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [source, setSource] = useState(ALL)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importedIds = useMemo(() => new Set(store.sessions.map((s) => s.id)), [store.sessions])
  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of loaded?.workouts ?? []) counts.set(w.source, (counts.get(w.source) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [loaded])
  const visible = (loaded?.workouts ?? []).filter((w) => source === ALL || w.source === source)

  const sourceLabel = (pkg: string) =>
    pkg === XIAOMI_SOURCE ? t('settings.samsungSourceXiaomi')
      : pkg === PHONE_SOURCE ? t('settings.samsungSourcePhone')
      : pkg || '—'
  const typeLabel = (code: string) =>
    code === '0' ? t('settings.samsungTypeOther')
      : code === '1001' ? t('settings.samsungTypeWalking')
      : code === '1002' ? t('settings.samsungTypeRunning')
      : t('settings.samsungTypeCode', { code })

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    setError(null)
    setMessage(null)
    void loadFiles(files)
      .then((result) => {
        if (result.workouts.length === 0) throw new Error(t('errors.notSamsungExport'))
        setLoaded(result)
        setSource(result.workouts.some((w) => w.source === XIAOMI_SOURCE) ? XIAOMI_SOURCE : ALL)
        setSelected(new Set(result.workouts
          .filter((w) => selectedByDefault(w) && !importedIds.has(samsungSessionId(w.uuid)))
          .map((w) => w.uuid)))
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
    const picked = current.workouts.filter((w) => selected.has(w.uuid))
    const parsed: ParsedWorkoutImport[] = []
    for (const workout of picked) {
      const file = current.heartRateFiles.find((f) => matchesHeartRateFile(workout, f.name))
      parsed.push(toWorkoutImport(workout, file ? parseSamsungHeartRate(await file.text()) : []))
    }
    return store.importSamsungWorkouts(parsed)
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
                  {t('settings.samsungAllSources')} ({loaded.workouts.length})
                </option>
                {sources.map(([pkg, count]) => (
                  <option key={pkg} value={pkg}>{sourceLabel(pkg)} ({count})</option>
                ))}
              </select>
            </div>

            {visible.length === 0 ? <p className="muted">{t('settings.samsungNone')}</p> : null}
            <ul className="samsung-import__list">
              {visible.map((w) => {
                const already = importedIds.has(samsungSessionId(w.uuid))
                const hasFile = loaded.heartRateFiles.some((f) => matchesHeartRateFile(w, f.name))
                return (
                  <li key={w.uuid}>
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
                          {t(hasFile ? 'settings.samsungHeartRateAttached' : 'settings.samsungHeartRateMissing')}
                        </span>
                        {isLongWorkout(w) || already ? (
                          <span className="row row--wrap samsung-import__badges">
                            {isLongWorkout(w) ? (
                              <span className="badge badge--error">{t('settings.samsungLong')}</span>
                            ) : null}
                            {already ? (
                              <span className="badge badge--neutral">{t('settings.samsungAlready')}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </label>
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
