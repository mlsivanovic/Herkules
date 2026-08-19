// Rotate an ordered list of plan days over chosen weekdays. Weekly recurrence
// cannot express "week 1 A–B, week 2 C–D"; this emits a flat list of dates.

import { addDays, isoWeekday, type DateKey } from '../dates'

export type HybridSlot = 'A' | 'B' | 'C' | 'D'
export type TrainingFrequency = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const HYBRID_SLOTS: HybridSlot[] = ['A', 'B', 'C', 'D']

export interface RotationOccurrence {
  date: DateKey
  dayIndex: number
}

export interface RotationInput {
  frequency: TrainingFrequency
  weekdays: number[]
  start: DateKey
  weeks: number
  /** Ordered days in the plan. Defaults to 4 (Hybrid A–D). */
  dayCount?: number
}

/** Default weekday layout by sessions per week. */
export const DEFAULT_WEEKDAYS: Record<TrainingFrequency, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
}

export function asTrainingFrequency(value: number): TrainingFrequency | null {
  return value >= 1 && value <= 7 ? (value as TrainingFrequency) : null
}

export function hybridSlotForIndex(dayIndex: number): HybridSlot {
  const slot = HYBRID_SLOTS[dayIndex % HYBRID_SLOTS.length]
  return slot ?? 'A'
}

function uniqueSortedWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b)
}

/**
 * Walk the calendar from `start` and assign plan days in order on selected
 * weekdays until `frequency * weeks` sessions are placed.
 */
export function rotationOccurrences(input: RotationInput): RotationOccurrence[] {
  const weekdays = uniqueSortedWeekdays(input.weekdays)
  const dayCount = input.dayCount && input.dayCount > 0 ? input.dayCount : 4
  if (weekdays.length === 0 || input.weeks < 1) return []

  const needed = input.frequency * input.weeks
  const selected = new Set(weekdays)
  const result: RotationOccurrence[] = []
  let cursor = input.start
  const safety = addDays(input.start, input.weeks * 7 + 21)

  while (result.length < needed && cursor <= safety) {
    if (selected.has(isoWeekday(cursor))) {
      result.push({ date: cursor, dayIndex: result.length % dayCount })
    }
    cursor = addDays(cursor, 1)
  }
  return result
}
