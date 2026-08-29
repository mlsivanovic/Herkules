import { describe, expect, it } from 'vitest'
import { cloneRoutine } from './cloneRoutine'
import type { TemplateBlockRow, TemplateItemRow, TemplateRow } from '../types/db'

let n = 0
function id(): string {
  n += 1
  return `new-${n}`
}

const NOW = '2026-08-29T12:00:00.000Z'

function template(): TemplateRow {
  return {
    id: 'tpl-1',
    owner_id: 'trainer',
    name: 'Push A',
    notes: 'cues',
    plan_id: 'starter-plan',
    plan_position: 2,
    source_slot: 'A',
    assigned_by: 'someone',
    source_template_id: 'origin',
    locked: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function block(): TemplateBlockRow {
  return {
    id: 'block-1',
    template_id: 'tpl-1',
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
  }
}

function item(overrides: Partial<TemplateItemRow> = {}): TemplateItemRow {
  return {
    id: 'item-1',
    template_id: 'tpl-1',
    exercise_id: 'ex-1',
    position: 0,
    planned_sets: 3,
    target_weight_kg: 60,
    target_reps: 8,
    target_duration_s: null,
    target_distance_m: null,
    rest_seconds: 90,
    tempo: '3-0-1',
    notes: null,
    superset_group: 'g1',
    block_role: 'gym',
    block_id: 'block-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('cloneRoutine', () => {
  it('copies into an unlocked pool routine with remapped ids', () => {
    n = 0
    const copy = cloneRoutine({
      template: template(),
      items: [item(), item({ id: 'item-2', position: 1, exercise_id: 'ex-2' })],
      blocks: [block()],
      ownerId: 'trainer',
      now: NOW,
      newId: id,
      name: 'Push A (copy)',
    })

    expect(copy.template.id).not.toBe('tpl-1')
    expect(copy.template.name).toBe('Push A (copy)')
    expect(copy.template.plan_id).toBeNull()
    expect(copy.template.plan_position).toBe(0)
    expect(copy.template.source_slot).toBeNull()
    expect(copy.template.locked).toBe(false)
    expect(copy.template.source_template_id).toBeNull()
    expect(copy.template.assigned_by).toBeNull()
    expect(copy.template.notes).toBe('cues')

    expect(copy.blocks).toHaveLength(1)
    expect(copy.blocks[0]?.id).not.toBe('block-1')
    expect(copy.blocks[0]?.template_id).toBe(copy.template.id)

    expect(copy.items).toHaveLength(2)
    expect(copy.items.map((row) => row.id).every((value) => value !== 'item-1')).toBe(true)
    expect(copy.items[0]?.template_id).toBe(copy.template.id)
    expect(copy.items[0]?.block_id).toBe(copy.blocks[0]?.id)
    expect(copy.items[0]?.superset_group).not.toBe('g1')
    expect(copy.items[1]?.superset_group).toBe(copy.items[0]?.superset_group)
    expect(copy.items[0]?.tempo).toBe('3-0-1')
  })
})
