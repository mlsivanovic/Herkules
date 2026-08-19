// Routines list: reusable workout templates + Hybrid 4-day starter.
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { EmptyState, Loader, Modal } from '../components/ui'
import { IconPlus } from '../components/Icons'
import {
  downloadTextFile,
  formatRoutineImportMessage,
  routinesExportFilename,
} from '../lib/routinesIo'
import { isHybridProgramInstalled } from '../lib/programs/hybrid4day'
import {
  DEFAULT_WEEKDAYS,
  rotationOccurrences,
  type TrainingFrequency,
} from '../lib/programs/rotate'
import { formatDateShort, todayKey } from '../lib/dates'
import './routines.css'

export function Routines() {
  const { templates, templateItems, ready, installHybridProgram, exportRoutines, importRoutines } =
    useStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [ioBusy, setIoBusy] = useState(false)
  const [ioMessage, setIoMessage] = useState<string | null>(null)
  const [ioError, setIoError] = useState<string | null>(null)

  const installed = useMemo(() => isHybridProgramInstalled(templates), [templates])

  async function addProgram() {
    setBusy(true)
    setError(null)
    try {
      const result = await installHybridProgram()
      if (result.created) setPlannerOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the program.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>Routines</h1>
        <div className="row row--wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setIoBusy(true)
              setIoError(null)
              setIoMessage(null)
              void file
                .text()
                .then((text) => importRoutines(text))
                .then((result) => {
                  setIoMessage(formatRoutineImportMessage(result))
                })
                .catch((caught: unknown) => {
                  setIoError(caught instanceof Error ? caught.message : 'Could not import that file.')
                })
                .finally(() => setIoBusy(false))
            }}
          />
          <button
            type="button"
            className="btn"
            disabled={ioBusy}
            onClick={() => fileRef.current?.click()}
          >
            {ioBusy ? 'Importing…' : 'Import'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={ioBusy || templates.length === 0}
            onClick={() => {
              setIoBusy(true)
              setIoError(null)
              setIoMessage(null)
              void exportRoutines()
                .then((json) => {
                  downloadTextFile(routinesExportFilename(), json, 'application/json')
                  setIoMessage(`Exported ${templates.length} routine${templates.length === 1 ? '' : 's'}.`)
                })
                .catch((caught: unknown) => {
                  setIoError(caught instanceof Error ? caught.message : 'Could not export routines.')
                })
                .finally(() => setIoBusy(false))
            }}
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void navigate('/routines/new')}
          >
            <IconPlus width={18} height={18} /> New
          </button>
        </div>
      </div>
      {ioMessage || ioError ? (
        <div className="stack" style={{ marginBottom: '0.9rem' }}>
          {ioMessage ? <small className="badge badge--completed">{ioMessage}</small> : null}
          {ioError ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {ioError}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="card starter-card">
        <div className="starter-card__head">
          <strong>Hybrid 4-day</strong>
          <span className="badge badge--neutral">Starter</span>
        </div>
        <p className="muted starter-card__blurb">
          Health, strength, function, and tendon work. Four days (A–D), ~65–80 min, mostly RPE 7–8.
          Adds four editable routines to your library — coaching notes are defaults you can change.
        </p>
        <div className="row row--wrap">
          {installed ? (
            <button type="button" className="btn btn--primary" onClick={() => setPlannerOpen(true)}>
              Plan rotation
            </button>
          ) : (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void addProgram()}>
              {busy ? 'Adding…' : 'Add Hybrid 4-day'}
            </button>
          )}
          {installed ? <span className="muted">Already in your library</span> : null}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <div className="section-title">Your routines</div>
      {templates.length === 0 ? (
        <EmptyState
          title="No routines yet"
          hint="A routine is a reusable list of exercises you can schedule or start directly."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void navigate('/routines/new')}
            >
              Create your first routine
            </button>
          }
        />
      ) : (
        <ul className="exercise-list">
          {templates.map((template) => {
            const items = templateItems.filter((i) => i.template_id === template.id)
            return (
              <li key={template.id}>
                <button
                  type="button"
                  className="card exercise-card"
                  onClick={() => void navigate(`/routines/${template.id}`)}
                >
                  <span className="row row--between">
                    <strong>{template.name}</strong>
                    <span className="badge badge--neutral">{items.length} exercises</span>
                  </span>
                  {template.notes ? (
                    <small className="muted">{previewNotes(template.notes)}</small>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {plannerOpen ? <RotationModal onClose={() => setPlannerOpen(false)} /> : null}
    </div>
  )
}

function previewNotes(notes: string): string {
  return notes.replace(/^Program: Hybrid 4-day [ABCD]\s*/u, '').trim()
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

function RotationModal({ onClose }: { onClose: () => void }) {
  const { scheduleHybridRotation } = useStore()
  const [frequency, setFrequency] = useState<TrainingFrequency>(3)
  const [weekdays, setWeekdays] = useState<number[]>(DEFAULT_WEEKDAYS[3])
  const [startDate, setStartDate] = useState(todayKey())
  const [weeks, setWeeks] = useState(8)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(
    () => rotationOccurrences({ frequency, weekdays, start: startDate, weeks }),
    [frequency, weekdays, startDate, weeks],
  )

  function setFreq(next: TrainingFrequency) {
    setFrequency(next)
    setWeekdays(DEFAULT_WEEKDAYS[next])
  }

  async function confirm() {
    if (weekdays.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const count = await scheduleHybridRotation({ frequency, weekdays, startDate, weeks })
      if (count === 0) {
        setError('Nothing to schedule with those dates.')
        return
      }
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not plan the rotation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Plan Hybrid rotation" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Rotates A → B → C → D on the days you train. 2×/week is A–B then C–D; 3× wraps; 4× is one of
        each per week.
      </p>

      <div className="row" role="group" aria-label="Days per week" style={{ marginBottom: '0.9rem' }}>
        {([2, 3, 4] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn--small ${frequency === value ? 'btn--primary' : ''}`}
            aria-pressed={frequency === value}
            onClick={() => setFreq(value)}
          >
            {value}× / week
          </button>
        ))}
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Train on</legend>
        <div className="row row--wrap">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              className={`btn btn--small ${weekdays.includes(day.value) ? 'btn--primary' : ''}`}
              aria-pressed={weekdays.includes(day.value)}
              onClick={() =>
                setWeekdays((prev) =>
                  prev.includes(day.value)
                    ? prev.filter((v) => v !== day.value)
                    : [...prev, day.value],
                )
              }
            >
              {day.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="routine-grid" style={{ marginBottom: '0.9rem' }}>
        <label className="field">
          <span>Start</span>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Weeks</span>
          <input
            className="input input--cell"
            type="number"
            min={1}
            max={26}
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
          />
        </label>
      </div>

      {preview.length > 0 ? (
        <div className="starter-preview">
          <small className="muted">
            {preview.length} sessions · first {Math.min(8, preview.length)}
          </small>
          <ul>
            {preview.slice(0, 8).map((row) => (
              <li key={`${row.date}-${row.slot}`}>
                <span>{formatDateShort(row.date)}</span>
                <strong> {row.slot}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="row row--wrap" style={{ marginTop: '0.9rem' }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Scheduling…' : 'Add to calendar'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Not now
        </button>
      </div>
    </Modal>
  )
}
