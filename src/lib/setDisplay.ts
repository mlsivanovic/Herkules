import type { ExerciseMeasurement, SetRow, UnitSystem } from '../types/db'
import { formatSetLoad } from './bodyweightLoad'
import { formatDistance, formatDuration } from './units'

type LoggedSet = Pick<
  SetRow,
  'weight_kg' | 'reps' | 'duration_s' | 'distance_m' | 'rpe'
>

/** Compact read-only line for a logged set, e.g. "80 kg × 5 @ 8". */
export function formatLoggedSet(
  set: LoggedSet,
  measurement: ExerciseMeasurement,
  units: UnitSystem,
  bodyweightLoad = false,
): string {
  let core: string
  if (measurement === 'weight_reps') {
    core = `${formatSetLoad(set.weight_kg, units, bodyweightLoad)} × ${set.reps ?? '–'}`
  } else if (measurement === 'reps') {
    core = `${set.reps ?? '–'}`
  } else if (measurement === 'duration') {
    core = formatDuration(set.duration_s ?? 0)
  } else if (measurement === 'weight_duration') {
    core = `${formatSetLoad(set.weight_kg, units, bodyweightLoad)} × ${formatDuration(set.duration_s ?? 0)}`
  } else if (measurement === 'weight_distance') {
    core = `${formatSetLoad(set.weight_kg, units, bodyweightLoad)} × ${formatDistance(set.distance_m ?? 0, units)}`
  } else {
    core = `${formatDistance(set.distance_m ?? 0, units)} / ${formatDuration(set.duration_s ?? 0)}`
  }
  if (set.rpe != null) core += ` @ ${set.rpe}`
  return core
}
