import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  formatDuration,
  formatHeight,
  formatWeight,
  ageYears,
  bodyMassIndex,
  formatGirth,
  heightToCm,
  kmToM,
  lbToKg,
  mToKm,
  mToMi,
  miToM,
  kgToLb,
  weightForInput,
  weightToKg,
  distanceForInput,
  distanceToM,
} from './units'

describe('weight conversion', () => {
  it('round-trips kg and lb without drift', () => {
    const kg = 82.5
    const back = lbToKg(kgToLb(kg))
    expect(back).toBeCloseTo(kg, 6)
  })

  it('formats metric and imperial weights', () => {
    expect(formatWeight(82.5, 'metric')).toBe('82.5 kg')
    expect(formatWeight(100, 'metric')).toBe('100 kg')
    // 100 kg ≈ 220.5 lb
    expect(formatWeight(100, 'imperial')).toMatch(/^220\.5 lb$/)
  })

  it('converts display input back to canonical kg', () => {
    expect(weightToKg(100, 'metric')).toBe(100)
    expect(weightToKg(220.462, 'imperial')).toBeCloseTo(100, 1)
  })

  it('renders weight inputs without trailing zeros', () => {
    expect(weightForInput(60, 'metric')).toBe('60')
    expect(weightForInput(62.5, 'metric')).toBe('62.5')
    expect(weightForInput(null, 'metric')).toBe('')
  })
})

describe('distance conversion', () => {
  it('converts km and miles to meters', () => {
    expect(kmToM(5)).toBe(5000)
    expect(miToM(3.1)).toBe(4989) // 3.1 mi × 1609.344 = 4988.97
  })

  it('formats distances', () => {
    expect(formatDistance(5020, 'metric')).toBe('5.02 km')
    expect(formatDistance(5000, 'metric')).toBe('5 km')
    expect(formatDistance(1609.344, 'imperial')).toBe('1 mi')
  })

  it('converts display input back to meters', () => {
    expect(distanceToM(5, 'metric')).toBe(5000)
    expect(distanceToM(3.10686, 'imperial')).toBe(5000)
  })

  it('renders distance inputs', () => {
    expect(distanceForInput(5000, 'metric')).toBe('5')
    expect(distanceForInput(5020, 'metric')).toBe('5.02')
    expect(distanceForInput(null, 'metric')).toBe('')
  })

  it('mToKm / mToMi are exact inverses up to meter rounding', () => {
    expect(mToKm(5000)).toBe(5)
    expect(mToMi(miToM(13.1))).toBeCloseTo(13.1, 3)
  })
})

describe('duration formatting', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('formats hours as h:mm:ss', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(7200)).toBe('2:00:00')
  })

  it('clamps negative input', () => {
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('body stats', () => {
  it('computes age from a birthday that has already happened this year', () => {
    expect(ageYears('1990-01-01', '2026-08-17')).toBe(36)
  })

  it('computes age from a birthday still ahead this year', () => {
    expect(ageYears('1990-12-01', '2026-08-17')).toBe(35)
  })

  it('formats height in both systems', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm')
    expect(formatHeight(180, 'imperial')).toBe('5\'11"')
  })

  it('converts display inches back to cm', () => {
    expect(heightToCm(70, 'imperial')).toBeCloseTo(177.8, 1)
  })

  it('computes BMI', () => {
    expect(bodyMassIndex(80, 180)).toBe(24.7)
  })

  it('formats girth in both systems', () => {
    expect(formatGirth(85, 'metric')).toBe('85 cm')
    expect(formatGirth(85, 'imperial')).toBe('33.5 in')
  })
})
