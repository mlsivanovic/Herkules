// Relative strength from logged working sets on a handful of big lifts.
// Bands follow common NSCA / ExRx-style bodyweight-ratio tables (approximate).
// Strength is a separate signal from body-fat math — it is never mixed into BF%.
import type { SessionDoc } from '../types/db'
import { bestE1RM, countsForStats } from './metrics'
import { SYS } from './programs/exercises'

export type LiftId = 'squat' | 'bench' | 'deadlift' | 'press' | 'pullUp'
export type StrengthLevel = 'untrained' | 'novice' | 'intermediate' | 'advanced' | 'elite'

export interface LiftStrength {
  lift: LiftId
  e1rmKg: number | null
  /** Best completed reps (pull-up bodyweight sets). */
  reps: number | null
  /** e1RM / body weight, or null when only reps are used. */
  ratio: number | null
  level: StrengthLevel | null
}

export interface StrengthSummary {
  lifts: LiftStrength[]
  overall: StrengthLevel | null
}

interface LiftSpec {
  ids: string[]
  names: string[]
}

const LIFTS: Record<LiftId, LiftSpec> = {
  squat: {
    ids: [SYS.barbellBackSquat],
    names: ['barbell back squat', 'back squat'],
  },
  bench: {
    ids: [SYS.barbellBenchPress],
    names: ['barbell bench press', 'bench press'],
  },
  deadlift: {
    ids: [SYS.deadlift, SYS.trapBarDeadlift],
    names: ['deadlift', 'trap bar deadlift', 'conventional deadlift'],
  },
  press: {
    ids: [SYS.overheadPress],
    names: ['overhead press', 'military press', 'strict press'],
  },
  pullUp: {
    ids: [SYS.pullUp, SYS.chinUp],
    names: ['pull-up', 'pull up', 'chin-up', 'chin up', 'weighted pull-up'],
  },
}

const LEVELS: StrengthLevel[] = ['untrained', 'novice', 'intermediate', 'advanced', 'elite']

/**
 * Relative 1RM / body-weight cutoffs: untrained / novice / intermediate / advanced / elite.
 * Values are the *minimum* ratio to enter that band (elite is the last threshold).
 */
const RATIO_TABLE: Record<SexFormulaLike, Record<Exclude<LiftId, 'pullUp'>, number[]>> = {
  male: {
    squat: [0.75, 1.25, 1.5, 2.0, 2.5],
    bench: [0.5, 0.8, 1.2, 1.6, 2.0],
    deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
    press: [0.35, 0.55, 0.75, 1.0, 1.25],
  },
  female: {
    squat: [0.5, 0.9, 1.25, 1.6, 2.0],
    bench: [0.3, 0.5, 0.75, 1.0, 1.3],
    deadlift: [0.75, 1.15, 1.5, 2.0, 2.5],
    press: [0.2, 0.35, 0.5, 0.7, 0.9],
  },
}

/** Bodyweight pull-up rep cutoffs (same band order). */
const PULLUP_REPS: Record<SexFormulaLike, number[]> = {
  male: [1, 5, 8, 12, 18],
  female: [1, 2, 4, 8, 12],
}

type SexFormulaLike = 'male' | 'female'

function matchesLift(exerciseId: string | null, nameSnapshot: string, spec: LiftSpec): boolean {
  if (exerciseId && spec.ids.includes(exerciseId)) return true
  const name = nameSnapshot.trim().toLowerCase()
  return spec.names.includes(name)
}

function bandFromThresholds(value: number, thresholds: number[]): StrengthLevel {
  let level: StrengthLevel = 'untrained'
  for (let i = 0; i < thresholds.length; i += 1) {
    const min = thresholds[i]
    if (min !== undefined && value >= min) level = LEVELS[i] ?? 'elite'
  }
  return level
}

function medianLevel(levels: StrengthLevel[]): StrengthLevel | null {
  if (levels.length === 0) return null
  const ranks = levels
    .map((level) => LEVELS.indexOf(level))
    .filter((rank) => rank >= 0)
    .sort((a, b) => a - b)
  if (ranks.length === 0) return null
  const mid = ranks[Math.floor((ranks.length - 1) / 2)]
  return LEVELS[mid ?? 0] ?? null
}

function bestPullUpReps(sessions: SessionDoc[], spec: LiftSpec): number | null {
  let best: number | null = null
  for (const doc of sessions) {
    for (const se of doc.session_exercises) {
      if (!matchesLift(se.exercise_id, se.name_snapshot, spec)) continue
      for (const set of se.sets) {
        if (!countsForStats(set) || set.reps === null) continue
        const added = set.weight_kg ?? 0
        if (added > 0) continue
        if (best === null || set.reps > best) best = set.reps
      }
    }
  }
  return best
}

function bestLiftE1rm(sessions: SessionDoc[], spec: LiftSpec): number | null {
  let best: number | null = null
  for (const doc of sessions) {
    for (const se of doc.session_exercises) {
      if (!matchesLift(se.exercise_id, se.name_snapshot, spec)) continue
      const estimate = bestE1RM(se.sets)
      if (estimate !== null && (best === null || estimate > best)) best = estimate
    }
  }
  return best
}

export function strengthFromHistory(
  sessions: SessionDoc[],
  bodyWeightKg: number | null,
  sex: SexFormulaLike,
): StrengthSummary {
  const lifts: LiftStrength[] = []

  for (const lift of ['squat', 'bench', 'deadlift', 'press'] as const) {
    const e1rmKg = bestLiftE1rm(sessions, LIFTS[lift])
    if (e1rmKg === null) continue
    const ratio =
      bodyWeightKg !== null && bodyWeightKg > 0 ? e1rmKg / bodyWeightKg : null
    const level =
      ratio !== null ? bandFromThresholds(ratio, RATIO_TABLE[sex][lift]) : null
    lifts.push({ lift, e1rmKg, reps: null, ratio, level })
  }

  const pullSpec = LIFTS.pullUp
  const pullReps = bestPullUpReps(sessions, pullSpec)
  const pullE1rm = bestLiftE1rm(sessions, pullSpec)
  if (pullReps !== null || pullE1rm !== null) {
    const level = pullReps !== null ? bandFromThresholds(pullReps, PULLUP_REPS[sex]) : null
    lifts.push({
      lift: 'pullUp',
      e1rmKg: pullE1rm,
      reps: pullReps,
      ratio: null,
      level,
    })
  }

  return {
    lifts,
    overall: medianLevel(lifts.map((row) => row.level).filter((level): level is StrengthLevel => level !== null)),
  }
}


