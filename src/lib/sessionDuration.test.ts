import { describe, expect, it } from 'vitest'
import { diagnoseSessionDuration } from './sessionDuration'

describe('diagnoseSessionDuration', () => {
  it('stays quiet for a normal session that includes later conditioning', () => {
    const diagnosis = diagnoseSessionDuration({
      status: 'completed',
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: '2026-08-15T11:10:00.000Z',
      session_blocks: [
        { id: 'gym', role: 'gym' },
        { id: 'cardio', role: 'zone_2' },
      ],
      session_exercises: [
        { session_block_id: 'gym', sets: [{ completed_at: '2026-08-15T10:40:00.000Z', updated_at: '2026-08-15T10:40:00.000Z' }] },
        { session_block_id: 'cardio', sets: [{ completed_at: '2026-08-15T11:05:00.000Z', updated_at: '2026-08-15T11:05:00.000Z' }] },
      ],
    })
    expect(diagnosis.unusuallyLong).toBe(false)
    expect(diagnosis.flags).toEqual([])
  })

  it('flags an open clock, a gap after the last set, and later conditioning without changing the span', () => {
    const diagnosis = diagnoseSessionDuration({
      status: 'completed',
      started_at: '2026-08-15T08:00:00.000Z',
      ended_at: '2026-08-15T18:00:00.000Z',
      session_blocks: [
        { id: 'gym', role: 'gym' },
        { id: 'cardio', role: 'conditioning' },
      ],
      session_exercises: [
        { session_block_id: 'gym', sets: [{ completed_at: '2026-08-15T09:00:00.000Z', updated_at: '2026-08-15T09:00:00.000Z' }] },
        { session_block_id: 'cardio', sets: [{ completed_at: '2026-08-15T12:00:00.000Z', updated_at: '2026-08-15T12:00:00.000Z' }] },
      ],
    })
    expect(diagnosis.elapsedSeconds).toBe(10 * 3600)
    expect(diagnosis.flags).toContain('gap_after_last_set')
    expect(diagnosis.flags).toContain('later_conditioning')
    expect(diagnosis.flags).not.toContain('open_session')
  })
})
