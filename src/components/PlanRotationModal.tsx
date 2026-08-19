// Schedule an ordered plan as a rotating sequence of calendar dates.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { formatDateShort, todayKey } from '../lib/dates'
import {
  asTrainingFrequency,
  DEFAULT_WEEKDAYS,
  rotationOccurrences,
  type TrainingFrequency,
} from '../lib/programs/rotate'
import { sortPlanTemplates } from '../lib/programs/plans'
import { Modal } from './ui'

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

function frequencyOptions(dayCount: number): TrainingFrequency[] {
  const options: TrainingFrequency[] = [2, 3, 4]
  const extra = asTrainingFrequency(dayCount)
  if (extra && !options.includes(extra)) options.push(extra)
  return options.sort((a, b) => a - b)
}

export function PlanRotationModal({
  planId,
  onClose,
}: {
  planId: string
  onClose: () => void
}) {
  const { templates, schedulePlanRotation } = useStore()
  const days = sortPlanTemplates(templates, planId)
  const defaultFreq = (asTrainingFrequency(Math.min(Math.max(days.length, 2), 4)) ?? 3) as TrainingFrequency
  const [frequency, setFrequency] = useState<TrainingFrequency>(defaultFreq)
  const [weekdays, setWeekdays] = useState<number[]>(DEFAULT_WEEKDAYS[defaultFreq])
  const [startDate, setStartDate] = useState(todayKey())
  const [weeks, setWeeks] = useState(8)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(
    () =>
      rotationOccurrences({
        frequency,
        weekdays,
        start: startDate,
        weeks,
        dayCount: Math.max(days.length, 1),
      }),
    [frequency, weekdays, startDate, weeks, days.length],
  )

  function setFreq(next: TrainingFrequency) {
    setFrequency(next)
    setWeekdays(DEFAULT_WEEKDAYS[next])
  }

  async function confirm() {
    if (days.length === 0) {
      setError('Add at least one routine to the plan first.')
      return
    }
    if (weekdays.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const count = await schedulePlanRotation(planId, { frequency, weekdays, startDate, weeks })
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
    <Modal title="Plan rotation" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Rotates the plan days in order on the days you train.
        {days.length === 4
          ? ' 2×/week is days 1–2 then 3–4; 3× wraps; 4× is one of each per week.'
          : null}
      </p>

      <div className="row" role="group" aria-label="Days per week" style={{ marginBottom: '0.9rem' }}>
        {frequencyOptions(days.length).map((value) => (
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
              <li key={`${row.date}-${row.dayIndex}`}>
                <span>{formatDateShort(row.date)}</span>
                <strong> {days[row.dayIndex]?.name ?? `Day ${row.dayIndex + 1}`}</strong>
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
