import { describe, expect, it } from 'vitest'
import type { RecurrenceRuleRow, ScheduleItemRow } from '../types/db'
import { addDays, dateRange, isoWeekday, monthGrid, startOfWeek } from './dates'
import { dayStatus, occurrencesInRange, ruleOccursOn } from './recurrence'

function makeRule(overrides: Partial<RecurrenceRuleRow> = {}): RecurrenceRuleRow {
  return {
    id: 'rule-1',
    owner_id: 'u1',
    frequency: 'weekly',
    weekdays: [1, 3, 5], // Mon, Wed, Fri
    start_date: '2026-08-03',
    end_date: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function makeSchedule(overrides: Partial<ScheduleItemRow> = {}): ScheduleItemRow {
  return {
    id: 'sch-1',
    owner_id: 'u1',
    template_id: 'tpl-1',
    scheduled_date: null,
    recurrence_rule_id: 'rule-1',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('date helpers', () => {
  it('maps weekdays to ISO numbers (Mon=1 … Sun=7)', () => {
    expect(isoWeekday('2026-08-17')).toBe(1) // Monday
    expect(isoWeekday('2026-08-19')).toBe(3) // Wednesday
    expect(isoWeekday('2026-08-23')).toBe(7) // Sunday
  })

  it('adds days across month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-08-17', '2026-08-19')).toHaveLength(3)
    expect(dateRange('2026-08-17', '2026-08-16')).toHaveLength(0)
  })

  it('computes week starts honoring user preference', () => {
    expect(startOfWeek('2026-08-19', 'monday')).toBe('2026-08-17') // Wed -> Mon
    expect(startOfWeek('2026-08-16', 'monday')).toBe('2026-08-10') // Sun belongs to previous week
    expect(startOfWeek('2026-08-16', 'sunday')).toBe('2026-08-16')
  })

  it('month grid always spans whole weeks', () => {
    const grid = monthGrid(2026, 7, 'monday') // August 2026
    expect(grid.length % 7).toBe(0)
    expect(grid[0]).toBe('2026-07-27') // Monday before Aug 1 (a Saturday)
    expect(grid[grid.length - 1]).toBe('2026-09-06') // Sunday after Aug 31 (a Monday)
  })
})

describe('rule occurrences', () => {
  it('occurs only on selected weekdays within the window', () => {
    const rule = makeRule()
    expect(ruleOccursOn(rule, '2026-08-17')).toBe(true) // Mon
    expect(ruleOccursOn(rule, '2026-08-18')).toBe(false) // Tue
    expect(ruleOccursOn(rule, '2026-08-19')).toBe(true) // Wed
  })

  it('respects start and end dates', () => {
    const rule = makeRule({ start_date: '2026-08-10', end_date: '2026-08-20' })
    expect(ruleOccursOn(rule, '2026-08-07')).toBe(false) // Fri before start
    expect(ruleOccursOn(rule, '2026-08-14')).toBe(true)
    expect(ruleOccursOn(rule, '2026-08-21')).toBe(false) // Fri after end
  })

  it('expands occurrences across a week', () => {
    const refs = [{ schedule: makeSchedule(), rule: makeRule() }]
    const occurrences = occurrencesInRange(refs, '2026-08-17', '2026-08-23')
    expect(occurrences.map((o) => o.key)).toEqual([
      '2026-08-17',
      '2026-08-19',
      '2026-08-21',
    ])
  })

  it('matches single-date schedules exactly once', () => {
    const refs = [
      {
        schedule: makeSchedule({ scheduled_date: '2026-08-18', recurrence_rule_id: null }),
        rule: null,
      },
    ]
    const occurrences = occurrencesInRange(refs, '2026-08-17', '2026-08-23')
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]?.key).toBe('2026-08-18')
  })
})

describe('day status derivation', () => {
  const today = '2026-08-17'

  it('planned today stays planned, past planned becomes skipped', () => {
    expect(dayStatus(today, 1, 0, false, today)).toBe('planned')
    expect(dayStatus('2026-08-10', 1, 0, false, today)).toBe('skipped')
    expect(dayStatus('2026-08-24', 1, 0, false, today)).toBe('planned')
  })

  it('completed beats planned and skipped', () => {
    expect(dayStatus('2026-08-10', 1, 1, false, today)).toBe('completed')
    expect(dayStatus(today, 2, 1, false, today)).toBe('completed')
  })

  it('in-progress wins over everything', () => {
    expect(dayStatus(today, 1, 1, true, today)).toBe('in-progress')
  })

  it('returns null for rest days', () => {
    expect(dayStatus('2026-08-10', 0, 0, false, today)).toBe(null)
  })

  it('explicit skip marks today as skipped, but completed still wins', () => {
    expect(dayStatus(today, 1, 0, false, today, 1)).toBe('skipped')
    expect(dayStatus(today, 1, 1, false, today, 1)).toBe('completed')
    expect(dayStatus(today, 1, 0, true, today, 1)).toBe('in-progress')
  })
})
