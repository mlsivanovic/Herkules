import { describe, expect, it } from 'vitest'
import { controlled, explosive, type ProgramItem } from './recipe'
import { formatProgramLoad, formatProgramMeta, formatRange } from './preview'

function item(patch: Partial<ProgramItem>): ProgramItem {
  return {
    exerciseId: 'ex',
    plannedSets: 3,
    tempo: controlled(),
    ...patch,
  }
}

describe('formatRange', () => {
  it('collapses equal bounds', () => {
    expect(formatRange([8, 8])).toBe('8')
    expect(formatRange([45, 45], 's')).toBe('45s')
  })

  it('keeps an en-dash span', () => {
    expect(formatRange([8, 10])).toBe('8–10')
    expect(formatRange([20, 30], ' m')).toBe('20–30 m')
  })
})

describe('formatProgramLoad', () => {
  it('formats reps, duration and distance', () => {
    expect(formatProgramLoad(item({ reps: [8, 10] }))).toBe('3 × 8–10')
    expect(formatProgramLoad(item({ durationS: [45, 60] }))).toBe('3 × 45–60s')
    expect(formatProgramLoad(item({ distanceM: [20, 20] }))).toBe('3 × 20 m')
  })

  it('falls back to sets when no target is set', () => {
    expect(formatProgramLoad(item({ plannedSets: 2 }))).toBe('2 ×')
  })
})

describe('formatProgramMeta', () => {
  it('includes RPE, rest and tempo', () => {
    expect(
      formatProgramMeta(
        item({ rpe: [6, 7], restSeconds: 120, tempo: explosive }),
      ),
    ).toEqual(['RPE 6–7', '120s', '1-0-X-0'])
  })
})
