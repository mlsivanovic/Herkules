import { describe, expect, it } from 'vitest'
import type { TemplateRow, TrainingPlanRow } from '../../types/db'
import { HYBRID_TEMPLATES } from './hybrid4day'
import {
  applyHybridPlanMembership,
  compactMemberships,
  compactPlanPositions,
  extraDuplicateSlotTemplates,
  hybridPlanFrom,
  isPoolTemplate,
  missingPlanMemberships,
  nextPlanPosition,
  nextTemplateForPlan,
  orphanHybridTemplates,
  poolTemplates,
  sortPlanTemplates,
  templatePlanIds,
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

  it('keeps the oldest template when a plan has two rows in the same slot', () => {
    const rows = [
      template('new-a', { name: 'Hybrid A', plan_id: 'p1', plan_position: 0, source_slot: 'A', created_at: '2026-08-22T00:00:00.000Z' }),
      template('old-a', { name: 'Hybrid A', plan_id: 'p1', plan_position: 0, source_slot: 'A', created_at: '2026-08-01T00:00:00.000Z' }),
      template('only-b', { name: 'Hybrid B', plan_id: 'p1', plan_position: 1, source_slot: 'B', created_at: '2026-08-01T00:00:00.000Z' }),
    ]
    expect(extraDuplicateSlotTemplates(rows).map((row) => row.id)).toEqual(['new-a'])
  })

  it('lists unassigned routines', () => {
    const rows = [
      template('a', { name: 'A', plan_id: 'p1', plan_position: 0 }),
      template('b', { name: 'B' }),
    ]
    expect(unassignedTemplates(rows).map((row) => row.id)).toEqual(['b'])
  })

  it('prefers memberships so a pool routine can sit on two plans', () => {
    const rows = [
      template('starter', { name: 'Hybrid A', plan_id: 'p1', plan_position: 0, source_slot: 'A' }),
      template('pool', { name: 'Push' }),
    ]
    const memberships = [
      { plan_id: 'p1', template_id: 'starter', position: 0 },
      { plan_id: 'p1', template_id: 'pool', position: 1 },
      { plan_id: 'p2', template_id: 'pool', position: 0 },
    ]
    expect(sortPlanTemplates(rows, 'p1', memberships).map((row) => row.id)).toEqual(['starter', 'pool'])
    expect(sortPlanTemplates(rows, 'p2', memberships).map((row) => row.id)).toEqual(['pool'])
    expect(unassignedTemplates(rows, memberships)).toEqual([])
    expect(nextPlanPosition(rows, 'p2', memberships)).toBe(1)
    expect(compactMemberships(memberships, 'p1').map((row) => row.position)).toEqual([0, 1])
    expect(templatePlanIds('pool', memberships)).toEqual(['p1', 'p2'])
  })

  it('treats trainer-created unlocked routines as pool, not starter days', () => {
    expect(isPoolTemplate(template('a', { name: 'Push' }))).toBe(true)
    expect(isPoolTemplate(template('b', { name: 'Hybrid A', source_slot: 'A' }))).toBe(false)
    expect(isPoolTemplate(template('c', { name: 'Assigned', locked: true }))).toBe(false)
    expect(poolTemplates([
      template('a', { name: 'Push' }),
      template('b', { name: 'Hybrid A', source_slot: 'A' }),
    ]).map((row) => row.id)).toEqual(['a'])
  })

  it('synthesizes missing memberships from exclusive plan_id rows', () => {
    const rows = [
      template('a', { name: 'A', plan_id: 'p1', plan_position: 2 }),
      template('b', { name: 'B' }),
    ]
    expect(missingPlanMemberships(rows, [])).toEqual([
      { plan_id: 'p1', template_id: 'a', position: 2 },
    ])
    expect(missingPlanMemberships(rows, [{ plan_id: 'p1', template_id: 'a', position: 2 }])).toEqual([])
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
