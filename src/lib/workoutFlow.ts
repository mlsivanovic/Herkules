// Pure workout navigation. No timers, storage, or network.
// Session documents stay the source of truth; this only chooses the next row.

import type { SessionDoc, SessionExerciseDoc, SetRow, WorkoutBlockFormat } from '../types/db'
import { isBlockRoundComplete, isSetGroupComplete } from './prescription'

export interface FlowSet {
  id: string
  position: number
  isWarmup: boolean
  roundIndex: number | null
  side: 'left' | 'right' | null
  direction: 'pronation' | 'supination' | null
  completed: boolean
}

export interface FlowExercise {
  id: string
  position: number
  blockId: string | null
  supersetGroup: string | null
  isWarmup: boolean
  restSeconds: number | null
  sets: FlowSet[]
}

export interface FlowBlock {
  id: string
  position: number
  format: WorkoutBlockFormat
  role: string
  restAfterRoundS: number | null
}

export interface FlowFocus {
  exerciseId: string
  setId: string
}

export interface RestIntent {
  seconds: number
  sourceId: string
}

export interface AdvanceResult {
  focus: FlowFocus | null
  /** Set when the user should be offered the next exercise instead of being moved. */
  offerExerciseId: string | null
  rest: RestIntent | null
  moved: boolean
}

export interface ExerciseProgress {
  exerciseId: string
  workDone: number
  workTotal: number
  warmupDone: number
  warmupTotal: number
  /** Work-set status. Warm-up never hides inside the work count. */
  status: 'none' | 'empty' | 'partial' | 'done'
}

export interface BlockProgress {
  blockId: string
  format: WorkoutBlockFormat
  roundsDone: number
  roundsTotal: number
  extraWorkGroups: number
}

export interface SessionProgress {
  workDone: number
  workTotal: number
  warmupDone: number
  warmupTotal: number
  exercises: ExerciseProgress[]
  blocks: BlockProgress[]
}

export interface StationChip {
  exerciseId: string
  state: 'done' | 'now' | 'next' | 'pending' | 'absent'
}

interface Cursor {
  round: number
  exercisePosition: number
  setPosition: number
}

const UNSCHEDULED_ROUND = 1_000_000

function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position
}

export function groupKey(set: Pick<FlowSet, 'roundIndex' | 'position'>): string {
  return set.roundIndex != null ? `r:${set.roundIndex}` : `p:${set.position}`
}

function cursorOf(exercise: FlowExercise, set: FlowSet): Cursor {
  return {
    round: set.roundIndex ?? UNSCHEDULED_ROUND,
    exercisePosition: exercise.position,
    setPosition: set.position,
  }
}

function compareCursor(a: Cursor, b: Cursor): number {
  if (a.round !== b.round) return a.round - b.round
  if (a.exercisePosition !== b.exercisePosition) return a.exercisePosition - b.exercisePosition
  return a.setPosition - b.setPosition
}

function blockOf(exercise: FlowExercise, blocks: FlowBlock[]): FlowBlock | null {
  if (!exercise.blockId) return null
  return blocks.find((block) => block.id === exercise.blockId) ?? null
}

/** Structured block partners, otherwise a legacy superset_group of 2+ exercises. */
export function flowMembers(
  exercise: FlowExercise,
  exercises: FlowExercise[],
  blocks: FlowBlock[],
): FlowExercise[] {
  const block = blockOf(exercise, blocks)
  if (block && block.format !== 'straight') {
    const group = exercises.filter((row) => row.blockId === block.id).sort(byPosition)
    if (group.length > 0) return group
  }
  if (exercise.supersetGroup) {
    const group = exercises
      .filter((row) => row.supersetGroup === exercise.supersetGroup)
      .sort(byPosition)
    if (group.length >= 2) return group
  }
  return [exercise]
}

function usesPartnerFlow(exercise: FlowExercise, set: FlowSet, members: FlowExercise[], blocks: FlowBlock[]): boolean {
  if (set.isWarmup || exercise.isWarmup) return false
  if (members.length < 2) return false
  const block = blockOf(exercise, blocks)
  if (block?.format === 'interval') return true
  if (block && block.format !== 'straight') return true
  return exercise.supersetGroup != null && members.length >= 2
}

function asSetRow(exerciseId: string, set: FlowSet): SetRow {
  return {
    id: set.id,
    session_exercise_id: exerciseId,
    position: set.position,
    weight_kg: null,
    reps: null,
    duration_s: null,
    distance_m: null,
    rpe: null,
    notes: null,
    is_warmup: set.isWarmup,
    round_index: set.roundIndex,
    side: set.side,
    direction: set.direction,
    completed_at: set.completed ? '1970-01-01T00:00:00.000Z' : null,
    created_at: '1970-01-01T00:00:00.000Z',
    updated_at: '1970-01-01T00:00:00.000Z',
  }
}

