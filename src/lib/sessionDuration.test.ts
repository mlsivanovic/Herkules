import { describe, expect, it } from 'vitest'
import { diagnoseSessionDuration, sessionDurationSeconds } from './sessionDuration'

const blocks = [
  { id: 'gym', role: 'gym' },
  { id: 'cardio', role: 'zone_2' },
]

describe('sessionDurationSeconds', () => {
  it('stops at the last logged set when finish was much later', () => {
    const seconds = sessionDurationSeconds({
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: '2026-08-15T22:00:00.000Z',
      session_exercises: [
        { sets: [{ completed_at: '2026-08-15T10:20:00.000Z' }, { completed_at: null }] },
        { sets: [{ completed_at: '2026-08-15T11:05:00.000Z' }] },
      ],
    })
    expect(seconds).toBe(65 * 60)
  })

  it('includes a later conditioning set because it was logged', () => {
    const seconds = sessionDurationSeconds({
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: '2026-08-15T11:10:00.000Z',
      session_exercises: [
        { sets: [{ completed_at: '2026-08-15T10:40:00.000Z' }] },
        { sets: [{ completed_at: '2026-08-15T11:05:00.000Z' }] },
      ],
    })
    expect(seconds).toBe(65 * 60)
  })

  it('falls back to the finish time when nothing was logged', () => {
    expect(sessionDurationSeconds({
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: '2026-08-15T10:12:00.000Z',
      session_exercises: [{ sets: [{ completed_at: null }] }],
    })).toBe(12 * 60)
  })

  it('uses now only while an empty session is still open', () => {
    expect(sessionDurationSeconds({
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: null,
      session_exercises: [],
    }, Date.parse('2026-08-15T10:05:00.000Z'))).toBe(5 * 60)
    expect(sessionDurationSeconds({
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: null,
      session_exercises: [],
    })).toBeNull()
  })
})

describe('diagnoseSessionDuration', () => {
  it('stays quiet for a normal session that includes later conditioning', () => {
    const diagnosis = diagnoseSessionDuration({
      status: 'completed',
      started_at: '2026-08-15T10:00:00.000Z',
      ended_at: '2026-08-15T11:10:00.000Z',
      session_blocks: blocks,
      session_exercises: [
        { session_block_id: 'gym', sets: [{ completed_at: '2026-08-15T10:40:00.000Z' }] },
        { session_block_id: 'cardio', sets: [{ completed_at: '2026-08-15T11:05:00.000Z' }] },
      ],
    })
    expect(diagnosis.elapsedSeconds).toBe(65 * 60)
    expect(diagnosis.unusuallyLong).toBe(false)
    expect(diagnosis.flags).toEqual([])
  })

  it('does not treat a forgotten finish as a long workout', () => {
    const diagnosis = diagnoseSessionDuration({
      status: 'completed',
      started_at: '2026-08-15T08:00:00.000Z',
      ended_at: '2026-08-15T18:00:00.000Z',
      session_blocks: [
        { id: 'gym', role: 'gym' },
        { id: 'cardio', role: 'conditioning' },
      ],
      session_exercises: [
        { session_block_id: 'gym', sets: [{ completed_at: '2026-08-15T09:00:00.000Z' }] },
        { session_block_id: 'cardio', sets: [{ completed_at: '2026-08-15T09:40:00.000Z' }] },
      ],
    })
    expect(diagnosis.elapsedSeconds).toBe(100 * 60)
    expect(diagnosis.unusuallyLong).toBe(false)
    expect(diagnosis.flags).toEqual([])
  })

  it('still flags a logged span that really ran long, including later conditioning', () => {
    const diagnosis = diagnoseSessionDuration({
      status: 'completed',
      started_at: '2026-08-15T08:00:00.000Z',
      ended_at: '2026-08-15T18:00:00.000Z',
      session_blocks: [
        { id: 'gym', role: 'gym' },
        { id: 'cardio', role: 'conditioning' },
      ],
      session_exercises: [
        { session_block_id: 'gym', sets: [{ completed_at: '2026-08-15T09:00:00.000Z' }] },
        { session_block_id: 'cardio', sets: [{ completed_at: '2026-08-15T13:30:00.000Z' }] },
      ],
    })
    expect(diagnosis.elapsedSeconds).toBe(5.5 * 3600)
    expect(diagnosis.unusuallyLong).toBe(true)
    expect(diagnosis.flags).toContain('gap_after_last_set')
    expect(diagnosis.flags).toContain('later_conditioning')
    expect(diagnosis.flags).not.toContain('open_session')
  })
})
