import { describe, expect, it, beforeEach } from 'vitest'
import {
  calculateRemainingSeconds,
  computeTargetMs,
  extendTargetMs,
  readRestTarget,
  writeRestTarget,
} from './restTimer'

describe('restTimer', () => {
  beforeEach(() => {
    writeRestTarget(null)
  })

  it('computes target timestamp accurately', () => {
    const now = 1_000_000
    const target = computeTargetMs(90, now)
    expect(target).toBe(1_090_000)
  })

  it('calculates remaining seconds correctly', () => {
    const now = 1_000_000
    const target = 1_060_000
    expect(calculateRemainingSeconds(target, now)).toBe(60)
    expect(calculateRemainingSeconds(target, now + 50_000)).toBe(10)
    expect(calculateRemainingSeconds(target, now + 59_100)).toBe(1)
    expect(calculateRemainingSeconds(target, now + 60_000)).toBe(0)
    expect(calculateRemainingSeconds(target, now + 70_000)).toBe(0)
    expect(calculateRemainingSeconds(null, now)).toBeNull()
  })

  it('extends target timestamp when adding seconds', () => {
    const now = 1_000_000
    const initialTarget = 1_030_000 // 30s left
    const extended = extendTargetMs(initialTarget, 15, now)
    expect(extended).toBe(1_045_000) // 45s left

    // If initial target was in the past, extends from now
    const pastTarget = 900_000
    const extendedFromNow = extendTargetMs(pastTarget, 15, now)
    expect(extendedFromNow).toBe(1_015_000)
  })

  it('reads and writes target to storage', () => {
    expect(readRestTarget()).toBeNull()
    writeRestTarget(1_234_567)
    expect(readRestTarget()).toBe(1_234_567)
    writeRestTarget(null)
    expect(readRestTarget()).toBeNull()
  })
})
