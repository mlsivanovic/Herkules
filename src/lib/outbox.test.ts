import { describe, expect, it } from 'vitest'
import type { OutboxOp } from '../types/db'
import { collapseOps, opRowId, planFlush, type SequencedOp } from './outbox'

let seq = 0
function op(operation: OutboxOp): SequencedOp {
  seq += 1
  return { seq, ...operation }
}

function upsertSet(id: string, weight: number): SequencedOp {
  return op({
    kind: 'upsert',
    table: 'workout_sets',
    row: { id, weight_kg: weight, reps: 8 },
  })
}

describe('op ids', () => {
  it('reads the row id for upserts and the id for deletes', () => {
    expect(opRowId({ kind: 'upsert', table: 'workout_sets', row: { id: 'a' } })).toBe('a')
    expect(opRowId({ kind: 'delete', table: 'workout_sets', id: 'b' })).toBe('b')
  })
})

describe('collapse', () => {
  it('keeps only the latest op per kind/table/row', () => {
    const collapsed = collapseOps([upsertSet('s1', 60), upsertSet('s1', 62.5), upsertSet('s1', 65)])
    expect(collapsed).toHaveLength(1)
    const first = collapsed[0]
    expect(first?.kind).toBe('upsert')
    if (first?.kind === 'upsert') expect(first.row.weight_kg).toBe(65)
  })

  it('an upsert followed by a delete collapses to the delete', () => {
    const collapsed = collapseOps([
      upsertSet('s1', 60),
      op({ kind: 'delete', table: 'workout_sets', id: 's1' }),
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.kind).toBe('delete')
  })

  it('a delete followed by a re-upsert keeps only the upsert', () => {
    const collapsed = collapseOps([
      op({ kind: 'delete', table: 'workout_sets', id: 's1' }),
      upsertSet('s1', 60),
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.kind).toBe('upsert')
  })
})

describe('flush plan', () => {
  it('orders upserts parents before children and deletes children before parents', () => {
    const plan = planFlush([
      upsertSet('set-1', 60),
      op({
        kind: 'upsert',
        table: 'workout_sessions',
        row: { id: 'ses-1', name: 'Push' },
      }),
      op({
        kind: 'upsert',
        table: 'session_exercises',
        row: { id: 'se-1', session_id: 'ses-1' },
      }),
      op({ kind: 'delete', table: 'workout_templates', id: 'tpl-1' }),
      op({ kind: 'delete', table: 'template_items', id: 'ti-1' }),
    ])

    const tableOrder = plan.map((b) => b.table)
    expect(tableOrder.indexOf('workout_sessions')).toBeLessThan(
      tableOrder.indexOf('session_exercises'),
    )
    expect(tableOrder.indexOf('session_exercises')).toBeLessThan(tableOrder.indexOf('workout_sets'))
    // deletes come after all upserts, children (template_items) before parents (templates)
    expect(tableOrder.indexOf('template_items')).toBeGreaterThan(
      tableOrder.indexOf('workout_sets'),
    )
    expect(tableOrder.indexOf('template_items')).toBeLessThan(tableOrder.indexOf('workout_templates'))
  })

  it('deduplicates rows edited many times into one batch entry', () => {
    const plan = planFlush([upsertSet('s1', 60), upsertSet('s1', 62.5), upsertSet('s2', 40)])
    const setBatch = plan.find((b) => b.table === 'workout_sets')
    expect(setBatch?.kind).toBe('upsert')
    if (setBatch?.kind === 'upsert') {
      expect(setBatch.rows).toHaveLength(2)
      expect(setBatch.rows.find((r) => r.id === 's1')?.weight_kg).toBe(62.5)
    }
  })

  it('produces an empty plan from no ops', () => {
    expect(planFlush([])).toEqual([])
  })
})
