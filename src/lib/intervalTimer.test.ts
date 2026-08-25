import { describe, expect, it } from 'vitest'
import {
  advanceIntervalTimer,
  pauseIntervalTimer,
  resumeIntervalTimer,
  skipIntervalPhase,
  startIntervalTimer,
} from './intervalTimer'

const config = { prepare: 10, work: 30, rest: 20, rounds: 3 }

describe('timestamp interval timer', () => {
  it('derives the countdown from the phase deadline', () => {
    const state = startIntervalTimer(config, 1_000)
    expect(advanceIntervalTimer(state, 5_100)).toMatchObject({
      phase: 'prepare',
      round: 1,
      remaining: 6,
      targetMs: 11_000,
    })
  })

  it('catches up through multiple phases after backgrounding', () => {
    const state = startIntervalTimer(config, 0)
    expect(advanceIntervalTimer(state, 65_000)).toMatchObject({
      phase: 'work',
      round: 2,
      remaining: 25,
      targetMs: 90_000,
    })
  })

  it('finishes when the whole sequence elapsed', () => {
    const state = startIntervalTimer(config, 0)
    expect(advanceIntervalTimer(state, 200_000)).toMatchObject({
      phase: 'done',
      round: 3,
      remaining: 0,
      targetMs: null,
    })
  })

  it('pauses and resumes with a fresh deadline', () => {
    const running = startIntervalTimer({ ...config, prepare: 0 }, 1_000)
    const paused = pauseIntervalTimer(running, 11_100)
    expect(paused).toMatchObject({ paused: true, remaining: 20, targetMs: null })
    expect(resumeIntervalTimer(paused, 20_000)).toMatchObject({
      paused: false,
      remaining: 20,
      targetMs: 40_000,
    })
  })

  it('skips to the next phase without losing paused state', () => {
    const paused = pauseIntervalTimer(startIntervalTimer(config, 0), 2_000)
    expect(skipIntervalPhase(paused, 5_000)).toMatchObject({
      phase: 'work',
      round: 1,
      remaining: 30,
      paused: true,
      targetMs: null,
    })
  })
})
