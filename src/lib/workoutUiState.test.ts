import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAllWorkoutUi,
  clearSessionWorkoutUi,
  readSetDrafts,
  readWorkoutFocus,
  writeSetDraft,
  writeWorkoutFocus,
} from './workoutUiState'

const draft = {
  weight: '82,',
  bodyweight: false,
  reps: '8',
  duration: '',
  distance: '',
  rpe: '',
}

describe('workout UI state', () => {
  afterEach(() => clearAllWorkoutUi())

  it('keeps focus and drafts per user and session', () => {
    writeWorkoutFocus('user-a', 'session-1', { exerciseId: 'ex', setId: 'set' })
    writeWorkoutFocus('user-b', 'session-1', { exerciseId: 'other', setId: 'set-b' })
    writeSetDraft('user-a', 'session-1', 'set', draft)
    expect(readWorkoutFocus('user-a', 'session-1')).toEqual({ exerciseId: 'ex', setId: 'set' })
    expect(readWorkoutFocus('user-b', 'session-1')?.exerciseId).toBe('other')
    expect(readSetDrafts('user-a', 'session-1').set?.weight).toBe('82,')
    expect(readSetDrafts('user-b', 'session-1')).toEqual({})
  })

  it('clears one session and a logged-out user separately', () => {
    writeWorkoutFocus('user-a', 'session-1', { exerciseId: 'ex', setId: 'set' })
    writeSetDraft('user-a', 'session-2', 'set', draft)
    clearSessionWorkoutUi('session-1')
    expect(readWorkoutFocus('user-a', 'session-1')).toBeNull()
    expect(readSetDrafts('user-a', 'session-2').set?.reps).toBe('8')
    clearAllWorkoutUi()
    expect(readSetDrafts('user-a', 'session-2')).toEqual({})
  })
})
