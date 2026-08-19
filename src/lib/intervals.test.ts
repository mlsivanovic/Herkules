import { describe, expect, it } from 'vitest'
import { clampConfig, nextIntervalState, startInterval, type IntervalState } from './intervals'

const config = clampConfig({ prepare: 10, work: 40, rest: 20, rounds: 3 })

describe('clampConfig', () => {
  it('clamps every field to a sane range', () => {
    expect(clampConfig({ prepare: -5, work: 0, rest: 99999, rounds: 0 })).toEqual({
      prepare: 0,
      work: 5,
      rest: 3600,
      rounds: 1,
    })
  })

  it('falls back on garbage input', () => {
    expect(clampConfig({ work: Number.NaN })).toEqual(
      expect.objectContaining({ work: 30, prepare: 10, rest: 30, rounds: 8 }),
    )
  })
})

describe('interval machine', () => {
  it('starts with prepare when configured', () => {
    expect(startInterval(config)).toEqual({ phase: 'prepare', round: 1, remaining: 10 })
  })

  it('skips straight to work when prepare is zero', () => {
    expect(startInterval(clampConfig({ prepare: 0, work: 30 }))).toEqual({
      phase: 'work',
      round: 1,
      remaining: 30,
    })
  })

  it('cycles work → rest → work across rounds', () => {
    let state = startInterval(config)
    state = nextIntervalState(state, config) // prepare → work 1
    expect(state).toEqual({ phase: 'work', round: 1, remaining: 40 })
    state = nextIntervalState(state, config) // work 1 → rest
    expect(state).toEqual({ phase: 'rest', round: 1, remaining: 20 })
    state = nextIntervalState(state, config) // rest → work 2
    expect(state).toEqual({ phase: 'work', round: 2, remaining: 40 })
  })

  it('finishes after the last round', () => {
    let state: IntervalState = { phase: 'work', round: 3, remaining: 0 }
    state = nextIntervalState(state, config)
    expect(state.phase).toBe('done')
    expect(nextIntervalState(state, config)).toBe(state)
  })

  it('runs consecutive work phases when rest is zero', () => {
    const noRest = clampConfig({ prepare: 0, work: 30, rest: 0, rounds: 5 })
    let state = startInterval(noRest)
    state = nextIntervalState(state, noRest)
    expect(state).toEqual({ phase: 'work', round: 2, remaining: 30 })
  })
})
