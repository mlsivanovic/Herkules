import { describe, expect, it } from 'vitest'
import { primarySectionForPath } from './navigation'

describe('primarySectionForPath', () => {
  it('maps the three primary destinations', () => {
    expect(primarySectionForPath('/')).toBe('today')
    expect(primarySectionForPath('/calendar')).toBe('plan')
    expect(primarySectionForPath('/progress')).toBe('progress')
  })

  it('keeps editors and deep links inside their parent section', () => {
    expect(primarySectionForPath('/routines/new')).toBe('plan')
    expect(primarySectionForPath('/plans/plan-1')).toBe('plan')
    expect(primarySectionForPath('/exercises/exercise-1')).toBe('plan')
    expect(primarySectionForPath('/history/session-1')).toBe('progress')
  })

  it('does not mark profile or workout routes as a primary section', () => {
    expect(primarySectionForPath('/settings')).toBeNull()
    expect(primarySectionForPath('/workout')).toBeNull()
  })
})
