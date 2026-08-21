import { describe, expect, it } from 'vitest'
import type { TemplateRow, TrainingPlanRow } from '../../types/db'
import { HYBRID_TEMPLATES } from './hybrid4day'
import {
  applyHybridPlanMembership,
  compactPlanPositions,
  hybridPlanFrom,
  nextPlanPosition,
  nextTemplateForPlan,
  orphanHybridTemplates,
  sortPlanTemplates,
  unassignedTemplates,
} from './plans'

const NOW = '2026-08-19T12:00:00.000Z'

function template(
  id: string,
  patch: Partial<TemplateRow> & Pick<TemplateRow, 'name'>,
): TemplateRow {
  return {
    id,
    owner_id: 'u1',
    notes: null,
    plan_id: null,
    plan_position: 0,
    created_at: NOW,
    updated_at: NOW,
    ...patch,
  }
}

describe('plan membership', () => {
  it('sorts members by plan_position then id', () => {
    const rows = [
      template('b', { name: 'B', plan_id: 'p1', plan_position: 1 }),
      template('a', { name: 'A', plan_id: 'p1', plan_position: 0 }),
      template('c', { name: 'C', plan_id: 'p2', plan_position: 0 }),
    ]
    expect(sortPlanTemplates(rows, 'p1').map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('appends at max position + 1', () => {
    const rows = [
      template('a', { name: 'A', plan_id: 'p1', plan_position: 0 }),
      template('b', { name: 'B', plan_id: 'p1', plan_position: 4 }),
    ]
    expect(nextPlanPosition(rows, 'p1')).toBe(5)
    expect(nextPlanPosition(rows, 'missing')).toBe(0)
  })

  it('compacts gapped positions', () => {
    const rows = [
      template('a', { name: 'A', plan_id: 'p1', plan_position: 0 }),
      template('b', { name: 'B', plan_id: 'p1', plan_position: 4 }),
    ]
    expect(compactPlanPositions(rows, 'p1').map((row) => row.plan_position)).toEqual([0, 1])
  })

  it('lists unassigned routines', () => {
    const rows = [
      template('a', { name: 'A', plan_id: 'p1', plan_position: 0 }),
      template('b', { name: 'B' }),
    ]
    expect(unassignedTemplates(rows).map((row) => row.id)).toEqual(['b'])
  })
})

describe('hybrid plan migration', () => {
  const plan: TrainingPlanRow = {
    id: 'plan-hybrid',
    owner_id: 'u1',
    name: 'Hybrid 4-day',
    notes: null,
    created_at: NOW,
    updated_at: NOW,
  }

  const installed = HYBRID_TEMPLATES.map((day, index) =>
    template(`t-${index}`, { name: day.name, notes: day.notes }),
  )

  it('finds the Hybrid plan by name', () => {
    expect(hybridPlanFrom([plan])?.id).toBe('plan-hybrid')
    expect(hybridPlanFrom([{ ...plan, name: 'PPL' }])).toBeNull()
  })

  it('treats tagged A–D templates without a shared plan as orphans', () => {
    expect(orphanHybridTemplates(installed)?.map((row) => row.id)).toEqual(['t-0', 't-1', 't-2', 't-3'])
    expect(
      orphanHybridTemplates(installed.map((row, index) => ({ ...row, plan_id: 'p1', plan_position: index }))),
    ).toBeNull()
    expect(orphanHybridTemplates(installed.slice(0, 3))).toBeNull()
  })

  it('attaches orphans to the Hybrid plan in A–D order', () => {
    const patched = applyHybridPlanMembership({ plan, templates: installed, now: NOW })
    expect(patched.map((row) => [row.id, row.plan_id, row.plan_position])).toEqual([
      ['t-0', 'plan-hybrid', 0],
      ['t-1', 'plan-hybrid', 1],
      ['t-2', 'plan-hybrid', 2],
      ['t-3', 'plan-hybrid', 3],
    ])
    expect(
      applyHybridPlanMembership({
        plan,
        templates: patched,
        now: NOW,
      }),
    ).toEqual([])
  })
})

describe('dynamic plan sequence', () => {
  const days = ['A', 'B', 'C', 'D'].map((name, index) =>
    template(`t-${name}`, { name, plan_id: 'p1', plan_position: index }),
  )
  const session = (id: string, status: 'completed' | 'skipped', planId: string | null) => ({
    id, owner_id: 'u1', template_id: null, schedule_item_id: null, name: id,
    status, planned_date: null, started_at: NOW, ended_at: NOW, notes: null, rpe: null,
    plan_id: planId, created_at: NOW, updated_at: NOW, session_exercises: [], session_blocks: [],
  })

  it('advances only for completed plan occurrences', () => {
    expect(nextTemplateForPlan('p1', days, [])?.name).toBe('A')
    expect(nextTemplateForPlan('p1', days, [session('skip', 'skipped', 'p1')])?.name).toBe('A')
    expect(nextTemplateForPlan('p1', days, [session('manual', 'completed', null)])?.name).toBe('A')
    expect(nextTemplateForPlan('p1', days, [session('done', 'completed', 'p1')])?.name).toBe('B')
  })
})
