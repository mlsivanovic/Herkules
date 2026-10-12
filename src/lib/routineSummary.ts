// One-line planned-target summary for routine editor rows,
// e.g. "3×8–12 · 60 kg · rest 90 s". Display-only: canonical values
// stay in kg / meters / seconds.
import type { ExerciseMeasurement, UnitSystem } from '../types/db'
import { pluralForm, t } from './i18n'
import type { Locale } from './i18n/locale'
import {
  distanceForInput,
  distanceUnitLabel,
  formatDuration,
  weightForInput,
  weightUnitLabel,
} from './units'

/** Structural subset of TemplateItemInput needed for the summary. */
export interface PlannedTargets {
  planned_sets: number
  target_weight_kg: number | null
  target_reps?: number | null
  target_duration_s?: number | null
  target_distance_m?: number | null
  rest_seconds?: number | null
  target_reps_min?: number | null
  target_reps_max?: number | null
  target_duration_min_s?: number | null
  target_duration_max_s?: number | null
  target_distance_min_m?: number | null
  target_distance_max_m?: number | null
}

function rangeText(
  min: number | null | undefined,
  max: number | null | undefined,
  legacy: number | null | undefined,
  format: (value: number) => string,
  unit = '',
): string | null {
  const lo = min ?? legacy ?? null
  const hi = max ?? legacy ?? null
  if (lo === null && hi === null) return null
  if (lo !== null && hi !== null && lo !== hi) return `${format(lo)}–${format(hi)}${unit}`
  return `${format((hi ?? lo) as number)}${unit}`
}

export function summarizePlannedItem(
  item: PlannedTargets,
  measurement: ExerciseMeasurement,
  units: UnitSystem,
  locale: Locale,
): string {
  const sets = Math.max(1, Math.trunc(item.planned_sets) || 1)
  const weight =
    item.target_weight_kg !== null
      ? `${weightForInput(item.target_weight_kg, units)} ${weightUnitLabel(units)}`
      : null
  const reps = rangeText(item.target_reps_min, item.target_reps_max, item.target_reps, String)
  const duration = rangeText(
    item.target_duration_min_s,
    item.target_duration_max_s,
    item.target_duration_s,
    formatDuration,
  )
  const distance = rangeText(
    item.target_distance_min_m,
    item.target_distance_max_m,
    item.target_distance_m,
    (meters) => distanceForInput(meters, units),
    ` ${distanceUnitLabel(units)}`,
  )

  const targets: string[] = []
  switch (measurement) {
    case 'weight_reps':
      if (reps) targets.push(reps)
      if (weight) targets.push(weight)
      break
    case 'reps':
      if (reps) targets.push(reps)
      break
    case 'weight_distance':
      if (weight) targets.push(weight)
      if (distance) targets.push(distance)
      break
    case 'weight_duration':
      if (weight) targets.push(weight)
      if (duration) targets.push(duration)
      break
    case 'duration':
      if (duration) targets.push(duration)
      break
    case 'distance_duration':
      if (distance) targets.push(distance)
      if (duration) targets.push(duration)
      break
  }

  const parts: string[] = []
  if (targets.length > 0) {
    parts.push(`${sets}×${targets.join(' · ')}`)
  } else {
    const form = pluralForm(sets, locale)
    const key =
      form === 'one'
        ? 'editor.summarySetsOne'
        : form === 'few'
          ? 'editor.summarySetsFew'
          : 'editor.summarySetsOther'
    parts.push(t(key, { count: sets }, locale))
  }
  if (item.rest_seconds !== null && item.rest_seconds !== undefined) {
    parts.push(t('editor.summaryRest', { s: item.rest_seconds }, locale))
  }
  return parts.join(' · ')
}
