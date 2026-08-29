import { describe, expect, it } from 'vitest'
import {
  assertCapability,
  capabilitiesFor,
  isLightAccount,
  programmingForAccount,
  startableProgrammingForAccount,
} from './capabilities'

describe('capabilitiesFor', () => {
  it('treats a missing profile as a full account', () => {
    const caps = capabilitiesFor(null)
    expect(caps.kind).toBe('full')
    expect(caps.canCreateRoutines).toBe(true)
    expect(caps.navCoach).toBe(false)
  })

  it('unlocks coach nav only when is_coach is set', () => {
    const caps = capabilitiesFor({ account_kind: 'full', is_coach: true })
    expect(caps.navCoach).toBe(true)
    expect(caps.canEnableCoach).toBe(true)
  })

  it('restricts light accounts', () => {
    const caps = capabilitiesFor({ account_kind: 'light', is_coach: false })
    expect(caps.canCreateRoutines).toBe(false)
    expect(caps.canCreateExercises).toBe(false)
    expect(caps.canStartEmptyWorkout).toBe(false)
    expect(caps.canImportExport).toBe(false)
    expect(caps.canEnableCoach).toBe(false)
    expect(caps.canRestructureWorkout).toBe(false)
    expect(caps.navRoutines).toBe(false)
    expect(caps.navExercises).toBe(false)
    expect(caps.navCoach).toBe(false)
    expect(isLightAccount({ account_kind: 'light' })).toBe(true)
  })

  it('ignores is_coach on a light profile', () => {
    const caps = capabilitiesFor({ account_kind: 'light', is_coach: true })
    expect(caps.isCoach).toBe(false)
    expect(caps.navCoach).toBe(false)
  })
})

describe('programmingForAccount', () => {
  it('hides unlocked rows from light accounts', () => {
    const rows = [{ id: 'a', locked: true }, { id: 'b', locked: false }]
    expect(programmingForAccount(rows, { account_kind: 'light' }).map((row) => row.id)).toEqual(['a'])
    expect(programmingForAccount(rows, { account_kind: 'full' })).toHaveLength(2)
  })
})

describe('startableProgrammingForAccount', () => {
  const plans = [
    { id: 'plan-a', locked: true },
    { id: 'plan-b', locked: false },
  ]
  const templates = [
    { id: 'day-a', plan_id: 'plan-a', locked: true },
    { id: 'loose-locked', plan_id: null, locked: true },
    { id: 'day-b', plan_id: 'plan-b', locked: false },
  ]

  it('lets full accounts start any routine, including unassigned', () => {
    const result = startableProgrammingForAccount(plans, templates, { account_kind: 'full' })
    expect(result.templates.map((row) => row.id)).toEqual(['day-a', 'loose-locked', 'day-b'])
  })

  it('lets athletes start only routines on assigned plans', () => {
    const result = startableProgrammingForAccount(plans, templates, { account_kind: 'light' })
    expect(result.plans.map((row) => row.id)).toEqual(['plan-a'])
    expect(result.templates.map((row) => row.id)).toEqual(['day-a'])
  })
})

describe('assertCapability', () => {
  it('throws the provided message when denied', () => {
    expect(() => assertCapability(false, 'nope')).toThrow('nope')
    expect(() => assertCapability(true, 'nope')).not.toThrow()
  })
})
