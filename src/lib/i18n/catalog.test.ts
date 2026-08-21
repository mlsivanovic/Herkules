import { describe, expect, it } from 'vitest'
import {
  displayExerciseInstructions,
  displayExerciseName,
  displaySnapshotName,
  displayTag,
  exerciseMatchesQuery,
} from './catalog'

const squat = {
  id: '11111111-1111-4111-8111-111111111101',
  owner_id: null,
  name: 'Barbell Back Squat',
  instructions: 'English instructions.',
}

const custom = {
  id: 'custom-1',
  owner_id: 'user',
  name: 'Moja vežba',
  instructions: 'Kako ja radim.',
}

describe('displayExerciseName', () => {
  it('translates system exercises in Serbian', () => {
    expect(displayExerciseName(squat, 'sr')).toBe('Čučanj sa šipkom (leđa)')
    expect(displayExerciseName(squat, 'en')).toBe('Barbell Back Squat')
  })

  it('keeps custom exercise names', () => {
    expect(displayExerciseName(custom, 'sr')).toBe('Moja vežba')
  })

  it('falls back to English when an id has no overlay', () => {
    expect(
      displayExerciseName({ id: 'missing', owner_id: null, name: 'Unknown Move' }, 'sr'),
    ).toBe('Unknown Move')
  })
})

describe('displayExerciseInstructions', () => {
  it('uses Serbian copy for system exercises', () => {
    const text = displayExerciseInstructions(squat, 'sr')
    expect(text).toBeTruthy()
    expect(text).not.toBe(squat.instructions)
  })

  it('keeps custom instructions', () => {
    expect(displayExerciseInstructions(custom, 'sr')).toBe('Kako ja radim.')
  })
})

describe('displaySnapshotName', () => {
  it('looks up by exercise id', () => {
    expect(displaySnapshotName('Barbell Back Squat', squat.id, 'sr')).toBe(
      'Čučanj sa šipkom (leđa)',
    )
  })
})

describe('exerciseMatchesQuery', () => {
  it('matches English and Serbian names', () => {
    expect(exerciseMatchesQuery(squat, 'čučanj')).toBe(true)
    expect(exerciseMatchesQuery(squat, 'barbell')).toBe(true)
    expect(exerciseMatchesQuery(squat, 'xyz')).toBe(false)
  })
})

describe('displayTag', () => {
  it('translates known muscle and equipment tags', () => {
    expect(displayTag('quads', 'sr')).toBe('kvadriceps')
    expect(displayTag('barbell', 'sr')).toBe('šipka')
    expect(displayTag('mystery', 'sr')).toBe('mystery')
  })
})
