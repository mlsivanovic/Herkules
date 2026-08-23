// Align daily body metrics onto the same weekly buckets as training volume.
import { addDays, startOfWeek, type DateKey } from './dates'

export type TrendRange = '1m' | '3m' | '6m' | '1y' | 'all'

const RANGE_DAYS: Record<Exclude<TrendRange, 'all'>, number> = {
  '1m': 30,
  '3m': 91,
  '6m': 182,
  '1y': 365,
}

export function trendWindowStart(
  range: TrendRange,
  today: DateKey,
  earliest: DateKey | null,
): DateKey {
  if (range === 'all') return earliest ?? addDays(today, 1 - RANGE_DAYS['3m'])
  return addDays(today, 1 - RANGE_DAYS[range])
}

/** Number of week buckets from `from` through `to`, inclusive. */
export function weekCountInclusive(
  from: DateKey,
  to: DateKey,
  weekStartDay: 'monday' | 'sunday',
): number {
  const start = startOfWeek(from, weekStartDay)
  const end = startOfWeek(to, weekStartDay)
  let count = 1
  let cursor = start
  while (cursor < end) {
    cursor = addDays(cursor, 7)
    count += 1
    if (count > 520) break
  }
  return count
}

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
