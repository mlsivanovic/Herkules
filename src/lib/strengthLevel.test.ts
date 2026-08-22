import { describe, expect, it } from 'vitest'
import type { SessionDoc, SessionExerciseDoc, SetRow } from '../types/db'
import { SYS } from './programs/exercises'
import { strengthFromHistory } from './strengthLevel'

let seq = 0
function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  seq += 1
  return {
    id: `set-${seq}`,
    session_exercise_id: 'se-1',
    position: seq,
    weight_kg: null,
    reps: null,
    duration_s: null,
    distance_m: null,
    rpe: null,
    notes: null,
    is_warmup: false,
    completed_at: '2026-08-15T10:00:00Z',
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    ...overrides,
  }
}

function makeSessionEx(
  overrides: Partial<SessionExerciseDoc> = {},
  sets: SetRow[] = [],
): SessionExerciseDoc {
  return {
    id: 'se-1',
    session_id: 's-1',
    exercise_id: 'ex-1',
    name_snapshot: 'Bench Press',
    measurement_snapshot: 'weight_reps',
    position: 0,
    planned_sets: 3,
    rest_seconds: null,
    tempo: null,
    notes: null,
    superset_group: null,
    block_role: 'gym',
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    sets,
    ...overrides,
  }
}

function makeSession(overrides: Partial<SessionDoc> = {}): SessionDoc {
  return {
    id: 's-1',
    owner_id: 'u1',
    template_id: null,
    schedule_item_id: null,
    name: 'Push',
    status: 'completed',
    planned_date: null,
    started_at: '2026-08-15T10:00:00Z',
    ended_at: '2026-08-15T11:00:00Z',
    notes: null,
    rpe: null,
    created_at: '2026-08-15T10:00:00Z',
    updated_at: '2026-08-15T10:00:00Z',
    session_exercises: [],
    ...overrides,
  }
}

describe('strengthFromHistory', () => {
  it('returns empty when no big lifts are logged', () => {
    const summary = strengthFromHistory([], 80, 'male')
    expect(summary.lifts).toEqual([])
    expect(summary.overall).toBeNull()
  })

  it('matches system ids and English name snapshots', () => {
    const byId = makeSession({
      session_exercises: [
        makeSessionEx(
          { id: 'se-sq', exercise_id: SYS.barbellBackSquat, name_snapshot: 'Barbell Back Squat' },
          [makeSet({ session_exercise_id: 'se-sq', weight_kg: 120, reps: 5 })],
        ),
      ],
    })
    const byName = makeSession({
      id: 's-2',
      session_exercises: [
        makeSessionEx(
          { id: 'se-bp', exercise_id: null, name_snapshot: 'Bench Press' },
          [makeSet({ session_exercise_id: 'se-bp', weight_kg: 80, reps: 5 })],
        ),
      ],
    })
    const summary = strengthFromHistory([byId, byName], 80, 'male')
    const squat = summary.lifts.find((row) => row.lift === 'squat')
    const bench = summary.lifts.find((row) => row.lift === 'bench')
    expect(squat?.ratio).toBeCloseTo((120 * (1 + 5 / 30)) / 80, 5)
    expect(squat?.level).toBe('intermediate')
    expect(bench?.level).toBe('novice')
    expect(summary.overall).toBeTruthy()
  })

  it('uses pull-up bodyweight reps, ignoring added-weight sets', () => {
    const session = makeSession({
      session_exercises: [
        makeSessionEx(
          { id: 'se-pu', exercise_id: SYS.pullUp, name_snapshot: 'Pull-Up' },
          [
            makeSet({ session_exercise_id: 'se-pu', weight_kg: 0, reps: 10 }),
            makeSet({ session_exercise_id: 'se-pu', weight_kg: 20, reps: 3 }),
          ],
        ),
      ],
    })
    const summary = strengthFromHistory([session], 80, 'male')
    const pull = summary.lifts.find((row) => row.lift === 'pullUp')
    expect(pull?.reps).toBe(10)
    expect(pull?.level).toBe('intermediate')
  })

  it('ignores warm-up and incomplete sets', () => {
    const session = makeSession({
      session_exercises: [
        makeSessionEx(
          { id: 'se-dl', exercise_id: SYS.deadlift, name_snapshot: 'Deadlift' },
          [
            makeSet({ session_exercise_id: 'se-dl', weight_kg: 200, reps: 5, is_warmup: true }),
            makeSet({
              session_exercise_id: 'se-dl',
              weight_kg: 180,
              reps: 5,
              completed_at: null,
            }),
          ],
        ),
      ],
    })
    expect(strengthFromHistory([session], 80, 'male').lifts).toEqual([])
  })
})
