import { describe, expect, it } from 'vitest'
import { trendWindowStart, valueOnOrBefore, weekCountInclusive, weeklyValues } from './trendChart'

describe('weekly body-metric alignment', () => {
  it('returns the last value on or before a date', () => {
    const entries = [
      { date: '2026-07-01', value: 80 },
      { date: '2026-08-10', value: 78 },
      { date: '2026-08-20', value: 77.5 },
    ]
    expect(valueOnOrBefore(entries, '2026-06-30')).toBeNull()
    expect(valueOnOrBefore(entries, '2026-07-01')).toBe(80)
    expect(valueOnOrBefore(entries, '2026-08-09')).toBe(80)
    expect(valueOnOrBefore(entries, '2026-08-10')).toBe(78)
    expect(valueOnOrBefore(entries, '2026-08-25')).toBe(77.5)
  })

  it('samples each week at week-end and carries the last known value forward', () => {
    const weeks = ['2026-08-03', '2026-08-10', '2026-08-17']
    const values = weeklyValues(weeks, [
      { date: '2026-08-12', value: 82 },
      { date: '2026-08-19', value: 81 },
    ])
    expect(values.map((row) => row.value)).toEqual([null, 82, 81])
    expect(values.map((row) => row.recorded)).toEqual([false, true, true])
  })

  it('carries the last reading into later weeks without marking them as recorded', () => {
    const values = weeklyValues(['2026-08-03', '2026-08-10', '2026-08-17'], [
      { date: '2026-08-12', value: 82 },
    ])
    expect(values.map((row) => row.value)).toEqual([null, 82, 82])
    expect(values.map((row) => row.recorded)).toEqual([false, true, false])
  })
})

describe('trend window', () => {
  it('counts week buckets from the window start through today', () => {
    expect(weekCountInclusive('2026-08-01', '2026-08-23', 'monday')).toBe(4)
    expect(weekCountInclusive('2026-08-17', '2026-08-23', 'monday')).toBe(1)
  })

  it('uses the first entry for the all-time window', () => {
    expect(trendWindowStart('all', '2026-08-23', '2026-01-15')).toBe('2026-01-15')
    expect(trendWindowStart('1m', '2026-08-23', '2026-01-15')).toBe('2026-07-25')
  })
})