function rowsInGroup(exercise: FlowExercise, set: FlowSet): SetRow[] {
  const key = groupKey(set)
  return exercise.sets
    .filter((row) => groupKey(row) === key)
    .map((row) => asSetRow(exercise.id, row))
}

/** Work rows only, so a warm-up position cannot collide with round_index. */
function workRows(exercise: FlowExercise): SetRow[] {
  return exercise.sets.filter((set) => !set.isWarmup).map((set) => asSetRow(exercise.id, set))
}

function restSeconds(
  exercise: FlowExercise,
  block: FlowBlock | null,
  kind: 'round' | 'set',
  fallback: number,
): number {
  if (kind === 'round') {
    if (block?.restAfterRoundS != null) return block.restAfterRoundS
  }
  if (exercise.restSeconds != null) return exercise.restSeconds
  return fallback
}

function positiveRest(seconds: number, sourceId: string): RestIntent | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return { seconds, sourceId }
}

function offerAfter(exercises: FlowExercise[], currentId: string, skipIds: Set<string>): string | null {
  const ordered = [...exercises].sort(byPosition)
  const index = ordered.findIndex((exercise) => exercise.id === currentId)
  const later = ordered.slice(index + 1).find((exercise) => !skipIds.has(exercise.id) && exercise.sets.length > 0)
  if (later) return later.id
  const earlier = ordered.find((exercise) => !skipIds.has(exercise.id) && exercise.sets.some((set) => !set.completed))
  return earlier?.id ?? null
}

function nextByPosition(exercise: FlowExercise, afterPosition: number): FlowSet | null {
  return exercise.sets
    .filter((set) => !set.completed && set.position > afterPosition)
    .sort(byPosition)[0] ?? null
}

function nextPartnerWork(
  members: FlowExercise[],
  current: Cursor,
): { exercise: FlowExercise; set: FlowSet } | null {
  let best: { exercise: FlowExercise; set: FlowSet } | null = null
  let bestCursor: Cursor | null = null
  for (const exercise of members) {
    for (const set of exercise.sets) {
      if (set.completed || set.isWarmup) continue
      const cursor = cursorOf(exercise, set)
      if (compareCursor(cursor, current) <= 0) continue
      if (!bestCursor || compareCursor(cursor, bestCursor) < 0) {
        best = { exercise, set }
        bestCursor = cursor
      }
    }
  }
  return best
}

export function advanceAfterConfirm(input: {
  exercises: FlowExercise[]
  blocks: FlowBlock[]
  confirmedExerciseId: string
  confirmedSetId: string
  focus: FlowFocus | null
  newlyCompleted: boolean
  defaultRestSeconds: number
  intervalTimerActive: boolean
}): AdvanceResult {
  const stayFocus = input.focus
  const stay: AdvanceResult = {
    focus: stayFocus,
    offerExerciseId: null,
    rest: null,
    moved: false,
  }
  if (!input.newlyCompleted) return stay
  if (!input.focus || input.focus.exerciseId !== input.confirmedExerciseId || input.focus.setId !== input.confirmedSetId) {
    return stay
  }

  const exercises = input.exercises.map((row) => ({
    ...row,
    sets: row.sets.map((candidate) =>
      row.id === input.confirmedExerciseId && candidate.id === input.confirmedSetId
        ? { ...candidate, completed: true }
        : candidate,
    ),
  }))
  const exercise = exercises.find((row) => row.id === input.confirmedExerciseId)
  const set = exercise?.sets.find((row) => row.id === input.confirmedSetId)
  if (!exercise || !set) return { ...stay, focus: null }

  const members = flowMembers(exercise, exercises, input.blocks)
  const block = blockOf(exercise, input.blocks)
  const intervalOwnsRest = input.intervalTimerActive || block?.format === 'interval'
  const partnerFlow = usesPartnerFlow(exercise, set, members, input.blocks)
  const memberIds = new Set(members.map((row) => row.id))

  if (!partnerFlow) {
    const groupDone = isSetGroupComplete(rowsInGroup(exercise, set), asSetRow(exercise.id, set))
    const rest = !intervalOwnsRest && groupDone
      ? positiveRest(
          restSeconds(exercise, block, 'set', input.defaultRestSeconds),
          `group:${exercise.id}:${groupKey(set)}`,
        )
      : null
    const next = nextByPosition(exercise, set.position)
    if (next) {
      return {
        focus: { exerciseId: exercise.id, setId: next.id },
        offerExerciseId: null,
        rest,
        moved: true,
      }
    }
    return {
      focus: { exerciseId: exercise.id, setId: set.id },
      offerExerciseId: offerAfter(exercises, exercise.id, new Set()),
      rest,
      moved: false,
    }
  }

  const current = cursorOf(exercise, set)
  const next = nextPartnerWork(members, current)
  const sameRound = next != null && groupKey(next.set) === groupKey(set)
  if (next && sameRound) {
    return {
      focus: { exerciseId: next.exercise.id, setId: next.set.id },
      offerExerciseId: null,
      rest: null,
      moved: true,
    }
  }

  const roundDone = isBlockRoundComplete(
    members.map((member) => ({ sets: workRows(member) }) as SessionExerciseDoc),
    asSetRow(exercise.id, set),
  )
  const rest = !intervalOwnsRest && roundDone
    ? positiveRest(
        restSeconds(exercise, block, 'round', input.defaultRestSeconds),
        `round:${block?.id ?? exercise.supersetGroup ?? exercise.id}:${groupKey(set)}`,
      )
    : null

  if (next) {
    return {
      focus: { exerciseId: next.exercise.id, setId: next.set.id },
      offerExerciseId: null,
      rest,
      moved: true,
    }
  }

  return {
    focus: { exerciseId: exercise.id, setId: set.id },
    offerExerciseId: offerAfter(exercises, exercise.id, memberIds),
    rest,
    moved: false,
  }
}

