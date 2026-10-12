// Read-only notes for an unusually long session. Nothing here rewrites history.

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
  updated_at: string
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

/** Explain a long clock span without clipping it or ignoring later conditioning. */
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
  const start = new Date(session.started_at).getTime()
  const end = session.ended_at ? new Date(session.ended_at).getTime() : nowMs
  const elapsedSeconds = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 1000))
    : 0
  const unusuallyLong = elapsedSeconds > LONG_SESSION_SECONDS
  if (!unusuallyLong) return { elapsedSeconds, unusuallyLong: false, flags: [] }

  const flags: DurationFlag[] = []
  if (session.status === 'in_progress' || !session.ended_at) flags.push('open_session')

  const completedTimes = session.session_exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed_at)
    .map((set) => new Date(set.completed_at ?? set.updated_at).getTime())
    .filter((time) => Number.isFinite(time))
  if (session.ended_at && completedTimes.length > 0) {
    const last = Math.max(...completedTimes)
    const ended = new Date(session.ended_at).getTime()
    if (ended - last > GAP_AFTER_LAST_SET_SECONDS * 1000) flags.push('gap_after_last_set')
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
