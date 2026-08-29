import { describe, expect, it } from 'vitest'
import { copyPlanToClient } from './coachAssign'
import { applyPlanPushUpdate } from './planPushUpdate'
import type { ExerciseRow, TemplateItemRow, TemplateRow, TrainingPlanRow } from '../types/db'

let n = 0
function id(): string {
  n += 1
  return `n-${n}`
}

const stamp = '2026-01-01T00:00:00.000Z'

function plan(overrides: Partial<TrainingPlanRow> = {}): TrainingPlanRow {
  return {
    id: 'master-plan',
    owner_id: 'trainer',
    name: 'Strength',
    notes: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  }
}

function template(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 'master-a',
    owner_id: 'trainer',
    name: 'A',
    notes: null,
    plan_id: 'master-plan',
    plan_position: 0,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  }
}

function item(overrides: Partial<TemplateItemRow> = {}): TemplateItemRow {
  return {
    id: 'master-item',
    template_id: 'master-a',
    exercise_id: 'sys',
    position: 0,
    planned_sets: 3,
    target_weight_kg: 60,
    target_reps: 5,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 90,
    tempo: null,
    notes: null,
    superset_group: null,
    block_role: 'gym',
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  }
}

function systemExercise(): ExerciseRow {
  return {
    id: 'sys',
    owner_id: null,
    name: 'Squat',
    category: 'strength',
    measurement: 'weight_reps',
    muscle_groups: [],
    equipment: [],
    instructions: null,
    video_url: null,
    is_archived: false,
    created_at: stamp,
    updated_at: stamp,
  }
}

describe('applyPlanPushUpdate', () => {
  it('updates targets on the existing copy without changing its id', () => {
    n = 0
    const master = {
      plan: plan(),
      templates: [template()],
      blocks: [],
      items: [item()],
      exercises: [systemExercise()],
    }
    const first = copyPlanToClient({
      source: master,
      trainerId: 'trainer',
      clientId: 'client',
      now: stamp,
      newId: id,
    })
    const bumped = {
      ...master,
      items: [item({ target_weight_kg: 70, target_reps: 6 })],
    }
    const result = applyPlanPushUpdate({
      master: bumped,
      copy: first,
      trainerId: 'trainer',
      clientId: 'client',
      now: '2026-08-29T00:00:00.000Z',
      newId: id,
    })
    expect(result.kind).toBe('updated')
    if (result.kind !== 'updated') return
    expect(result.updated).toBe(1)
    expect(result.copy.plan.id).toBe(first.plan.id)
    expect(result.copy.templates[0]?.id).toBe(first.templates[0]?.id)
    expect(result.copy.items[0]?.target_weight_kg).toBe(70)
    expect(result.copy.items[0]?.target_reps).toBe(6)
  })

  it('adds a new master template onto the copy', () => {
    n = 0
    const master = {
      plan: plan(),
      templates: [template()],
      blocks: [],
      items: [item()],
      exercises: [systemExercise()],
    }
    const first = copyPlanToClient({
      source: master,
      trainerId: 'trainer',
      clientId: 'client',
      now: stamp,
      newId: id,
    })
    const withB = {
      ...master,
      templates: [template(), template({ id: 'master-b', name: 'B', plan_position: 1 })],
      items: [item(), item({ id: 'item-b', template_id: 'master-b' })],
    }
    const result = applyPlanPushUpdate({
      master: withB,
      copy: first,
      trainerId: 'trainer',
      clientId: 'client',
      now: '2026-08-29T00:00:00.000Z',
      newId: id,
    })
    expect(result.kind).toBe('updated')
    if (result.kind !== 'updated') return
    expect(result.added).toBe(1)
    expect(result.copy.templates).toHaveLength(2)
    expect(result.copy.templates.some((row) => row.name === 'B')).toBe(true)
  })

  it('asks for replace when the copy is from a different plan', () => {
    n = 0
    const master = {
      plan: plan(),
      templates: [template()],
      blocks: [],
      items: [item()],
      exercises: [systemExercise()],
    }
    const first = copyPlanToClient({
      source: master,
      trainerId: 'trainer',
      clientId: 'client',
      now: stamp,
      newId: id,
    })
    first.plan.source_plan_id = 'other'
    const result = applyPlanPushUpdate({
      master,
      copy: first,
      trainerId: 'trainer',
      clientId: 'client',
      now: stamp,
      newId: id,
    })
    expect(result).toEqual({ kind: 'replace' })
  })
})
