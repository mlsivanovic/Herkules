// Logged workout length runs from Start workout to the last completed set.
// Finish only closes the session. A late tap must not stretch the clock, including
// for sessions that were already saved. No set timestamps are rewritten.

export const LONG_SESSION_SECONDS = 4 * 60 * 60
const GAP_AFTER_LAST_SET_SECONDS = 30 * 60

export type DurationFlag = 'open_session' | 'gap_after_last_set' | 'later_conditioning'

export interface DurationDiagnosis {
  elapsedSeconds: number
  unusuallyLong: boolean
  flags: DurationFlag[]
}

interface DurationSet {
  completed_at: string | null
  is_warmup?: boolean
}

interface DurationExercise {
  session_block_id?: string | null
  sets: DurationSet[]
}

interface DurationBlock {
  id: string
  role: string
}

interface DurationSession {
  started_at: string
  ended_at: string | null
  session_exercises?: DurationExercise[]
}

/** Latest moment a set was logged. Incomplete planned sets do not count. */
export function lastLoggedSetMs(session: DurationSession): number | null {
  let last = Number.NEGATIVE_INFINITY
  for (const exercise of session.session_exercises ?? []) {
    for (const set of exercise.sets) {
      if (!set.completed_at) continue
      const time = new Date(set.completed_at).getTime()
      if (Number.isFinite(time) && time > last) last = time
    }
  }
  return Number.isFinite(last) ? last : null
}

/**
 * Seconds from start to the last logged set.
 * With no completed sets, falls back to `ended_at`, then to `nowMs` when given.
 */
export function sessionDurationSeconds(session: DurationSession, nowMs?: number): number | null {
  const start = new Date(session.started_at).getTime()
  if (!Number.isFinite(start)) return null
  const lastSet = lastLoggedSetMs(session)
  const ended = session.ended_at ? new Date(session.ended_at).getTime() : Number.NaN
  const end = lastSet ?? (Number.isFinite(ended) ? ended : nowMs)
  if (end == null || !Number.isFinite(end)) return null
  return Math.max(0, Math.round((end - start) / 1000))
}

/** Explain a long logged span. Later conditioning still counts, because it is a logged set. */
export function diagnoseSessionDuration(
  session: {
    status: string
    started_at: string
    ended_at: string | null
    session_blocks?: DurationBlock[]
    session_exercises: DurationExercise[]
  },
  nowMs = Date.now(),
): DurationDiagnosis {
  const elapsedSeconds = sessionDurationSeconds(session, nowMs) ?? 0
  const unusuallyLong = elapsedSeconds > LONG_SESSION_SECONDS
  if (!unusuallyLong) return { elapsedSeconds, unusuallyLong: false, flags: [] }

  const flags: DurationFlag[] = []
  if (session.status === 'in_progress' || !session.ended_at) flags.push('open_session')

  const lastSet = lastLoggedSetMs(session)
  if (session.ended_at && lastSet != null) {
    const ended = new Date(session.ended_at).getTime()
    if (Number.isFinite(ended) && ended - lastSet > GAP_AFTER_LAST_SET_SECONDS * 1000) {
      flags.push('gap_after_last_set')
    }
  }

  const conditioningIds = new Set(
    (session.session_blocks ?? [])
      .filter((block) => block.role === 'zone_2' || block.role === 'conditioning')
      .map((block) => block.id),
  )
  let lastStrength = 0
  let lastConditioning = 0
  for (const exercise of session.session_exercises) {
    const conditioning = exercise.session_block_id != null && conditioningIds.has(exercise.session_block_id)
    for (const set of exercise.sets) {
      if (!set.completed_at || set.is_warmup) continue
      const time = new Date(set.completed_at).getTime()
      if (!Number.isFinite(time)) continue
      if (conditioning) lastConditioning = Math.max(lastConditioning, time)
      else lastStrength = Math.max(lastStrength, time)
    }
  }
  if (lastConditioning > lastStrength && lastStrength > 0) flags.push('later_conditioning')

  return { elapsedSeconds, unusuallyLong, flags }
}
