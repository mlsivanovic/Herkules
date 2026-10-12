// Set row editor. Display units in, canonical kg / meters / seconds out.
// Logging uses the current draft, including the last typed character.
// History passes readonly or onComplete without any workout timer of its own.
import { useEffect, useRef, useState } from 'react'
import type { ExerciseMeasurement, SetRow, UnitSystem } from '../types/db'
import { formatLoggedSet } from '../lib/setDisplay'
import {
  distanceForInput,
  distanceToM,
  distanceUnitLabel,
  formatDuration,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import {
  confirmSetDraft,
  parseDecimalDraft,
  parseDurationInput,
  parseRepsDraft,
  type SetDraftInput,
} from '../lib/validation'
import { useT } from '../lib/i18n'
import { IconCheck, IconMore, IconPlus, IconTrash } from './Icons'
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

function isBodyweightLogged(weightKg: number | null, treatEmptyAsBw: boolean): boolean {
  if (weightKg === 0) return true
  return treatEmptyAsBw && weightKg == null
}

function draftFromSet(set: SetRow, units: UnitSystem, treatEmptyAsBw: boolean): SetDraftInput {
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

function hasSavedMetrics(set: SetRow): boolean {
  return (
    set.weight_kg !== null ||
    set.reps !== null ||
    set.duration_s !== null ||
    set.distance_m !== null ||
    set.rpe !== null ||
    set.completed_at !== null
  )
}

function withSuggestion(draft: SetDraftInput, suggestion: SetSuggestion | undefined): SetDraftInput {
  if (!suggestion) return draft
  return {
    ...draft,
    weight: draft.weight !== '' ? draft.weight : suggestion.weight ?? '',
    reps: draft.reps !== '' ? draft.reps : suggestion.reps ?? '',
    duration: draft.duration !== '' ? draft.duration : suggestion.duration ?? '',
    distance: draft.distance !== '' ? draft.distance : suggestion.distance ?? '',
  }
}

export interface SetSuggestion {
  weight?: string
  reps?: string
  duration?: string
  distance?: string
  source?: 'target' | 'previous' | 'empty'
  previousText?: string | null
}

function canonicalPatch(
  measurement: ExerciseMeasurement,
  draft: SetDraftInput,
  units: UnitSystem,
  bodyweightLoad: boolean,
): Partial<SetRow> | null {
  const patch: Partial<SetRow> = {}
  if (measurementHasWeight(measurement)) {
    if (draft.bodyweight) patch.weight_kg = 0
    else {
      const parsed = parseDecimalDraft(draft.weight)
      if (parsed.kind === 'partial' || parsed.kind === 'invalid') return null
      if (parsed.kind === 'empty') patch.weight_kg = bodyweightLoad ? 0 : null
      else if (parsed.value < 0) return null
      else patch.weight_kg = weightToKg(parsed.value, units)
    }
  }
  if (measurement === 'weight_reps' || measurement === 'reps') {
    const parsed = parseRepsDraft(draft.reps)
    if (parsed.kind === 'partial' || parsed.kind === 'invalid') return null
    patch.reps = parsed.kind === 'ok' ? parsed.value : null
  }
  if (measurement === 'duration' || measurement === 'distance_duration' || measurement === 'weight_duration') {
    if (draft.duration.trim() === '') patch.duration_s = null
    else {
      const parsed = parseDurationInput(draft.duration)
      if (parsed === null) return null
      patch.duration_s = parsed
    }
  }
  if (measurement === 'distance_duration' || measurement === 'weight_distance') {
    const parsed = parseDecimalDraft(draft.distance)
    if (parsed.kind === 'partial' || parsed.kind === 'invalid') return null
    patch.distance_m = parsed.kind === 'ok' ? distanceToM(parsed.value, units) : null
  }
  if (draft.rpe.trim() === '') patch.rpe = null
  else if (!/^\d+$/.test(draft.rpe.trim())) return null
  else {
    const rpe = Number(draft.rpe)
    patch.rpe = rpe >= 1 && rpe <= 10 ? rpe : null
  }
  return patch
}

export function SetEditor({
  index,
  set,
  measurement,
  units,
  readonly,
  bodyweightLoad,
  exerciseName = '',
  active = false,
  suggestion,
  persistedDraft = null,
  draftVersion = 0,
  externalDraft = null,
  onDraft,
  onChange,
  onComplete,
  onDelete,
}: {
  index: number
  set: SetRow
  measurement: ExerciseMeasurement
  units: UnitSystem
  readonly?: boolean
  /** Pull-ups / dips: empty load means bodyweight, a number is extra kg. */
  bodyweightLoad?: boolean
  exerciseName?: string
  active?: boolean
  suggestion?: SetSuggestion
  persistedDraft?: SetDraftInput | null
  draftVersion?: number
  externalDraft?: SetDraftInput | null
  onDraft?(draft: SetDraftInput): void
  onChange(next: SetRow): void
  onComplete(next: SetRow): void | Promise<void>
  onDelete(): void
}) {
  const warmup = set.is_warmup === true
  const treatEmptyAsBw = bodyweightLoad === true
  const showBwToggle = measurementHasWeight(measurement) && (treatEmptyAsBw || warmup)
  const { t } = useT()
  const [draft, setDraft] = useState<SetDraftInput>(
    () => persistedDraft ?? draftFromSet(set, units, treatEmptyAsBw),
  )
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editing, setEditing] = useState(set.completed_at === null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lastEmitted = useRef<SetRow>(set)
  const dirtyRef = useRef(Boolean(persistedDraft))
  const busyRef = useRef(false)
  const seenVersion = useRef(draftVersion)
  const revealedRef = useRef(false)
  const unit = weightUnitLabel(units)

  // Previous load stays out of the square until the field is focused, then it
  // fills every empty metric so one tap prepares kg and reps together.
  function revealSuggestion() {
    if (revealedRef.current || hasSavedMetrics(set) || !suggestion) return
    const next = withSuggestion(draft, suggestion)
    revealedRef.current = true
    if (
      next.weight === draft.weight &&
      next.reps === draft.reps &&
      next.duration === draft.duration &&
      next.distance === draft.distance
    ) {
      return
    }
    dirtyRef.current = true
    setDraft(next)
    onDraft?.(next)
  }

  useEffect(() => {
    if (sameValues(lastEmitted.current, set)) return
    if (dirtyRef.current) return
    lastEmitted.current = set
    setDraft(draftFromSet(set, units, treatEmptyAsBw))
  }, [set, units, treatEmptyAsBw])

  useEffect(() => {
    if (draftVersion === seenVersion.current) return
    seenVersion.current = draftVersion
    if (!externalDraft) return
    dirtyRef.current = true
    setDraft(externalDraft)
    setEditing(true)
    setError(null)
  }, [draftVersion, externalDraft])

  function update(patch: Partial<SetDraftInput>) {
    const nextDraft: SetDraftInput = { ...draft, ...patch }
    if (patch.weight !== undefined && patch.weight.trim() !== '') nextDraft.bodyweight = false
    if (patch.bodyweight === true) nextDraft.weight = ''
    dirtyRef.current = true
    setDraft(nextDraft)
    setError(null)
    onDraft?.(nextDraft)
    const metrics = canonicalPatch(measurement, nextDraft, units, treatEmptyAsBw)
    if (!metrics) return
    const next: SetRow = { ...set, ...metrics, updated_at: new Date().toISOString() }
    lastEmitted.current = next
    onChange(next)
  }

  async function confirm() {
    if (busyRef.current) return
    const result = confirmSetDraft(measurement, draft, units, { bodyweightLoad: treatEmptyAsBw })
    if (!result.ok) {
      setError(result.message)
      return
    }
    const next: SetRow = {
      ...set,
      ...result.metrics,
      completed_at: set.completed_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await onComplete(next)
      lastEmitted.current = next
      dirtyRef.current = false
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('set.saveFailed'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function markIncomplete() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await onComplete({ ...set, completed_at: null, updated_at: new Date().toISOString() })
      setEditing(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('set.saveFailed'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const completed = set.completed_at !== null
  const sideLabel = set.side === 'left' ? t('workout.sideLeft') : set.side === 'right' ? t('workout.sideRight') : null
  const directionLabel = set.direction === 'pronation'
    ? t('workout.dirPronation')
    : set.direction === 'supination'
      ? t('workout.dirSupination')
      : null
  const identity = [String(set.round_index ?? index + 1), sideLabel, directionLabel].filter(Boolean).join(' · ')
  const nameForAria = exerciseName || t('set.setN', { n: index + 1 })
  const sourceLabel = !hasSavedMetrics(set) && suggestion?.source === 'target'
    ? t('set.fromTarget')
    : !hasSavedMetrics(set) && suggestion?.source === 'previous'
      ? t('set.fromLast')
      : null

  return (
    <div
      className={`set-row${completed ? ' set-row--done' : ''}${warmup ? ' set-row--warmup' : ''}${active ? ' set-row--active' : ''}`}
    >
      <span className="set-index" aria-label={warmup ? t('set.setWarmup', { n: index + 1 }) : t('set.setN', { n: index + 1 })}>
        {identity}
        {warmup ? <span className="set-warmup-badge" title={t('set.warmupTitle')}>W</span> : null}
      </span>

      {readonly || (completed && !editing) ? (
        <button
          type="button"
          className="set-summary"
          disabled={readonly}
          onClick={() => {
            if (!readonly) setEditing(true)
          }}
        >
          <span>{formatLoggedSet(set, measurement, units, treatEmptyAsBw)}</span>
          {completed ? <span className="set-status">{t('set.logged')}</span> : null}
        </button>
      ) : (
        <div className="set-inputs" role="group" aria-label={t('set.values', { n: index + 1 })}>
          {showBwToggle ? (
            <button
              type="button"
              className={`set-bw ${draft.bodyweight ? 'is-on' : ''}`}
              aria-pressed={draft.bodyweight}
              title={t('set.bodyweightTitle')}
              disabled={readonly}
              onClick={() => update({ bodyweight: !draft.bodyweight })}
            >
              {t('set.bodyweight')}
            </button>
          ) : null}
          {measurementHasWeight(measurement) && !(draft.bodyweight && !treatEmptyAsBw) ? (
            <SquareField
              label={treatEmptyAsBw ? t('set.bodyweight') : unit}
              value={draft.weight}
              inputMode="decimal"
              ariaLabel={treatEmptyAsBw ? t('set.addedLoad', { unit }) : t('set.weightIn', { unit })}
              disabled={readonly || busy}
              onFocus={revealSuggestion}
              onChange={(weight) => update({ weight })}
            />
          ) : null}
          {measurement === 'weight_reps' || measurement === 'reps' ? (
            <SquareField
              label={t('set.reps')}
              value={draft.reps}
              inputMode="numeric"
              ariaLabel={`${t('set.repetitions')}, ${nameForAria}`}
              disabled={readonly || busy}
              onFocus={revealSuggestion}
              onChange={(reps) => update({ reps })}
            />
          ) : null}
          {measurement === 'duration' || measurement === 'distance_duration' || measurement === 'weight_duration' ? (
            <SquareField
              label={t('set.durationPh')}
              value={draft.duration}
              inputMode="numeric"
              ariaLabel={t('set.durationAria')}
              disabled={readonly || busy}
              onFocus={revealSuggestion}
              onChange={(duration) => update({ duration })}
            />
          ) : null}
          {measurement === 'distance_duration' || measurement === 'weight_distance' ? (
            <SquareField
              label={distanceUnitLabel(units)}
              value={draft.distance}
              inputMode="decimal"
              ariaLabel={t('set.distanceIn', { unit: distanceUnitLabel(units) })}
              disabled={readonly || busy}
              onFocus={revealSuggestion}
              onChange={(distance) => update({ distance })}
            />
          ) : null}
        </div>
      )}

      {readonly ? (
        completed ? <span className="set-status">{t('set.logged')}</span> : <span />
      ) : (
        <div className="set-actions">
          {completed && !editing ? (
            <button
              type="button"
              className="btn set-undo"
              aria-label={t('set.notDoneNamed', { n: index + 1, exercise: nameForAria })}
              disabled={busy}
              onClick={() => void markIncomplete()}
            >
              {t('set.undo')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--icon set-log"
              aria-label={t('set.completeNamed', { n: index + 1, exercise: nameForAria })}
              disabled={busy}
              aria-busy={busy}
              onClick={() => void confirm()}
            >
              <IconCheck />
            </button>
          )}
          <button
            type="button"
            className="btn btn--icon set-more-button"
            aria-label={t('set.moreActions', { n: index + 1 })}
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <IconMore width={18} height={18} />
          </button>
        </div>
      )}

      {sourceLabel || suggestion?.previousText ? (
        <p className="set-previous">
          {sourceLabel ? <span className="set-source">{sourceLabel}</span> : null}
          {suggestion?.previousText ? <span>{t('set.previousLine', { value: suggestion.previousText })}</span> : null}
        </p>
      ) : null}
      {error ? <p className="field-error set-error" role="alert">{error}</p> : null}

      {!readonly && detailsOpen ? (
        <div className="set-advanced">
          <label className="set-advanced__rpe">
            <span>{t('editor.rpe')}</span>
            <select
              className="input input--cell"
              aria-label={t('set.rpeAria')}
              value={draft.rpe}
              onChange={(event) => update({ rpe: event.target.value })}
            >
              <option value="">{t('common.notSet')}</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn set-undo" onClick={onDelete}>
            <IconTrash width={16} height={16} /> {t('common.delete')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SquareField({
  label,
  value,
  ariaLabel,
  inputMode,
  disabled,
  onFocus,
  onChange,
}: {
  label: string
  value: string
  ariaLabel: string
  inputMode: 'decimal' | 'numeric'
  disabled?: boolean
  onFocus(): void
  onChange(value: string): void
}) {
  const filled = value.trim() !== ''
  return (
    <label className={`set-square${filled ? ' is-filled' : ''}`}>
      <input
        className="input input--cell"
        type="text"
        inputMode={inputMode}
        enterKeyHint="done"
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="set-square__unit" aria-hidden="true">{label}</span>
    </label>
  )
}

export function AddSetButton({ onAdd, label }: { onAdd(): void; label?: string }) {
  const { t } = useT()
  return (
    <button type="button" className="btn set-add" onClick={onAdd}>
      <IconPlus width={16} height={16} /> {label ?? t('set.add')}
    </button>
  )
}
