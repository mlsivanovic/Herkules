import { describe, expect, it } from 'vitest'
import {
  aerobicGoalSeconds,
  clampAerobicGoalMinutes,
  DEFAULT_AEROBIC_GOAL_MINUTES,
  resolveAerobicGoalMinutes,
} from './aerobicGoal'

describe('aerobic goal minutes', () => {
  it('defaults missing and non-numeric values to 150', () => {
    expect(resolveAerobicGoalMinutes(undefined)).toBe(DEFAULT_AEROBIC_GOAL_MINUTES)
    expect(resolveAerobicGoalMinutes(null)).toBe(150)
    expect(clampAerobicGoalMinutes(Number.NaN)).toBe(150)
    expect(clampAerobicGoalMinutes(Number.POSITIVE_INFINITY)).toBe(150)
  })

  it('rounds and clamps to 1–2000', () => {
    expect(clampAerobicGoalMinutes(0)).toBe(1)
    expect(clampAerobicGoalMinutes(-20)).toBe(1)
    expect(clampAerobicGoalMinutes(179.6)).toBe(180)
    expect(clampAerobicGoalMinutes(2001)).toBe(2000)
  })

  it('converts the weekly goal to seconds', () => {
    expect(aerobicGoalSeconds(150)).toBe(150 * 60)
    expect(aerobicGoalSeconds(30)).toBe(1800)
  })
})
