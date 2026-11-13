import type { SessionHeartRateRow } from '../types/db'

export interface HeartRateSample {
  at: number
  bpm: number
}

export function summarizeHeartRate(samples: readonly HeartRateSample[]) {
  if (samples.length === 0) return null
  let sum = 0
  let peak = 0
  for (const { bpm } of samples) {
    sum += bpm
    peak = Math.max(peak, bpm)
  }
  return { average: Math.round(sum / samples.length), peak }
}

/** Server row for one session's samples (sorted by time, valid bpm only). */
export function heartRateRow(
  sessionId: string,
  ownerId: string,
  samples: readonly HeartRateSample[],
): SessionHeartRateRow {
  const valid = samples
    .filter(({ at, bpm }) => Number.isFinite(at) && Number.isFinite(bpm) && bpm > 0 && bpm <= 250)
    .sort((a, b) => a.at - b.at)
  return {
    id: sessionId,
    owner_id: ownerId,
    sample_at: valid.map(({ at }) => Math.round(at)),
    sample_bpm: valid.map(({ bpm }) => Math.round(bpm)),
  }
}

export function samplesFromRow(row: Pick<SessionHeartRateRow, 'sample_at' | 'sample_bpm'>): HeartRateSample[] {
  const count = Math.min(row.sample_at?.length ?? 0, row.sample_bpm?.length ?? 0)
  const samples: HeartRateSample[] = []
  for (let i = 0; i < count; i++) {
    samples.push({ at: Number(row.sample_at[i]), bpm: Number(row.sample_bpm[i]) })
  }
  return samples
}

export interface HeartRateSyncPlan {
  /** Server copy differs from the local one: download and replace locally. */
  download: string[]
  /** Local samples the server does not have yet: queue an upsert. */
  upload: string[]
  /** Samples of sessions that no longer exist locally. */
  dropLocal: string[]
}

/**
 * Decide how local heart rate and the server copy converge after a pull.
 * Sessions still recording or with a queued heart-rate upsert keep the local copy.
 */
export function planHeartRateSync(input: {
  local: ReadonlyMap<string, number>
  server: ReadonlyMap<string, number>
  pending: ReadonlySet<string>
  /** Status of every session in the local mirror. */
  sessions: ReadonlyMap<string, string>
  /** Sessions that exist on the server (safe heart-rate FK target). */
  serverSessions: ReadonlySet<string>
}): HeartRateSyncPlan {
  const plan: HeartRateSyncPlan = { download: [], upload: [], dropLocal: [] }
  const busy = (id: string) => input.pending.has(id) || input.sessions.get(id) === 'in_progress'
  for (const [id, count] of input.server) {
    if (!busy(id) && input.sessions.has(id) && input.local.get(id) !== count) plan.download.push(id)
  }
  for (const id of input.local.keys()) {
    if (!input.sessions.has(id)) plan.dropLocal.push(id)
    else if (!input.server.has(id) && !busy(id) && input.serverSessions.has(id)) plan.upload.push(id)
  }
  return plan
}
