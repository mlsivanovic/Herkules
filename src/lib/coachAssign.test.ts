import { describe, expect, it } from 'vitest'
import { assignedFromTrainer, copyPlanToClient } from './coachAssign'
import type { ExerciseRow, TemplateBlockRow, TemplateItemRow, TemplateRow, TrainingPlanRow } from '../types/db'

let n = 0
function id(): string {
  n += 1
  return `id-${n}`
}

function plan(overrides: Partial<TrainingPlanRow> = {}): TrainingPlanRow {
  return {
    id: 'plan-1',
    owner_id: 'trainer',
    name: 'Strength',
    notes: 'notes',
    source_key: null,
    source_version: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function template(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 'tpl-a',
    owner_id: 'trainer',
    name: 'Day A',
    notes: null,
    plan_id: 'plan-1',
    plan_position: 0,
    source_slot: 'A',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function block(overrides: Partial<TemplateBlockRow> = {}): TemplateBlockRow {
  return {
    id: 'block-1',
    template_id: 'tpl-a',
    position: 0,
    role: 'strength',
    format: 'straight',
    rounds_initial: 1,
    rounds_max: 1,
    rest_after_round_s: null,
    notes: null,
    interval_prepare_s: null,
    interval_work_s: null,
    interval_recovery_s: null,
    interval_rounds: null,
    target_rpe_min: null,
    target_rpe_max: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function item(overrides: Partial<TemplateItemRow> = {}): TemplateItemRow {
  return {
    id: 'item-1',
    template_id: 'tpl-a',
    exercise_id: 'ex-custom',
    position: 0,
    planned_sets: 3,
    target_weight_kg: 60,
    target_reps: 8,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 90,
    tempo: null,
    notes: null,
    superset_group: null,
    block_role: 'gym',
    block_id: 'block-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function exercise(overrides: Partial<ExerciseRow> = {}): ExerciseRow {
  return {
    id: 'ex-custom',
    owner_id: 'trainer',
    name: 'Safety Bar Squat',
    category: 'strength',
    measurement: 'weight_reps',
    muscle_groups: ['quads'],
    equipment: ['barbell'],
    instructions: null,
    video_url: null,
    is_archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('copyPlanToClient', () => {
  it('copies the plan as locked and remaps custom exercises', () => {
    n = 0
    const copy = copyPlanToClient({
      source: {
        plan: plan(),
        templates: [template()],
        blocks: [block()],
        items: [item()],
        exercises: [
          exercise(),
          exercise({ id: 'sys', owner_id: null, name: 'Back Squat' }),
        ],
      },
      trainerId: 'trainer',
      clientId: 'client',
      now: '2026-08-29T00:00:00.000Z',
      newId: id,
    })

    expect(copy.plan.owner_id).toBe('client')
    expect(copy.plan.assigned_by).toBe('trainer')
    expect(copy.plan.source_plan_id).toBe('plan-1')
    expect(copy.plan.locked).toBe(true)
    expect(copy.plan.id).not.toBe('plan-1')

    expect(copy.exercises).toHaveLength(1)
    expect(copy.exercises[0]?.owner_id).toBe('client')
    expect(copy.exercises[0]?.source_exercise_id).toBe('ex-custom')
    expect(copy.exercises[0]?.locked).toBe(true)

    expect(copy.templates).toHaveLength(1)
    expect(copy.templates[0]?.source_template_id).toBe('tpl-a')
    expect(copy.templates[0]?.plan_id).toBe(copy.plan.id)

    expect(copy.items[0]?.exercise_id).toBe(copy.exercises[0]?.id)
    expect(copy.items[0]?.template_id).toBe(copy.templates[0]?.id)
    expect(copy.items[0]?.block_id).toBe(copy.blocks[0]?.id)
  })

  it('keeps system exercise ids on items', () => {
    n = 0
    const copy = copyPlanToClient({
      source: {
        plan: plan(),
        templates: [template()],
        blocks: [],
        items: [item({ exercise_id: 'sys', block_id: null })],
        exercises: [exercise({ id: 'sys', owner_id: null })],
      },
      trainerId: 'trainer',
      clientId: 'client',
      now: '2026-08-29T00:00:00.000Z',
      newId: id,
    })
    expect(copy.exercises).toHaveLength(0)
    expect(copy.items[0]?.exercise_id).toBe('sys')
  })
})

describe('assignedFromTrainer', () => {
  it('keeps only locked copies from that trainer', () => {
    const rows = [
      template({ assigned_by: 'trainer', locked: true }),
      template({ id: 'own', assigned_by: null, locked: false }),
      template({ id: 'other', assigned_by: 'other', locked: true }),
    ]
    expect(assignedFromTrainer(rows, 'trainer')).toEqual([rows[0]])
  })
})