/**
 * Keep a saved choice when it still exists. Otherwise the first open row, then the first row.
 * A chosen exercise with no set rows yet (added mid-workout, or every set deleted)
 * keeps an exercise-level focus with an empty setId so it can still be opened
 * and given its first set.
 */
export function resolveFocus(exercises: FlowExercise[], preferred: FlowFocus | null): FlowFocus | null {
  const ordered = [...exercises].sort(byPosition)
  if (preferred) {
    const exercise = ordered.find((row) => row.id === preferred.exerciseId)
    if (exercise) {
      if (exercise.sets.some((set) => set.id === preferred.setId)) return preferred
      const open = [...exercise.sets].sort(byPosition).find((set) => !set.completed)
      const fallback = open ?? [...exercise.sets].sort(byPosition)[0]
      if (fallback) return { exerciseId: exercise.id, setId: fallback.id }
      return { exerciseId: exercise.id, setId: '' }
    }
  }
  for (const exercise of ordered) {
    const open = [...exercise.sets].sort(byPosition).find((set) => !set.completed)
    if (open) return { exerciseId: exercise.id, setId: open.id }
  }
  for (const exercise of ordered) {
    const first = [...exercise.sets].sort(byPosition)[0]
    if (first) return { exerciseId: exercise.id, setId: first.id }
  }
  return null
}

