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
import { useT } from '../lib/i18n'
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
    a.completed_at === b.completed_at &&
    a.is_warmup === b.is_warmup
  )
}

interface Draft {
  weight: string
  bodyweight: boolean
  reps: string
  duration: string
  distance: string
  rpe: string
}

function isBodyweightLogged(weightKg: number | null, treatEmptyAsBw: boolean): boolean {
  if (weightKg === 0) return true
  return treatEmptyAsBw && weightKg == null
}

function draftFromSet(set: SetRow, units: UnitSystem, treatEmptyAsBw: boolean): Draft {
  const bodyweight = isBodyweightLogged(set.weight_kg, treatEmptyAsBw)
  return {
    weight: bodyweight ? '' : weightForInput(set.weight_kg, units),
    bodyweight,
    reps: set.reps === null ? '' : String(set.reps),
    duration: set.duration_s === null ? '' : formatDuration(set.duration_s),
    distance: distanceForInput(set.distance_m, units),
    rpe: set.rpe === null ? '' : String(set.rpe),
  }
}

function measurementHasWeight(measurement: ExerciseMeasurement): boolean {
  return (
    measurement === 'weight_reps' ||
    measurement === 'weight_duration' ||
    measurement === 'weight_distance'
  )
}

export function SetEditor({
  index,
  set,
  measurement,
  units,
  readonly,
  bodyweightLoad,
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
  /** Pull-ups / dips: empty load means bodyweight, a number is extra kg. */
  bodyweightLoad?: boolean
  onChange(next: SetRow): void
  onComplete(next: SetRow): void
  onDelete(): void
  suggestion?: Partial<Draft>
}) {
  const warmup = set.is_warmup === true
  const treatEmptyAsBw = bodyweightLoad === true
  const showBwToggle = measurementHasWeight(measurement) && (treatEmptyAsBw || warmup)
  const [draft, setDraft] = useState<Draft>(() => draftFromSet(set, units, treatEmptyAsBw))
  const lastEmitted = useRef<SetRow>(set)

  // Adopt upstream changes (sync, programmatic edits) — but never our own
  // round-trips, which would fight the user mid-typing ("82." → "82").
  useEffect(() => {
    if (sameValues(lastEmitted.current, set)) return
    lastEmitted.current = set
    setDraft(draftFromSet(set, units, treatEmptyAsBw))
  }, [set, units, treatEmptyAsBw])

  function apply(patch: Partial<Draft>) {
    const nextDraft: Draft = { ...draft, ...patch }
    if (patch.weight !== undefined && patch.weight.trim() !== '') {
      nextDraft.bodyweight = false
    }
    if (patch.bodyweight === true) {
      nextDraft.weight = ''
    }
    setDraft(nextDraft)

    let weightKg: number | null
    if (nextDraft.bodyweight) {
      weightKg = 0
    } else {
      const weight = parseNonNegative(nextDraft.weight)
      weightKg = weight === null ? null : weightToKg(weight, units)
    }
    const reps = nextDraft.reps === '' ? null : Number(nextDraft.reps)
    const duration = parseDurationInput(nextDraft.duration)
    const distance = parseNonNegative(nextDraft.distance)
    const rpe = nextDraft.rpe === '' ? null : Number(nextDraft.rpe)

    const next: SetRow = {
      ...set,
      weight_kg: weightKg,
      reps: reps !== null && Number.isFinite(reps) && reps >= 0 ? Math.round(reps) : null,
      duration_s: duration,
      distance_m: distance === null ? null : distanceToM(distance, units),
      rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : null,
      updated_at: new Date().toISOString(),
    }
    lastEmitted.current = next
    onChange(next)
  }

  const { t } = useT()
  const completed = set.completed_at !== null
  const identity = [
    set.round_index ?? index + 1,
    set.side === 'left' ? 'L' : set.side === 'right' ? 'R' : null,
    set.direction === 'pronation' ? 'P' : set.direction === 'supination' ? 'S' : null,
  ].filter(Boolean).join('·')
  const unit = weightUnitLabel(units)
  const weightPlaceholder = treatEmptyAsBw
    ? t('set.bodyweight')
    : suggestion?.weight || `${unit}`

  return (
    <div className={`set-row ${completed ? 'set-row--done' : ''}${warmup ? ' set-row--warmup' : ''}`}>
      <span className="set-index" aria-label={warmup ? t('set.setWarmup', { n: index + 1 }) : t('set.setN', { n: index + 1 })}>
        {identity}
        {warmup ? <span className="set-warmup-badge" title={t('set.warmupTitle')}>W</span> : null}
      </span>

      <div className="set-inputs" role="group" aria-label={t('set.values', { n: index + 1 })}>
        {showBwToggle ? (
          <button
            type="button"
            className={`set-bw ${draft.bodyweight ? 'is-on' : ''}`}
            aria-pressed={draft.bodyweight}
            title={t('set.bodyweightTitle')}
            disabled={readonly}
            onClick={() => apply({ bodyweight: !draft.bodyweight })}
          >
            {t('set.bodyweight')}
          </button>
        ) : null}

        {measurement === 'weight_reps' ? (
          <>
            {draft.bodyweight && !treatEmptyAsBw ? null : (
              <label className="set-field">
                <span className="visually-hidden">
                  {treatEmptyAsBw ? t('set.addedLoad', { unit }) : t('set.weightIn', { unit })}
                </span>
                <input
                  className="input input--cell"
                  type="text"
                  inputMode="decimal"
                  placeholder={weightPlaceholder}
                  value={draft.weight}
                  disabled={readonly}
                  onChange={(e) => apply({ weight: e.target.value })}
                />
              </label>
            )}
            <label className="set-field">
              <span className="visually-hidden">{t('set.repetitions')}</span>
              <input
                className="input input--cell"
                type="text"
                inputMode="numeric"
                placeholder={suggestion?.reps || t('set.reps')}
                value={draft.reps}
                disabled={readonly}
                onChange={(e) => apply({ reps: e.target.value })}
              />
            </label>
          </>
        ) : null}

        {measurement === 'reps' ? (
          <label className="set-field">
            <span className="visually-hidden">{t('set.repetitions')}</span>
            <input
              className="input input--cell"
              type="text"
              inputMode="numeric"
              placeholder={suggestion?.reps || t('set.reps')}
              value={draft.reps}
              disabled={readonly}
              onChange={(e) => apply({ reps: e.target.value })}
            />
          </label>
        ) : null}

        {measurement === 'weight_duration' || measurement === 'weight_distance' ? (
          draft.bodyweight && !treatEmptyAsBw ? null : (
            <label className="set-field">
              <span className="visually-hidden">
                {treatEmptyAsBw ? t('set.addedLoad', { unit }) : t('set.weightIn', { unit })}
              </span>
              <input
                className="input input--cell"
                type="text"
                inputMode="decimal"
                placeholder={weightPlaceholder}
                value={draft.weight}
                disabled={readonly}
                onChange={(e) => apply({ weight: e.target.value })}
              />
            </label>
          )
        ) : null}

        {measurement === 'duration' || measurement === 'distance_duration' || measurement === 'weight_duration' ? (
          <label className="set-field">
            <span className="visually-hidden">{t('set.durationAria')}</span>
            <input
              className="input input--cell"
              type="text"
              placeholder={suggestion?.duration || t('set.durationPh')}
              value={draft.duration}
              disabled={readonly}
              onChange={(e) => apply({ duration: e.target.value })}
            />
          </label>
        ) : null}

        {measurement === 'distance_duration' || measurement === 'weight_distance' ? (
          <label className="set-field">
            <span className="visually-hidden">{t('set.distanceIn', { unit: distanceUnitLabel(units) })}</span>
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
          <span className="visually-hidden">{t('set.rpeAria')}</span>
          <select
            className="input input--cell"
            value={draft.rpe}
            disabled={readonly}
            onChange={(e) => apply({ rpe: e.target.value })}
          >
            <option value="">{t('editor.rpe')}</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {readonly ? (
        <span className="badge badge--completed" title={t('set.completed')}>
          <IconCheck width={14} height={14} />
        </span>
      ) : (
        <div className="set-actions">
          <button
            type="button"
            className={`btn btn--icon btn--small ${completed ? 'btn--accent' : ''}`}
            aria-label={completed ? t('set.incomplete', { n: index + 1 }) : t('set.complete', { n: index + 1 })}
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
            aria-label={t('set.delete', { n: index + 1 })}
            onClick={onDelete}
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export function AddSetButton({ onAdd, label }: { onAdd(): void; label?: string }) {
  const { t } = useT()
  return (
    <button type="button" className="btn btn--small" onClick={onAdd}>
      <IconPlus width={16} height={16} /> {label ?? t('set.add')}
    </button>
  )
}
