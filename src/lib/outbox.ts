// Pure outbox planning: collapsing ops into idempotent, FK-safe batches.
// No I/O here — fully unit-testable; the transport lives in sync.ts.
import type { OutboxOp, SyncTable } from '../types/db'

export type SequencedOp = OutboxOp & { seq: number }

/** Parents before children (matches FK dependencies). */
const UPSERT_ORDER: SyncTable[] = [
  'profiles',
  'exercises',
  'training_plans',
  'workout_templates',
  'template_blocks',
  'template_items',
  'recurrence_rules',
  'schedule_items',
  'workout_sessions',
  'session_blocks',
  'session_exercises',
  'workout_sets',
  'body_weight_entries',
  'tendon_checkins',
  'aerobic_activities',
]

/** Children before parents so deletes never violate FKs. */
const DELETE_ORDER: SyncTable[] = [...UPSERT_ORDER].reverse()

export function opRowId(op: OutboxOp): string {
  return op.kind === 'upsert' ? String(op.row.id) : op.id
}

/**
 * Keep only the newest operation per (table, row id) so a burst of edits to
 * the same row collapses into a single idempotent write. Last write wins
 * across kinds too: an upsert followed by a delete collapses to the delete,
 * a delete followed by a re-upsert collapses to the upsert.
 */
export function collapseOps(ops: SequencedOp[]): SequencedOp[] {
  const latest = new Map<string, SequencedOp>()
  for (const op of ops) {
    latest.set(`${op.table}:${opRowId(op)}`, op)
  }
  return [...latest.values()].sort((a, b) => a.seq - b.seq)
}

export interface UpsertBatch {
  kind: 'upsert'
  table: SyncTable
  rows: Record<string, unknown>[]
  seqs: number[]
}

export interface DeleteBatch {
  kind: 'delete'
  table: SyncTable
  ids: string[]
  seqs: number[]
}

export type FlushBatch = UpsertBatch | DeleteBatch

/** How many distinct (table, row) keys are waiting — used by the UI badge. */
export function uniqueOpCount(ops: SequencedOp[]): number {
  return collapseOps(ops).length
}

/**
 * All outbox seqs that belong to the same (table, row) as `op`, including
 * older edits that collapse would drop. Removing only the winning seq left
 * stale rows in IndexedDB and kept the "Pending sync" badge on forever
 * even after the latest write had already reached the server.
 */
export function seqsForOp(ops: SequencedOp[], op: SequencedOp): number[] {
  const key = `${op.table}:${opRowId(op)}`
  return ops.filter((candidate) => `${candidate.table}:${opRowId(candidate)}` === key).map((c) => c.seq)
}

/**
 * Plan the flush: collapse, then order upserts parents→children and deletes
 * children→parents. Executing the batches in order is idempotent (upserts
 * keyed by client-generated UUID ids) and FK-safe.
 */
export function planFlush(ops: SequencedOp[]): FlushBatch[] {
  const collapsed = collapseOps(ops)
  const upserts = new Map<SyncTable, UpsertBatch>()
  const deletes = new Map<SyncTable, DeleteBatch>()

  for (const op of collapsed) {
    const allSeqs = seqsForOp(ops, op)
    if (op.kind === 'upsert') {
      const batch =
        upserts.get(op.table) ??
        ({ kind: 'upsert', table: op.table, rows: [], seqs: [] } as UpsertBatch)
      batch.rows.push(op.row)
      batch.seqs.push(...allSeqs)
      upserts.set(op.table, batch)
    } else {
      const batch =
        deletes.get(op.table) ??
        ({ kind: 'delete', table: op.table, ids: [], seqs: [] } as DeleteBatch)
      batch.ids.push(op.id)
      batch.seqs.push(...allSeqs)
      deletes.set(op.table, batch)
    }
  }

  const batches: FlushBatch[] = []
  for (const table of UPSERT_ORDER) {
    const batch = upserts.get(table)
    if (batch && batch.rows.length > 0) batches.push(batch)
  }
  for (const table of DELETE_ORDER) {
    const batch = deletes.get(table)
    if (batch && batch.ids.length > 0) batches.push(batch)
  }
  return batches
}
