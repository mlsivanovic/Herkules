// Warm-up ramp generator: 40% × 5, 60% × 3, 80% × 2 of the working weight,
// rounded to the smallest plate increment and never below the empty bar.
import type { UnitSystem } from '../types/db'

export interface WarmupSet {
  /** display units (kg or lb), rounded to the plate increment */
  weight: number
  reps: number
  percent: number
}

const RAMP: { percent: number; reps: number }[] = [
  { percent: 0.4, reps: 5 },
  { percent: 0.6, reps: 3 },
  { percent: 0.8, reps: 2 },
]

export function plateIncrement(units: UnitSystem): number {
  return units === 'metric' ? 2.5 : 5
}

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment
}

export function warmupSets(
  workingWeight: number,
  units: UnitSystem,
  barWeight: number,
): WarmupSet[] {
  const increment = plateIncrement(units)
  const sets: WarmupSet[] = []
  for (const step of RAMP) {
    const rounded = roundToIncrement(workingWeight * step.percent, increment)
    // The first ramp step can't be lighter than the empty bar.
    const weight = Math.max(rounded, barWeight)
    // Light lifts: skip steps that reach the working weight or repeat a weight.
    if (weight >= workingWeight - 1e-9) continue
    if (sets.length > 0 && sets[sets.length - 1].weight === weight) continue
    sets.push({ weight, reps: step.reps, percent: step.percent })
  }
  return sets
}
