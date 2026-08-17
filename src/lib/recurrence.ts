// Schedule occurrence computation: which workouts are planned on which dates,
// and what status a date carries (planned / in-progress / completed / skipped).
import type { RecurrenceRuleRow, ScheduleItemRow } from '../types/db'
import { dateRange, isoWeekday, type DateKey } from './dates'

export type ScheduleRef = { schedule: ScheduleItemRow; rule: RecurrenceRuleRow | null }

/** Does the rule place a workout on this date? */
export function ruleOccursOn(rule: RecurrenceRuleRow, key: DateKey): boolean {
  if (key < rule.start_date) return false
  if (rule.end_date !== null && key > rule.end_date) return false
  return rule.weekdays.includes(isoWeekday(key))
}

/** Does this schedule entry (single date or recurring) plan a workout on `key`? */
export function scheduleOccursOn(ref: ScheduleRef, key: DateKey): boolean {
  if (ref.schedule.scheduled_date !== null) return ref.schedule.scheduled_date === key
  if (ref.rule) return ruleOccursOn(ref.rule, key)
  return false
}

export interface PlannedOccurrence {
  key: DateKey
  scheduleId: string
  templateId: string
}

/** All planned occurrences within [from, to], one entry per schedule per date. */
export function occurrencesInRange(
  refs: ScheduleRef[],
  from: DateKey,
  to: DateKey,
): PlannedOccurrence[] {
  const result: PlannedOccurrence[] = []
  for (const key of dateRange(from, to)) {
    for (const ref of refs) {
      if (scheduleOccursOn(ref, key)) {
        result.push({ key, scheduleId: ref.schedule.id, templateId: ref.schedule.template_id })
      }
    }
  }
  return result
}

export type DayWorkoutStatus = 'planned' | 'in-progress' | 'completed' | 'skipped'

/**
 * Status of one date given how many workouts are planned there and how many
 * were completed. An explicit skip wins over a still-planned today/future
 * slot; a past planned day without a completed session still counts as
 * skipped. Completed and in-progress always beat skip.
 */
export function dayStatus(
  key: DateKey,
  plannedCount: number,
  completedCount: number,
  hasActive: boolean,
  today: DateKey,
  explicitSkippedCount = 0,
): DayWorkoutStatus | null {
  if (plannedCount === 0 && completedCount === 0 && !hasActive && explicitSkippedCount === 0) {
    return null
  }
  if (hasActive) return 'in-progress'
  if (completedCount > 0) return 'completed'
  if (explicitSkippedCount > 0) return 'skipped'
  if (plannedCount > 0) return key < today ? 'skipped' : 'planned'
  return null
}

/**
 * Editing a rule must not rewrite history: future occurrences simply follow
 * the new rule, past ones stay as they were. This helper returns whether an
 * occurrence date is still governed by the rule (used to preview the effect
 * of an edit).
 */
export function affectsOnlyFuture(rule: RecurrenceRuleRow, changeFrom: DateKey): boolean {
  return changeFrom > rule.start_date || ruleOccursOn(rule, rule.start_date) === false
}
