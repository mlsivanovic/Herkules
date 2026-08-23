// Align daily body metrics onto the same weekly buckets as training volume.
import { addDays, type DateKey } from './dates'

export interface DateValue {
  date: DateKey
  value: number
}

/** Last value on or before `date`, or null when nothing has been logged yet. */
export function valueOnOrBefore(entries: DateValue[], date: DateKey): number | null {
  let best: number | null = null
  let bestDate = ''
  for (const row of entries) {
    if (row.date <= date && (best === null || row.date > bestDate)) {
      best = row.value
      bestDate = row.date
    }
  }
  return best
}

export interface WeeklySample {
  value: number | null
  /** True when a reading was logged during this week (not just carried forward). */
  recorded: boolean
}

/** One value per week: last known reading on or before that week's last day. */
export function weeklyValues(weekStarts: DateKey[], entries: DateValue[]): WeeklySample[] {
  return weekStarts.map((start) => {
    const weekEnd = addDays(start, 6)
    return {
      value: valueOnOrBefore(entries, weekEnd),
      recorded: entries.some((row) => row.date >= start && row.date <= weekEnd),
    }
  })
}