function groupsOf(sets: FlowSet[], warmup: boolean): string[] {
  const keys: string[] = []
  for (const set of [...sets].filter((row) => row.isWarmup === warmup).sort(byPosition)) {
    const key = groupKey(set)
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

function groupDone(sets: FlowSet[], key: string, warmup: boolean): boolean {
  const rows = sets.filter((set) => set.isWarmup === warmup && groupKey(set) === key)
  return rows.length > 0 && rows.every((set) => set.completed)
}

export function exerciseProgress(exercise: FlowExercise): ExerciseProgress {
  const workKeys = groupsOf(exercise.sets, false)
  const warmupKeys = groupsOf(exercise.sets, true)
  const workDone = workKeys.filter((key) => groupDone(exercise.sets, key, false)).length
  const warmupDone = warmupKeys.filter((key) => groupDone(exercise.sets, key, true)).length
  let status: ExerciseProgress['status'] = 'none'
  if (exercise.sets.length === 0) status = 'none'
  else if (workKeys.length === 0) {
    if (warmupDone === 0) status = 'empty'
    else if (warmupDone < warmupKeys.length) status = 'partial'
    else status = 'done'
  } else if (workDone === 0) status = 'empty'
  else if (workDone < workKeys.length) status = 'partial'
  else status = 'done'
  return {
    exerciseId: exercise.id,
    workDone,
    workTotal: workKeys.length,
    warmupDone,
    warmupTotal: warmupKeys.length,
    status,
  }
}

export function sessionProgress(exercises: FlowExercise[], blocks: FlowBlock[]): SessionProgress {
  const exercisesProgress = [...exercises].sort(byPosition).map(exerciseProgress)
  const blockProgress: BlockProgress[] = [...blocks].sort(byPosition).map((block) => {
    const members = exercises.filter((exercise) => exercise.blockId === block.id)
    const roundKeys = new Set<number>()
    let extra = 0
    for (const member of members) {
      for (const key of groupsOf(member.sets, false)) {
        if (key.startsWith('r:')) roundKeys.add(Number(key.slice(2)))
        else extra += 1
      }
    }
    const rounds = [...roundKeys].sort((a, b) => a - b)
    const roundsDone = rounds.filter((round) => {
      const holders = members.filter((member) =>
        member.sets.some((set) => !set.isWarmup && set.roundIndex === round),
      )
      if (holders.length === 0) return false
      return holders.every((member) =>
        member.sets
          .filter((set) => !set.isWarmup && set.roundIndex === round)
          .every((set) => set.completed),
      )
    }).length
    return {
      blockId: block.id,
      format: block.format,
      roundsDone,
      roundsTotal: rounds.length,
      extraWorkGroups: extra,
    }
  })
  return {
    workDone: exercisesProgress.reduce((sum, row) => sum + row.workDone, 0),
    workTotal: exercisesProgress.reduce((sum, row) => sum + row.workTotal, 0),
    warmupDone: exercisesProgress.reduce((sum, row) => sum + row.warmupDone, 0),
    warmupTotal: exercisesProgress.reduce((sum, row) => sum + row.warmupTotal, 0),
    exercises: exercisesProgress,
    blocks: blockProgress,
  }
}

export function stationChips(
  members: FlowExercise[],
  roundIndex: number | null,
  focusExerciseId: string | null,
): StationChip[] {
  const ordered = [...members].sort(byPosition)
  const states: StationChip[] = ordered.map((exercise) => {
    const rows = exercise.sets.filter((set) => !set.isWarmup && (roundIndex == null || set.roundIndex === roundIndex))
    if (roundIndex != null && rows.length === 0) return { exerciseId: exercise.id, state: 'absent' as const }
    if (rows.length > 0 && rows.every((set) => set.completed)) return { exerciseId: exercise.id, state: 'done' as const }
    if (exercise.id === focusExerciseId) return { exerciseId: exercise.id, state: 'now' as const }
    return { exerciseId: exercise.id, state: 'pending' as const }
  })
  const nowIndex = states.findIndex((chip) => chip.state === 'now')
  if (nowIndex >= 0) {
    const next = states.findIndex((chip, index) => index > nowIndex && chip.state === 'pending')
    const wrapped = next >= 0 ? next : states.findIndex((chip) => chip.state === 'pending')
    if (wrapped >= 0 && states[wrapped]) states[wrapped] = { ...states[wrapped], state: 'next' }
  }
  return states
}

export function sessionFlowProgress(session: Pick<SessionDoc, 'session_exercises' | 'session_blocks'>): SessionProgress {
  const flow = flowFromSession(session)
  return sessionProgress(flow.exercises, flow.blocks)
}

export function flowFromSession(session: Pick<SessionDoc, 'session_exercises' | 'session_blocks'>): {
  exercises: FlowExercise[]
  blocks: FlowBlock[]
} {
  return {
    blocks: (session.session_blocks ?? []).map((block) => ({
      id: block.id,
      position: block.position,
      format: block.format,
      role: block.role,
      restAfterRoundS: block.rest_after_round_s,
    })),
    exercises: session.session_exercises.map((exercise) => ({
      id: exercise.id,
      position: exercise.position,
      blockId: exercise.session_block_id ?? null,
      supersetGroup: exercise.superset_group,
      isWarmup: exercise.is_warmup === true,
      restSeconds: exercise.rest_seconds,
      sets: exercise.sets.map(flowSetFromRow),
    })),
  }
}

export function flowSetFromRow(set: SetRow): FlowSet {
  return {
    id: set.id,
    position: set.position,
    isWarmup: set.is_warmup === true,
    roundIndex: set.round_index ?? null,
    side: set.side ?? null,
    direction: set.direction ?? null,
    completed: set.completed_at !== null,
  }
}

/** Mark one set completed and ask what the logger should do. Does not mutate the input. */
export function peekAdvance(
  input: Omit<Parameters<typeof advanceAfterConfirm>[0], 'newlyCompleted' | 'confirmedExerciseId' | 'confirmedSetId'> & {
    exerciseId: string
    setId: string
  },
): AdvanceResult {
  const exercises = input.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) =>
      exercise.id === input.exerciseId && set.id === input.setId ? { ...set, completed: true } : set,
    ),
  }))
  return advanceAfterConfirm({
    ...input,
    exercises,
    confirmedExerciseId: input.exerciseId,
    confirmedSetId: input.setId,
    newlyCompleted: true,
  })
}
