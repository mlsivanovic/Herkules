import { describe, expect, it } from 'vitest'
import { formatLoggedSet } from './setDisplay'
import type { SetRow } from '../types/db'

function set(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: 'set-1',
    session_exercise_id: 'se-1',
    position: 1,
    weight_kg: 80,
    reps: 5,
    duration_s: null,
    distance_m: null,
    rpe: 8,
    notes: null,
    is_warmup: false,
    completed_at: '2026-08-17T10:10:00.000Z',
    created_at: '2026-08-17T10:10:00.000Z',
    updated_at: '2026-08-17T10:10:00.000Z',
    ...overrides,
  }
}

describe('formatLoggedSet', () => {
  it('formats weight × reps with RPE', () => {
    expect(formatLoggedSet(set(), 'weight_reps', 'metric')).toBe('80 kg × 5 @ 8')
  })

  it('formats duration and distance work', () => {
    expect(
      formatLoggedSet(set({ weight_kg: null, reps: null, duration_s: 90, rpe: null }), 'duration', 'metric'),
    ).toBe('1:30')
    expect(
      formatLoggedSet(
        set({ weight_kg: null, reps: null, duration_s: 600, distance_m: 5000, rpe: null }),
        'distance_duration',
        'metric',
      ),
    ).toBe('5 km / 10:00')
  })

  it('uses a dash when reps are missing', () => {
    expect(formatLoggedSet(set({ reps: null, rpe: null }), 'weight_reps', 'metric')).toBe('80 kg × –')
  })
})
