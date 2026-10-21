import { describe, expect, it } from 'vitest'
import type {
  SessionBlockRow,
  SessionDoc,
  SessionExerciseDoc,
  SessionExerciseRow,
  SetRow,
  TemplateItemRow,
} from '../types/db'
import {
  addedSessionExercise,
  aerobicSecondsInWeek,
  cycleWeek,
  isBlockRoundComplete,
  isSetGroupComplete,
  materializePlannedSets,
  progressionSuggestions,
  snapshotBlock,
  snapshotExercise,
  switchSessionExerciseBackup,
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

  it('snapshots the planned and alternative exercise for offline switching', () => {
    const item = {
      id: 'ti-1', template_id: 't-1', exercise_id: 'squat', backup_exercise_id: 'leg-press',
      position: 0, planned_sets: 3, target_weight_kg: 100, target_reps: 5,
      target_duration_s: null, target_distance_m: null, rest_seconds: 120,
      tempo: null, notes: null, superset_group: null, block_role: 'gym',
      created_at: NOW, updated_at: NOW,
    } satisfies TemplateItemRow
    const snapshot = snapshotExercise(item, {
      sessionId: 's-1', sessionExerciseId: 'se-1', sessionBlockId: null,
      name: 'Back Squat', measurement: 'weight_reps',
      backup: { id: 'leg-press', name: 'Leg Press', measurement: 'weight_reps' },
      now: NOW, deload: false,
    })
    expect(snapshot).toMatchObject({
      exercise_id: 'squat', primary_exercise_id: 'squat',
      primary_name_snapshot: 'Back Squat', primary_target_weight_kg: 100,
      backup_exercise_id: 'leg-press', backup_name_snapshot: 'Leg Press',
      uses_backup: false,
    })
  })

  it('switches to the alternative, clears draft values and restores the primary target', () => {
    const draftSet: SetRow = {
      id: 'set-1', session_exercise_id: 'se-1', position: 1, weight_kg: 100,
      reps: 5, duration_s: null, distance_m: null, rpe: 7, notes: 'draft',
      is_warmup: false, completed_at: null, created_at: NOW, updated_at: NOW,
    }
    const row = {
      ...exercise({
        primary_exercise_id: 'squat', primary_name_snapshot: 'Back Squat',
        primary_measurement_snapshot: 'weight_reps', primary_target_weight_kg: 100,
        backup_exercise_id: 'leg-press', backup_name_snapshot: 'Leg Press',
        backup_measurement_snapshot: 'weight_reps', target_weight_kg: 100,
        uses_backup: false,
      }),
      sets: [draftSet],
    } satisfies SessionExerciseDoc
    const alternative = switchSessionExerciseBackup(row, true, '2026-08-20T12:01:00.000Z')
    expect(alternative.ok).toBe(true)
    if (!alternative.ok) return
    expect(alternative.exercise).toMatchObject({
      exercise_id: 'leg-press', name_snapshot: 'Leg Press', uses_backup: true,
      target_weight_kg: null,
    })
    expect(alternative.exercise.sets[0]).toMatchObject({
      weight_kg: null, reps: null, rpe: null, notes: null,
    })

    const primary = switchSessionExerciseBackup(alternative.exercise, false, NOW)
    expect(primary.ok).toBe(true)
    if (primary.ok) {
      expect(primary.exercise).toMatchObject({
        exercise_id: 'squat', name_snapshot: 'Back Squat', uses_backup: false,
        target_weight_kg: 100,
      })
    }
  })

  it('refuses to switch after a completed set', () => {
    const row = {
      ...exercise({
        primary_exercise_id: 'squat', primary_name_snapshot: 'Back Squat',
        primary_measurement_snapshot: 'weight_reps', backup_exercise_id: 'leg-press',
        backup_name_snapshot: 'Leg Press', backup_measurement_snapshot: 'weight_reps',
      }),
      sets: [{
        id: 'set-1', session_exercise_id: 'se-1', position: 1, weight_kg: 100,
        reps: 5, duration_s: null, distance_m: null, rpe: 7, notes: null,
        is_warmup: false, completed_at: NOW, created_at: NOW, updated_at: NOW,
      }],
    } satisfies SessionExerciseDoc
    expect(switchSessionExerciseBackup(row, true, NOW)).toEqual({
      ok: false,
      reason: 'completed_set',
    })
  })

  it('gives an exercise added mid-workout its planned set rows', () => {
    let id = 0
    const added = addedSessionExercise({
      sessionId: 's-1',
      sessionExerciseId: 'se-new',
      exercise: { id: 'e-9', name: 'Cable row', measurement: 'weight_reps' },
      position: 4,
      now: NOW,
      newId: () => `set-${++id}`,
    })
    expect(added).toMatchObject({
      id: 'se-new',
      exercise_id: 'e-9',
      name_snapshot: 'Cable row',
      measurement_snapshot: 'weight_reps',
      position: 4,
      planned_sets: 3,
    })
    expect(added.sets).toHaveLength(3)
    expect(added.sets.map((row) => row.session_exercise_id)).toEqual(['se-new', 'se-new', 'se-new'])
    expect(added.sets.every((row) => row.completed_at === null && row.weight_kg === null && row.reps === null)).toBe(true)
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

  it('marks planned sets as warm-up when the exercise slot is a warm-up', () => {
    let id = 0
    const rows = materializePlannedSets({
      exercise: exercise({ is_warmup: true, planned_sets: 2 }),
      block: block(),
      newId: () => `set-${++id}`,
      now: NOW,
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.is_warmup)).toBe(true)
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
    const sessionExercise = session.session_exercises[0]
    expect(sessionExercise).toBeDefined()
    if (!sessionExercise) return
    sessionExercise.uses_backup = true
    expect(progressionSuggestions(session)).toEqual([])
    sessionExercise.uses_backup = false
    const secondSet = sessionExercise.sets[1]
    const thirdSet = sessionExercise.sets[2]
    expect(secondSet).toBeDefined()
    expect(thirdSet).toBeDefined()
    if (!secondSet || !thirdSet) return
    secondSet.rpe = 9
    expect(progressionSuggestions(session)).toEqual([])
    secondSet.rpe = 8
    thirdSet.completed_at = null
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
