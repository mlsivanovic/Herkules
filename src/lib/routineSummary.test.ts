import { describe, expect, it } from 'vitest'
import { summarizePlannedItem, type PlannedTargets } from './routineSummary'

function item(overrides: Partial<PlannedTargets> = {}): PlannedTargets {
  return {
    planned_sets: 3,
    target_weight_kg: null,
    rest_seconds: null,
    ...overrides,
  }
}

describe('summarizePlannedItem', () => {
  it('summarizes weight x reps with a range, weight and rest', () => {
    expect(
      summarizePlannedItem(
        item({
          target_weight_kg: 60,
          target_reps_min: 8,
          target_reps_max: 12,
          rest_seconds: 90,
        }),
        'weight_reps',
        'metric',
        'en',
      ),
    ).toBe('3×8–12 · 60 kg · rest 90s')
  })

  it('collapses equal min/max to a single value', () => {
    expect(
      summarizePlannedItem(item({ target_reps_min: 10, target_reps_max: 10 }), 'reps', 'metric', 'en'),
    ).toBe('3×10')
  })

  it('falls back to the legacy single-value fields', () => {
    expect(
      summarizePlannedItem(item({ target_reps: 12 }), 'reps', 'metric', 'en'),
    ).toBe('3×12')
    expect(
      summarizePlannedItem(item({ target_duration_s: 90 }), 'duration', 'metric', 'en'),
    ).toBe('3×1:30')
  })

  it('summarizes durations, distances and loaded carries', () => {
    expect(
      summarizePlannedItem(
        item({ target_duration_min_s: 30, target_duration_max_s: 60 }),
        'duration',
        'metric',
        'en',
      ),
    ).toBe('3×0:30–1:00')
    expect(
      summarizePlannedItem(
        item({ target_distance_min_m: 1000, target_distance_max_m: 2000 }),
        'distance_duration',
        'metric',
        'en',
      ),
    ).toBe('3×1–2 km')
    expect(
      summarizePlannedItem(
        item({ target_weight_kg: 20, target_distance_m: 40 }),
        'weight_distance',
        'metric',
        'en',
      ),
    ).toBe('3×20 kg · 0.04 km')
    expect(
      summarizePlannedItem(
        item({ target_weight_kg: 20, target_duration_s: 45 }),
        'weight_duration',
        'metric',
        'en',
      ),
    ).toBe('3×20 kg · 0:45')
  })

  it('converts to imperial units for display', () => {
    expect(
      summarizePlannedItem(
        item({ target_weight_kg: 60, target_reps_max: 8 }),
        'weight_reps',
        'imperial',
        'en',
      ),
    ).toBe('3×8 · 132.3 lb')
  })

  it('shows only the set count when no target is planned', () => {
    expect(summarizePlannedItem(item(), 'weight_reps', 'metric', 'en')).toBe('3 sets')
    expect(
      summarizePlannedItem(item({ planned_sets: 1 }), 'weight_reps', 'metric', 'en'),
    ).toBe('1 set')
  })

  it('pluralizes the set count in Serbian', () => {
    expect(summarizePlannedItem(item(), 'weight_reps', 'metric', 'sr')).toBe('3 serije')
    expect(
      summarizePlannedItem(item({ planned_sets: 1 }), 'weight_reps', 'metric', 'sr'),
    ).toBe('1 serija')
    expect(
      summarizePlannedItem(item({ planned_sets: 5 }), 'weight_reps', 'metric', 'sr'),
    ).toBe('5 serija')
  })

  it('translates the rest part in Serbian', () => {
    expect(
      summarizePlannedItem(item({ target_reps_max: 8, rest_seconds: 60 }), 'reps', 'metric', 'sr'),
    ).toBe('3×8 · odmor 60s')
  })
})
