// Date helpers operating on local dates and 'YYYY-MM-DD' keys.
// ISO weekday convention: 1 = Monday … 7 = Sunday (matches the DB schema).

export type DateKey = string

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** ISO weekday 1 (Mon) … 7 (Sun) of the given key. */
export function isoWeekday(key: DateKey): number {
  const day = parseDateKey(key).getDay() // 0 = Sun … 6 = Sat
  return day === 0 ? 7 : day
}

/** All date keys from `from` to `to` inclusive. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const keys: DateKey[] = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return keys
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Start of the week containing `key`, honoring the user's week start. */
export function startOfWeek(key: DateKey, weekStart: 'monday' | 'sunday'): DateKey {
  const iso = isoWeekday(key) // 1..7
  const offset = weekStart === 'monday' ? iso - 1 : iso % 7
  return addDays(key, -offset)
}

const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const longFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function formatDayShort(key: DateKey): string {
  return dayFormatter.format(parseDateKey(key))
}

export function formatDateShort(key: DateKey): string {
  return dateFormatter.format(parseDateKey(key))
}

export function formatDateLong(key: DateKey): string {
  return longFormatter.format(parseDateKey(key))
}

export function formatMonthLabel(year: number, month: number): string {
  return monthFormatter.format(new Date(year, month, 1))
}

/** Grid of date keys for a month calendar view; leading/trailing days from
 * adjacent months are included so the grid is always complete weeks. */
export function monthGrid(
  year: number,
  month: number,
  weekStart: 'monday' | 'sunday',
): DateKey[] {
  const first = toDateKey(new Date(year, month, 1))
  const last = toDateKey(new Date(year, month + 1, 0))
  const gridStart = startOfWeek(first, weekStart)
  const gridEnd = startOfWeek(last, weekStart)
  const lastEnd = addDays(gridEnd, 6)
  return dateRange(gridStart, lastEnd)
}
