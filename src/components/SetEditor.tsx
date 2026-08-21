// Set row editor: inputs adapt to the exercise's measurement type.
// Values are entered in the user's display units and stored canonically
// (kg / meters / seconds).
import { useEffect, useRef, useState } from 'react'
import type { ExerciseMeasurement, SetRow, UnitSystem } from '../types/db'
import {
  distanceForInput,
  distanceToM,
  distanceUnitLabel,
  formatDuration,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { parseDurationInput, parseNonNegative } from '../lib/validation'
import { IconCheck, IconClose, IconPlus, IconTrash } from './Icons'
import './setEditor.css'

function sameValues(a: SetRow, b: SetRow): boolean {
  return (
    a.id === b.id &&
    a.weight_kg === b.weight_kg &&
    a.reps === b.reps &&
    a.duration_s === b.duration_s &&
    a.distance_m === b.distance_m &&
    a.rpe === b.rpe &&
    a.completed_at === b.completed_at
  )
}

interface Draft {
  weight: string
  reps: string
  duration: string
  distance: string
  rpe: string
}

function draftFromSet(set: SetRow, units: UnitSystem): Draft {
  return {
    weight: weightForInput(set.weight_kg, units),
    reps: set.reps === null ? '' : String(set.reps),
    duration: set.duration_s === null ? '' : formatDuration(set.duration_s),
    distance: distanceForInput(set.distance_m, units),
    rpe: set.rpe === null ? '' : String(set.rpe),
  }
}

export function SetEditor({
  index,
  set,
  measurement,
  units,
  readonly,
  onChange,
  onComplete,
  onDelete,
  suggestion,
}: {
  index: number
  set: SetRow
  measurement: ExerciseMeasurement
  units: UnitSystem
  readonly?: boolean
  onChange(next: SetRow): void
  onComplete(next: SetRow): void
  onDelete(): void
  suggestion?: Partial<Draft>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSet(set, units))
  const lastEmitted = useRef<SetRow>(set)

  // Adopt upstream changes (sync, programmatic edits) — but never our own
  // round-trips, which would fight the user mid-typing ("82." → "82").
  useEffect(() => {
    if (sameValues(lastEmitted.current, set)) return
    lastEmitted.current = set
    setDraft(draftFromSet(set, units))
  }, [set, units])

  function apply(patch: Partial<Draft>) {
    const nextDraft = { ...draft, ...patch }
    setDraft(nextDraft)

    const weight = parseNonNegative(nextDraft.weight)
    const reps = nextDraft.reps === '' ? null : Number(nextDraft.reps)
    const duration = parseDurationInput(nextDraft.duration)
    const distance = parseNonNegative(nextDraft.distance)
    const rpe = nextDraft.rpe === '' ? null : Number(nextDraft.rpe)

    const next: SetRow = {
      ...set,
      weight_kg: weight === null ? null : weightToKg(weight, units),
      reps: reps !== null && Number.isFinite(reps) && reps >= 0 ? Math.round(reps) : null,
      duration_s: duration,
      distance_m: distance === null ? null : distanceToM(distance, units),
      rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : null,
      updated_at: new Date().toISOString(),
    }
    lastEmitted.current = next
    onChange(next)
  }

  const completed = set.completed_at !== null
  const warmup = set.is_warmup === true
  const identity = [
    set.round_index ?? index + 1,
    set.side === 'left' ? 'L' : set.side === 'right' ? 'R' : null,
    set.direction === 'pronation' ? 'P' : set.direction === 'supination' ? 'S' : null,
  ].filter(Boolean).join('·')

  return (
    <div className={`set-row ${completed ? 'set-row--done' : ''}${warmup ? ' set-row--warmup' : ''}`}>
      <span className="set-index" aria-label={`Set ${index + 1}${warmup ? ' (warm-up)' : ''}`}>
        {identity}
        {warmup ? <span className="set-warmup-badge" title="Warm-up set">W</span> : null}
      </span>

      <div className="set-inputs" role="group" aria-label={`Set ${index + 1} values`}>
        {measurement === 'weight_reps' ? (
          <>
            <label className="set-field">
              <span className="visually-hidden">Weight in {weightUnitLabel(units)}</span>
              <input
                className="input input--cell"
                type="text"
                inputMode="decimal"
                placeholder={suggestion?.weight || `${weightUnitLabel(units)}`}
                value={draft.weight}
                disabled={readonly}
                onChange={(e) => apply({ weight: e.target.value })}
              />
            </label>
            <label className="set-field">
              <span className="visually-hidden">Repetitions</span>
              <input
                className="input input--cell"
                type="text"
                inputMode="numeric"
                placeholder={suggestion?.reps || 'reps'}
                value={draft.reps}
                disabled={readonly}
                onChange={(e) => apply({ reps: e.target.value })}
              />
            </label>
          </>
        ) : null}

        {measurement === 'reps' ? (
          <label className="set-field">
            <span className="visually-hidden">Repetitions</span>
            <input
              className="input input--cell"
              type="text"
              inputMode="numeric"
              placeholder={suggestion?.reps || 'reps'}
              value={draft.reps}
              disabled={readonly}
              onChange={(e) => apply({ reps: e.target.value })}
            />
          </label>
        ) : null}

        {measurement === 'weight_duration' || measurement === 'weight_distance' ? (
          <label className="set-field">
            <span className="visually-hidden">Weight in {weightUnitLabel(units)}</span>
            <input
              className="input input--cell"
              type="text"
              inputMode="decimal"
              placeholder={suggestion?.weight || `${weightUnitLabel(units)}`}
              value={draft.weight}
              disabled={readonly}
              onChange={(e) => apply({ weight: e.target.value })}
            />
          </label>
        ) : null}

        {measurement === 'duration' || measurement === 'distance_duration' || measurement === 'weight_duration' ? (
          <label className="set-field">
            <span className="visually-hidden">Duration (mm:ss or h:mm:ss)</span>
            <input
              className="input input--cell"
              type="text"
              placeholder={suggestion?.duration || 'mm:ss'}
              value={draft.duration}
              disabled={readonly}
              onChange={(e) => apply({ duration: e.target.value })}
            />
          </label>
        ) : null}

        {measurement === 'distance_duration' || measurement === 'weight_distance' ? (
          <label className="set-field">
            <span className="visually-hidden">Distance in {distanceUnitLabel(units)}</span>
            <input
              className="input input--cell"
              type="text"
              inputMode="decimal"
              placeholder={suggestion?.distance || distanceUnitLabel(units)}
              value={draft.distance}
              disabled={readonly}
              onChange={(e) => apply({ distance: e.target.value })}
            />
          </label>
        ) : null}

        <label className="set-field set-field--rpe">
          <span className="visually-hidden">RPE (1–10)</span>
          <select
            className="input input--cell"
            value={draft.rpe}
            disabled={readonly}
            onChange={(e) => apply({ rpe: e.target.value })}
          >
            <option value="">RPE</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {readonly ? (
        <span className="badge badge--completed" title="Completed">
          <IconCheck width={14} height={14} />
        </span>
      ) : (
        <div className="set-actions">
          <button
            type="button"
            className={`btn btn--icon btn--small ${completed ? 'btn--accent' : ''}`}
            aria-label={completed ? `Mark set ${index + 1} as not done` : `Complete set ${index + 1}`}
            onClick={() =>
              onComplete({
                ...set,
                completed_at: completed ? null : new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
          >
            {completed ? <IconClose width={16} height={16} /> : <IconCheck />}
          </button>
          <button
            type="button"
            className="btn btn--icon btn--small btn--danger"
            aria-label={`Delete set ${index + 1}`}
            onClick={onDelete}
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export function AddSetButton({ onAdd, label = 'Add set' }: { onAdd(): void; label?: string }) {
  return (
    <button type="button" className="btn btn--small" onClick={onAdd}>
      <IconPlus width={16} height={16} /> {label}
    </button>
  )
}
