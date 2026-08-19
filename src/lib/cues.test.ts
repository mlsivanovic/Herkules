import { describe, expect, it } from 'vitest'
import {
  playDoubleBeep,
  setSoundEnabled,
  setVibrationEnabled,
  soundEnabled,
  timerCue,
  vibrateCue,
  vibrationEnabled,
} from './cues'

describe('cues', () => {
  it('defaults both cues to enabled and never throws', () => {
    expect(soundEnabled()).toBe(true)
    expect(vibrationEnabled()).toBe(true)
    expect(() => setSoundEnabled(false)).not.toThrow()
    expect(() => setVibrationEnabled(false)).not.toThrow()
    expect(() => timerCue()).not.toThrow()
    expect(() => playDoubleBeep()).not.toThrow()
    expect(() => vibrateCue()).not.toThrow()
  })
})
