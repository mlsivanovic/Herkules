import { describe, expect, it } from 'vitest'
import { plateIncrement, warmupSets } from './warmup'

describe('warmupSets', () => {
  it('ramps 40/60/80 percent with 5/3/2 reps, rounded to plates', () => {
    expect(warmupSets(100, 'metric', 20)).toEqual([
      { weight: 40, reps: 5, percent: 0.4 },
      { weight: 60, reps: 3, percent: 0.6 },
      { weight: 80, reps: 2, percent: 0.8 },
    ])
  })

  it('rounds odd percentages to the smallest plate increment', () => {
    // 52.5 kg working weight: 40% = 21 → 20, 60% = 31.5 → 32.5, 80% = 42 → 42.5
    expect(warmupSets(52.5, 'metric', 20).map((s) => s.weight)).toEqual([20, 32.5, 42.5])
  })

  it('never goes below the empty bar', () => {
    // 30 kg working weight: 40% = 12.5 < bar → clamp to 20
    const sets = warmupSets(30, 'metric', 20)
    expect(sets[0].weight).toBe(20)
  })

  it('skips steps that repeat a weight for light lifts', () => {
    // 25 kg: 40% → 12.5 → clamp 20; 60% → 12.5 → clamp 20 (dup, skipped);
    // 80% → 17.5 → 17.5 >= ... no: 17.5 < 25 → kept? roundTo(20) — see assertion.
    const sets = warmupSets(25, 'metric', 20)
    const weights = sets.map((s) => s.weight)
    expect(new Set(weights).size).toBe(weights.length)
    expect(weights.every((w) => w >= 20 && w < 25)).toBe(true)
  })

  it('returns nothing for weights at or below the bar', () => {
    expect(warmupSets(20, 'metric', 20)).toEqual([])
  })

  it('uses 5 lb increments for imperial', () => {
    expect(plateIncrement('imperial')).toBe(5)
    // 40% of 185 lb = 74 → 75; 60% = 111 → 110; 80% = 148 → 150? 148/5=29.6 → 150 < 185 ok
    expect(warmupSets(185, 'imperial', 45).map((s) => s.weight)).toEqual([75, 110, 150])
  })
})
