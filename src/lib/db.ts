// IndexedDB mirror of the user's data + the sync outbox.
// Pure planning logic lives in outbox.ts; this file is browser-only I/O.
// Store values are kept as loose records internally; typed rows are restored
// at the read boundary (readOne/readAll).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { collapseOps, uniqueOpCount } from './outbox'
import type {
  BodyWeightRow,
  ExerciseRow,
  OutboxOp,
  ProfileRow,
  RecurrenceRuleRow,
  ScheduleItemRow,
  SessionDoc,
  TemplateItemRow,
  TemplateRow,
} from '../types/db'

export type StoreName =
  | 'profiles'
  | 'exercises'
  | 'templates'
  | 'templateItems'
  | 'rules'
  | 'schedules'
  | 'sessions'
  | 'bodyWeights'

interface DirtyRow {
  value: Record<string, unknown>
  dirty: boolean
}

interface HerkulesDB extends DBSchema {
  meta: { key: string; value: unknown }
  profiles: { key: string; value: DirtyRow }
  exercises: { key: string; value: DirtyRow }
  templates: { key: string; value: DirtyRow }
  templateItems: { key: string; value: DirtyRow }
  rules: { key: string; value: DirtyRow }
  schedules: { key: string; value: DirtyRow }
  sessions: { key: string; value: DirtyRow }
  bodyWeights: { key: string; value: DirtyRow }
  outbox: { key: number; value: OutboxOp & { seq: number }; autoIncrement: true }
}

const DB_NAME = 'herkules'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<HerkulesDB>> | null = null

export function getDb(): Promise<IDBPDatabase<HerkulesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HerkulesDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('meta')
          for (const name of [
            'profiles',
            'exercises',
            'templates',
            'templateItems',
            'rules',
            'schedules',
            'sessions',
          ] as const) {
            db.createObjectStore(name, { keyPath: 'value.id' })
          }
          db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('bodyWeights')) {
          db.createObjectStore('bodyWeights', { keyPath: 'value.id' })
        }
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------- meta

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key)
}

// ---------------------------------------------------------------- mirror reads

/** Read a single mirrored row fresh from IndexedDB (avoids stale closures). */
export async function readOne<T>(store: StoreName, id: string): Promise<T | null> {
  const entry = await (await getDb()).get(store, id)
  return entry ? (entry.value as unknown as T) : null
}

export async function readAll(): Promise<{
  exercises: ExerciseRow[]
  templates: TemplateRow[]
  templateItems: TemplateItemRow[]
  rules: RecurrenceRuleRow[]
  schedules: ScheduleItemRow[]
  sessions: SessionDoc[]
  bodyWeights: BodyWeightRow[]
}> {
  const db = await getDb()
  const [exercises, templates, templateItems, rules, schedules, sessions, bodyWeights] =
    await Promise.all([
      db.getAll('exercises'),
      db.getAll('templates'),
      db.getAll('templateItems'),
      db.getAll('rules'),
      db.getAll('schedules'),
      db.getAll('sessions'),
      db.getAll('bodyWeights'),
    ])
  const pick = <T>(rows: DirtyRow[]): T[] => rows.map((r) => r.value as unknown as T)
  return {
    exercises: pick(exercises),
    templates: pick(templates),
    templateItems: pick(templateItems),
    rules: pick(rules),
    schedules: pick(schedules),
    sessions: pick(sessions),
    bodyWeights: pick(bodyWeights),
  }
}

export async function readProfile(): Promise<ProfileRow | null> {
  const db = await getDb()
  const all = await db.getAll('profiles')
  return all.length > 0 ? (all[0].value as unknown as ProfileRow) : null
}

// ---------------------------------------------------------------- mirror writes

export async function putDirty(store: StoreName, row: object): Promise<void> {
  const db = await getDb()
  await db.put(store, { value: row as Record<string, unknown>, dirty: true })
}

