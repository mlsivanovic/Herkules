// Input validation shared by forms and set editors.
import type { ExerciseMeasurement, UnitSystem } from '../types/db'
import { t } from './i18n'
import { distanceToM, weightToKg } from './units'

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (value === '') return t('validation.emailRequired')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('validation.emailInvalid')
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return t('validation.passwordMin')
  return null
}

export function validateRequiredName(name: string, label: string): string | null {
  const value = name.trim()
  if (value === '') return t('validation.required', { label })
  if (value.length > 120) return t('validation.maxLen', { label })
  return null
}

/** Parse a non-negative number from user input; null when invalid/empty. */
export function parseNonNegative(text: string): number | null {
  const value = text.trim()
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function validateHttpsUrl(url: string): string | null {
  const value = url.trim()
  if (value === '') return null
  if (!/^https:\/\/\S+\.\S+/.test(value)) return t('validation.https')
  return null
}

export function validateRpe(rpe: number | null): string | null {
  if (rpe === null) return null
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return t('validation.rpe')
  return null
}

export type DecimalDraft =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; value: number }
  | { kind: 'invalid' }

/** Decimal typing state. Comma and dot are both separators.
 * A trailing separator (`82,` / `82.`) stays partial so the field is not rewritten. */
export function parseDecimalDraft(text: string): DecimalDraft {
  const value = text.trim().replace(/\s+/g, '')
  if (value === '') return { kind: 'empty' }
  if (/^[+-]$/.test(value) || value === '.' || value === ',' || value === '+.' || value === '-.' || value === '+,' || value === '-,') {
    return { kind: 'partial' }
  }
  if (/^[+-]?\d+[.,]$/.test(value)) return { kind: 'partial' }
  const normalized = value.replace(',', '.')
  if (!/^[+-]?(?:\d+\.\d+|\d+|\.\d+)$/.test(normalized)) return { kind: 'invalid' }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return { kind: 'invalid' }
  return { kind: 'ok', value: parsed }
}

export type RepsDraft =
  | { kind: 'empty' }
  | { kind: 'partial' }
  | { kind: 'ok'; value: number }
  | { kind: 'invalid' }

/** Repetitions stay whole numbers. `8.5` is invalid, not rounded. */
export function parseRepsDraft(text: string): RepsDraft {
  const value = text.trim()
  if (value === '') return { kind: 'empty' }
  if (/^\d+[.,]$/.test(value)) return { kind: 'partial' }
  if (!/^\d+$/.test(value)) return { kind: 'invalid' }
  return { kind: 'ok', value: Number(value) }
}

export interface SetDraftInput {
  weight: string
  bodyweight: boolean
  reps: string
  duration: string
  distance: string
  rpe: string
}

export interface ConfirmedMetrics {
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  distance_m: number | null
  rpe: number | null
}

export type ConfirmSetResult =
  | { ok: true; metrics: ConfirmedMetrics }
  | { ok: false; field: 'weight' | 'reps' | 'duration' | 'distance' | 'rpe'; message: string }

function needsWeight(measurement: ExerciseMeasurement): boolean {
  return measurement === 'weight_reps' || measurement === 'weight_duration' || measurement === 'weight_distance'
}

/** Final logging check. Partial strings are rejected here; callers keep them while typing. */
export function confirmSetDraft(
  measurement: ExerciseMeasurement,
  draft: SetDraftInput,
  units: UnitSystem,
  options: { bodyweightLoad?: boolean } = {},
): ConfirmSetResult {
  const metrics: ConfirmedMetrics = {
    weight_kg: null,
    reps: null,
    duration_s: null,
    distance_m: null,
    rpe: null,
  }

  if (needsWeight(measurement)) {
    if (draft.bodyweight) {
      metrics.weight_kg = 0
    } else {
      const parsed = parseDecimalDraft(draft.weight)
      if (parsed.kind === 'partial') return { ok: false, field: 'weight', message: t('validation.numberIncomplete') }
      if (parsed.kind === 'invalid') return { ok: false, field: 'weight', message: t('validation.numberInvalid') }
      if (parsed.kind === 'empty') {
        if (options.bodyweightLoad) metrics.weight_kg = 0
        else return { ok: false, field: 'weight', message: t('validation.weightRequired') }
      } else if (parsed.value < 0) {
        return { ok: false, field: 'weight', message: t('validation.numberInvalid') }
      } else {
        metrics.weight_kg = weightToKg(parsed.value, units)
      }
    }
  }

  if (measurement === 'weight_reps' || measurement === 'reps') {
    const parsed = parseRepsDraft(draft.reps)
    if (parsed.kind === 'partial') return { ok: false, field: 'reps', message: t('validation.numberIncomplete') }
    if (parsed.kind === 'invalid') return { ok: false, field: 'reps', message: t('validation.repsWhole') }
    if (parsed.kind === 'empty') return { ok: false, field: 'reps', message: t('validation.repsRequired') }
    if (parsed.value <= 0) return { ok: false, field: 'reps', message: t('validation.repsPositive') }
    metrics.reps = parsed.value
  }

  if (measurement === 'duration' || measurement === 'distance_duration' || measurement === 'weight_duration') {
    const parsed = parseDurationInput(draft.duration)
    if (draft.duration.trim() !== '' && parsed === null) {
      return { ok: false, field: 'duration', message: t('validation.durationRequired') }
    }
    if (parsed === null || parsed <= 0) {
      return { ok: false, field: 'duration', message: t('validation.durationRequired') }
    }
    metrics.duration_s = parsed
  }

  if (measurement === 'distance_duration' || measurement === 'weight_distance') {
    const parsed = parseDecimalDraft(draft.distance)
    if (parsed.kind === 'partial') return { ok: false, field: 'distance', message: t('validation.numberIncomplete') }
    if (parsed.kind === 'invalid') return { ok: false, field: 'distance', message: t('validation.numberInvalid') }
    if (parsed.kind === 'empty' || parsed.value <= 0) {
      return { ok: false, field: 'distance', message: t('validation.distanceRequired') }
    }
    metrics.distance_m = distanceToM(parsed.value, units)
  }

  const rpeText = draft.rpe.trim()
  if (rpeText !== '') {
    if (!/^\d+$/.test(rpeText)) return { ok: false, field: 'rpe', message: t('validation.rpe') }
    const rpe = Number(rpeText)
    const rpeError = validateRpe(rpe)
    if (rpeError) return { ok: false, field: 'rpe', message: rpeError }
    metrics.rpe = rpe
  }

  return { ok: true, metrics }
}

/** mm:ss or h:mm:ss input → seconds; null when malformed. */
export function parseDurationInput(text: string): number | null {
  const value = text.trim()
  if (value === '') return null
  if (/^\d+$/.test(value)) return Number(value)
  const parts = value.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null
  const [h, m, s] = parts.length === 3 ? parts : ['0', ...parts]
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}
