import { describe, expect, it } from 'vitest'
import type { SessionBlockRow, SessionDoc, SessionExerciseRow, SetRow } from '../types/db'
import {
  aerobicSecondsInWeek,
  cycleWeek,
  isBlockRoundComplete,
  isSetGroupComplete,
  materializePlannedSets,
  progressionSuggestions,
  snapshotBlock,
} from './prescription'

const NOW = '2026-08-20T12:00:00.000Z'

function exercise(patch: Partial<SessionExerciseRow> = {}): SessionExerciseRow {
  return {
    id: 'se-1', session_id: 's-1', exercise_id: 'e-1', name_snapshot: 'Split squat',
    measurement_snapshot: 'weight_reps', position: 0, planned_sets: 3,
    rest_seconds: 90, tempo: '3-1-1-0', notes: null, superset_group: null,
    block_role: 'gym', side_mode: 'per_leg', directions: 1,
    created_at: NOW, updated_at: NOW, ...patch,
  }
}

function block(patch: Partial<SessionBlockRow> = {}): SessionBlockRow {
  return {
    id: 'sb-1', session_id: 's-1', template_block_id: 'tb-1', position: 0,
    role: 'strength', format: 'straight', rounds_initial: 1, rounds_max: 1,
    rest_after_round_s: null, notes: null, interval_prepare_s: null,
    interval_work_s: null, interval_recovery_s: null, interval_rounds: null,
    target_rpe_min: null, target_rpe_max: null, created_at: NOW, updated_at: NOW,
    ...patch,
  }
}

describe('V2 session prescription', () => {
  it('creates a flat session-block snapshot without leaking template-only columns', () => {
    const templateBlock = {
      ...block(),
      template_id: 't-1',
    }
    const snapshot = snapshotBlock(templateBlock, 's-2', 'sb-2', NOW, false)
    expect(snapshot).not.toHaveProperty('template_id')
    expect(snapshot).toMatchObject({ id: 'sb-2', session_id: 's-2', template_block_id: 'sb-1' })
  })

  it('materializes one shared planned row per unilateral set', () => {
    let id = 0
    const rows = materializePlannedSets({ exercise: exercise(), block: block(), newId: () => `set-${++id}`, now: NOW })
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => [row.round_index, row.side])).toEqual([
      [1, null], [2, null], [3, null],
    ])
    expect(rows.every((row) => row.weight_kg === null && row.reps === null && row.completed_at === null)).toBe(true)
  })

  it('materializes one shared arm result per pronation/supination direction', () => {
    let id = 0
    const rows = materializePlannedSets({
      exercise: exercise({ planned_sets: 2, side_mode: 'per_side', directions: 2 }),
      block: block(), newId: () => `set-${++id}`, now: NOW,
    })
    expect(rows).toHaveLength(4)
    expect(new Set(rows.map((row) => row.direction))).toEqual(new Set(['pronation', 'supination']))
    expect(rows.every((row) => row.side === null)).toBe(true)
  })

  it('uses block rounds for circuits and starts rest only after a complete set-group', () => {
    let id = 0
    const rows = materializePlannedSets({
      exercise: exercise({ planned_sets: 1 }),
      block: block({ format: 'circuit', rounds_initial: 3, rounds_max: 4 }),
      newId: () => `set-${++id}`, now: NOW,
    })
    expect(rows).toHaveLength(3)
    const roundDone = { ...rows[0]!, completed_at: NOW }
    expect(isSetGroupComplete(rows, roundDone)).toBe(true)
  })

  it('waits for every exercise in a superset round before the round rest', () => {
    const first = { ...exercise(), id: 'se-1', sets: [] } as SessionExerciseRow & { sets: SetRow[] }
    const second = { ...exercise(), id: 'se-2', sets: [] } as SessionExerciseRow & { sets: SetRow[] }
    const make = (id: string, sessionExerciseId: string, completed: boolean): SetRow => ({
      id,
      session_exercise_id: sessionExerciseId,
      position: 1,
      round_index: 1,
      side: null,
      direction: null,
      weight_kg: null,
      reps: 8,
      duration_s: null,
      distance_m: null,
      rpe: 7,
      notes: null,
      is_warmup: false,
      completed_at: completed ? NOW : null,
      created_at: NOW,
      updated_at: NOW,
    })
    first.sets = [make('set-1', first.id, true)]
    second.sets = [make('set-2', second.id, false)]
    expect(isBlockRoundComplete([first, second], first.sets[0]!)).toBe(false)
    expect(isBlockRoundComplete([first, second], { ...second.sets[0]!, completed_at: NOW })).toBe(true)
  })

  it('proposes load only when every completed work set reaches max reps at RPE 8 or lower', () => {
    const makeSet = (id: string, reps: number, rpe: number): SetRow => ({
      id, session_exercise_id: 'se-1', position: Number(id.at(-1)), weight_kg: 20,
      reps, duration_s: null, distance_m: null, rpe, notes: null, is_warmup: false,
      completed_at: NOW, created_at: NOW, updated_at: NOW,
    })
    const session = {
      id: 's-1', owner_id: 'u-1', template_id: 't-1', schedule_item_id: null,
      name: 'A', status: 'in_progress', planned_date: null, started_at: NOW,
      ended_at: null, notes: null, rpe: null, created_at: NOW, updated_at: NOW,
      session_blocks: [],
      session_exercises: [{
        ...exercise({ template_item_id: 'ti-1', target_reps_max: 8, load_increment_kg: 2 }),
      sets: [makeSet('set-1', 8, 8), makeSet('set-2', 8, 7), makeSet('set-3', 8, 8)],
      }],
    } satisfies SessionDoc
    expect(progressionSuggestions(session)[0]).toMatchObject({ fromWeightKg: 20, toWeightKg: 22 })
    session.session_exercises[0]!.sets[1]!.rpe = 9
    expect(progressionSuggestions(session)).toEqual([])
    session.session_exercises[0]!.sets[1]!.rpe = 8
    session.session_exercises[0]!.sets[2]!.completed_at = null
    expect(progressionSuggestions(session)).toEqual([])
  })

  it('derives the repeating fourth-week deload and a separate aerobic total', () => {
    expect(cycleWeek('2026-08-03', '2026-08-03')).toBe(1)
    expect(cycleWeek('2026-08-03', '2026-08-24')).toBe(4)
    expect(cycleWeek('2026-08-03', '2026-08-31')).toBe(1)
    expect(aerobicSecondsInWeek({
      sessions: [],
      external: [{
        id: 'a-1', owner_id: 'u-1', recorded_on: '2026-08-20', activity_type: 'walking',
        duration_s: 1800, moderate: true, notes: null, created_at: NOW, updated_at: NOW,
      }],
      from: '2026-08-17', to: '2026-08-23',
    })).toBe(1800)
  })
})