export async function reconcileProfile(serverRow: ProfileRow | null): Promise<void> {
  const db = await getDb()
  const local = await db.getAll('profiles')
  if (local.length > 0 && local[0].dirty) return
  const tx = db.transaction('profiles', 'readwrite')
  await tx.store.clear()
  if (serverRow) {
    await tx.store.put({
      value: serverRow as unknown as Record<string, unknown>,
      dirty: false,
    })
  }
  await tx.done
}

export async function clearProfileDirty(): Promise<void> {
  const db = await getDb()
  const all = await db.getAll('profiles')
  if (all.length > 0 && all[0].dirty) {
    await db.put('profiles', { value: all[0].value, dirty: false })
  }
}

/** Replace local mirror content with the server snapshot, keeping rows that
 * still have queued (dirty) changes, and deleting rows the server no longer has. */
export async function reconcileStore(
  store: StoreName,
  serverRows: { id: string }[],
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(store, 'readwrite')
  const local = await tx.store.getAll()
  for (const entry of local) {
    const id = String(entry.value.id)
    if (entry.dirty) continue
    const serverRow = serverRows.find((r) => r.id === id)
    if (serverRow) {
      await tx.store.put({
        value: serverRow as unknown as Record<string, unknown>,
        dirty: false,
      })
    } else {
      await tx.store.delete(id)
    }
  }
  for (const row of serverRows) {
    if (!local.some((e) => String(e.value.id) === row.id)) {
      await tx.store.put({ value: row as unknown as Record<string, unknown>, dirty: false })
    }
  }
  await tx.done
}

export async function clearDirtyFlags(): Promise<void> {
  const db = await getDb()
  const stores: StoreName[] = [
    'profiles',
    'exercises',
    'templates',
    'templateItems',
    'rules',
    'schedules',
    'sessions',
    'bodyWeights',
  ]
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) {
    const rows = await tx.objectStore(store).getAll()
    for (const row of rows) {
      if (row.dirty) await tx.objectStore(store).put({ ...row, dirty: false })
    }
  }
  await tx.done
}

// ---------------------------------------------------------------- outbox

export async function appendOps(ops: OutboxOp[]): Promise<void> {
  if (ops.length === 0) return
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  await Promise.all(
    ops.map((op) => tx.store.add(op as OutboxOp & { seq: number })),
  )
  await tx.done
}

export async function listOps(): Promise<(OutboxOp & { seq: number })[]> {
  return (await getDb()).getAll('outbox')
}

export async function removeOps(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  await Promise.all(seqs.map((seq) => tx.store.delete(seq)))
  await tx.done
}

/** Drop queued ops matching a predicate (e.g. stale upserts of discarded rows). */
export async function removeMatchingOps(
  predicate: (op: OutboxOp) => boolean,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  const all = await tx.store.getAll()
  await Promise.all(all.filter((op) => predicate(op)).map((op) => tx.store.delete(op.seq)))
  await tx.done
}

export async function pendingCount(): Promise<number> {
  return uniqueOpCount(await listOps())
}

export async function pendingBreakdown(): Promise<{ table: string; count: number }[]> {
  const collapsed = collapseOps(await listOps())
  const counts = new Map<string, number>()
  for (const op of collapsed) {
    counts.set(op.table, (counts.get(op.table) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => a.table.localeCompare(b.table))
}

// ---------------------------------------------------------------- lifecycle

export async function removeFrom(store: StoreName, id: string): Promise<void> {
  await (await getDb()).delete(store, id)
}

export async function wipeLocalData(): Promise<void> {
  const db = await getDb()
  const stores = [
    'meta',
    'profiles',
    'exercises',
    'templates',
    'templateItems',
    'rules',
    'schedules',
    'sessions',
    'bodyWeights',
    'outbox',
  ] as const
  const tx = db.transaction(stores, 'readwrite')
  for (const store of stores) {
    await tx.objectStore(store).clear()
  }
  await tx.done
}
