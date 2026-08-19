import { describe, expect, it } from 'vitest'
import { isoWeekday } from '../dates'
import { hybridSlotForIndex, rotationOccurrences } from './rotate'

describe('rotationOccurrences', () => {
  it('2×: week 1 A–B, week 2 C–D', () => {
    const result = rotationOccurrences({
      frequency: 2,
      weekdays: [1, 4],
      start: '2026-08-17', // Monday
      weeks: 2,
    })
    expect(result).toEqual([
      { date: '2026-08-17', dayIndex: 0 },
      { date: '2026-08-20', dayIndex: 1 },
      { date: '2026-08-24', dayIndex: 2 },
      { date: '2026-08-27', dayIndex: 3 },
    ])
    expect(result.map((row) => hybridSlotForIndex(row.dayIndex))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('3× wraps D → A across weeks', () => {
    const result = rotationOccurrences({
      frequency: 3,
      weekdays: [1, 3, 5],
      start: '2026-08-17',
      weeks: 2,
    })
    expect(result.map((row) => hybridSlotForIndex(row.dayIndex))).toEqual(['A', 'B', 'C', 'D', 'A', 'B'])
    expect(result.map((row) => isoWeekday(row.date))).toEqual([1, 3, 5, 1, 3, 5])
  })

  it('4× places one of each slot per week on Mon/Wed/Fri/Sat', () => {
    const result = rotationOccurrences({
      frequency: 4,
      weekdays: [1, 3, 5, 6],
      start: '2026-08-17',
      weeks: 2,
    })
    expect(result).toHaveLength(8)
    expect(result.slice(0, 4).map((row) => hybridSlotForIndex(row.dayIndex))).toEqual(['A', 'B', 'C', 'D'])
    expect(result.slice(4).map((row) => hybridSlotForIndex(row.dayIndex))).toEqual(['A', 'B', 'C', 'D'])
    expect(result[0]?.date).toBe('2026-08-17')
    expect(result[1]?.date).toBe('2026-08-19')
    expect(result[2]?.date).toBe('2026-08-21')
    expect(result[3]?.date).toBe('2026-08-22')
  })

  it('wraps a 3-day plan independently of Hybrid A–D', () => {
    const result = rotationOccurrences({
      frequency: 3,
      weekdays: [1, 3, 5],
      start: '2026-08-17',
      weeks: 2,
      dayCount: 3,
    })
    expect(result.map((row) => row.dayIndex)).toEqual([0, 1, 2, 0, 1, 2])
  })

  it('returns nothing when weekdays or weeks are empty', () => {
    expect(rotationOccurrences({ frequency: 2, weekdays: [], start: '2026-08-17', weeks: 4 })).toEqual([])
    expect(rotationOccurrences({ frequency: 2, weekdays: [1, 4], start: '2026-08-17', weeks: 0 })).toEqual(
      [],
    )
  })
})
