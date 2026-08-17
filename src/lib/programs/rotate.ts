// A–B–C–D rotation over chosen weekdays. Weekly recurrence cannot express
// "week 1 A–B, week 2 C–D"; this emits a flat list of single dates instead.

import { addDays, isoWeekday, type DateKey } from '../dates'

export type HybridSlot = 'A' | 'B' | 'C' | 'D'
export type TrainingFrequency = 2 | 3 | 4

export const HYBRID_SLOTS: HybridSlot[] = ['A', 'B', 'C', 'D']

export interface RotationOccurrence {
  date: DateKey
  slot: HybridSlot
}

export interface RotationInput {
  frequency: TrainingFrequency
  weekdays: number[]
  start: DateKey
  weeks: number
}

/** Default 4-day layout: A — rest — B — rest — C — D. */
export const DEFAULT_WEEKDAYS: Record<TrainingFrequency, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
}

function uniqueSortedWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b)
}

/**
 * Walk the calendar from `start` and assign A→B→C→D on selected weekdays
 * until `frequency * weeks` sessions are placed.
 */
export function rotationOccurrences(input: RotationInput): RotationOccurrence[] {
  const weekdays = uniqueSortedWeekdays(input.weekdays)
  if (weekdays.length === 0 || input.weeks < 1) return []

  const needed = input.frequency * input.weeks
  const selected = new Set(weekdays)
  const result: RotationOccurrence[] = []
  let cursor = input.start
  const safety = addDays(input.start, input.weeks * 7 + 21)

  while (result.length < needed && cursor <= safety) {
    if (selected.has(isoWeekday(cursor))) {
      const slot = HYBRID_SLOTS[result.length % HYBRID_SLOTS.length]
      if (slot) result.push({ date: cursor, slot })
    }
    cursor = addDays(cursor, 1)
  }
  return result
}
