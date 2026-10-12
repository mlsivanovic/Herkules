import { describe, expect, it } from 'vitest'
import type { FlowBlock, FlowExercise, FlowSet } from './workoutFlow'
import {
  advanceAfterConfirm,
  peekAdvance,
  resolveFocus,
  sessionProgress,
  stationChips,
} from './workoutFlow'

function set(patch: Partial<FlowSet> & Pick<FlowSet, 'id' | 'position'>): FlowSet {
  return {
    isWarmup: false,
    roundIndex: patch.position,
    side: null,
    direction: null,
    completed: false,
    ...patch,
  }
}

function exercise(patch: Partial<FlowExercise> & Pick<FlowExercise, 'id' | 'position' | 'sets'>): FlowExercise {
  return {
    blockId: null,
    supersetGroup: null,
    isWarmup: false,
    restSeconds: 90,
    ...patch,
  }
}

function block(patch: Partial<FlowBlock> & Pick<FlowBlock, 'id'>): FlowBlock {
  return {
    position: 0,
    format: 'superset',
    role: 'gym',
    restAfterRoundS: 90,
    ...patch,
  }
}

function confirm(
  exercises: FlowExercise[],
  blocks: FlowBlock[],
  exerciseId: string,
  setId: string,
  options: { newlyCompleted?: boolean; focus?: { exerciseId: string; setId: string } | null; interval?: boolean } = {},
) {
  return advanceAfterConfirm({
    exercises,
    blocks,
    confirmedExerciseId: exerciseId,
    confirmedSetId: setId,
    focus: options.focus === undefined ? { exerciseId, setId } : options.focus,
    newlyCompleted: options.newlyCompleted ?? true,
    defaultRestSeconds: 90,
    intervalTimerActive: options.interval ?? false,
  })
}

describe('straight flow', () => {
  const bench = exercise({
    id: 'bench',
    position: 0,
    sets: [set({ id: 'b1', position: 1, roundIndex: 1 }), set({ id: 'b2', position: 2, roundIndex: 2 }), set({ id: 'b3', position: 3, roundIndex: 3 })],
  })
  const row = exercise({
    id: 'row',
    position: 1,
    sets: [set({ id: 'r1', position: 1, roundIndex: 1 })],
  })

  it('activates the next set and rests once, then offers the next exercise', () => {
    const first = confirm([bench, row], [], 'bench', 'b1')
    expect(first.moved).toBe(true)
    expect(first.focus).toEqual({ exerciseId: 'bench', setId: 'b2' })
    expect(first.rest?.sourceId).toBe('group:bench:r:1')
    const done = confirm(
      [{ ...bench, sets: bench.sets.map((rowSet) => ({ ...rowSet, completed: rowSet.id !== 'b3' })) }, row],
      [],
      'bench',
      'b3',
    )
    expect(done.moved).toBe(false)
    expect(done.offerExerciseId).toBe('row')
    expect(done.focus).toEqual({ exerciseId: 'bench', setId: 'b3' })
    expect(done.rest?.sourceId).toBe('group:bench:r:3')
  })

  it('does not advance when an older set is edited or the focus is elsewhere', () => {
    expect(confirm([bench], [], 'bench', 'b1', { newlyCompleted: false }).moved).toBe(false)
    expect(confirm([bench], [], 'bench', 'b1', { focus: { exerciseId: 'bench', setId: 'b2' } }).rest).toBeNull()
    expect(confirm([bench], [], 'bench', 'b1', { focus: { exerciseId: 'bench', setId: 'b2' } }).moved).toBe(false)
  })
})

describe('superset and circuit flow', () => {
  function pair(roundsA: number, roundsB: number, format: 'superset' | 'circuit' = 'superset') {
    const aSets = Array.from({ length: roundsA }, (_, index) =>
      set({ id: `a${index + 1}`, position: index + 1, roundIndex: index + 1 }),
    )
    const bSets = Array.from({ length: roundsB }, (_, index) =>
      set({ id: `b${index + 1}`, position: index + 1, roundIndex: index + 1 }),
    )
    const exercises = [
      exercise({ id: 'a', position: 0, blockId: 'block', sets: aSets }),
      exercise({ id: 'b', position: 1, blockId: 'block', sets: bSets }),
    ]
    return { exercises, blocks: [block({ id: 'block', format })] }
  }

  it('walks A1 then A2 before one round rest, for three rounds', () => {
    const { exercises, blocks } = pair(3, 3)
    let cursor = { exerciseId: 'a', setId: 'a1' }
    const rests: string[] = []
    const seen: string[] = []
    for (let guard = 0; guard < 10; guard += 1) {
      seen.push(cursor.setId)
      const current = exercises.find((row) => row.id === cursor.exerciseId)!
      current.sets = current.sets.map((row) => row.id === cursor.setId ? { ...row, completed: true } : row)
      const step = confirm(exercises, blocks, cursor.exerciseId, cursor.setId)
      if (step.rest) rests.push(step.rest.sourceId)
      if (!step.moved || !step.focus) break
      cursor = step.focus
    }
    expect(seen).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3'])
    expect(rests).toEqual(['round:block:r:1', 'round:block:r:2', 'round:block:r:3'])
  })

  it('does not invent sets or a second rest when partners have unequal rounds', () => {
    const { exercises, blocks } = pair(3, 2)
    const afterB2 = confirm(
      exercises.map((row) => ({
        ...row,
        sets: row.sets.map((item) => ({ ...item, completed: item.id === 'a1' || item.id === 'b1' || item.id === 'a2' })),
      })),
      blocks,
      'b',
      'b2',
    )
    expect(afterB2.rest?.sourceId).toBe('round:block:r:2')
    expect(afterB2.focus).toEqual({ exerciseId: 'a', setId: 'a3' })
    const ids = new Set(exercises.flatMap((row) => row.sets.map((item) => item.id)))
    expect(ids.has(afterB2.focus?.setId ?? '')).toBe(true)
    const afterA3 = confirm(
      exercises.map((row) => ({
        ...row,
        sets: row.sets.map((item) => ({ ...item, completed: item.id !== 'a3' })),
      })),
      blocks,
      'a',
      'a3',
    )
    expect(afterA3.moved).toBe(false)
    expect(afterA3.rest?.sourceId).toBe('round:block:r:3')
    expect(afterA3.offerExerciseId).toBeNull()
  })

  it('waits for legacy left and right rows and does not split a shared null side', () => {
    const left = set({ id: 'left', position: 1, roundIndex: 1, side: 'left' })
    const right = set({ id: 'right', position: 2, roundIndex: 1, side: 'right' })
    const partner = set({ id: 'partner', position: 1, roundIndex: 1 })
    const exercises = [
      exercise({ id: 'carry', position: 0, blockId: 'block', sets: [left, right] }),
      exercise({ id: 'row', position: 1, blockId: 'block', sets: [partner] }),
    ]
    const blocks = [block({ id: 'block' })]
    const afterLeft = confirm(exercises, blocks, 'carry', 'left')
    expect(afterLeft.rest).toBeNull()
    expect(afterLeft.focus?.setId).toBe('right')
    const afterRight = confirm(
      exercises.map((row) => ({
        ...row,
        sets: row.sets.map((item) => item.id === 'left' ? { ...item, completed: true } : item),
      })),
      blocks,
      'carry',
      'right',
    )
    expect(afterRight.rest).toBeNull()
    expect(afterRight.focus?.setId).toBe('partner')

    const shared = confirm(
      [
        exercise({ id: 'curl', position: 0, sets: [set({ id: 'shared', position: 1, roundIndex: 1, side: null })] }),
        exercise({ id: 'next', position: 1, sets: [set({ id: 'n1', position: 1, roundIndex: 1 })] }),
      ],
      [],
      'curl',
      'shared',
    )
    expect(shared.offerExerciseId).toBe('next')
    expect(shared.moved).toBe(false)
  })

  it('keeps warm-ups on the same exercise and a circuit of three stations in order', () => {
    const warm = exercise({
      id: 'squat',
      position: 0,
      sets: [
        set({ id: 'w', position: 1, roundIndex: null, isWarmup: true }),
        set({ id: 's1', position: 2, roundIndex: 1 }),
      ],
    })
    const warmupStep = confirm([warm], [], 'squat', 'w')
    expect(warmupStep.focus?.setId).toBe('s1')
    expect(warmupStep.rest?.sourceId).toContain('group:squat:')

    const stations = ['a', 'b', 'c'].map((id, index) =>
      exercise({
        id,
        position: index,
        blockId: 'circuit',
        sets: [set({ id: `${id}1`, position: 1, roundIndex: 1 })],
      }),
    )
    const circuit = [block({ id: 'circuit', format: 'circuit' })]
    const first = confirm(stations, circuit, 'a', 'a1')
    expect(first.focus).toEqual({ exerciseId: 'b', setId: 'b1' })
    expect(first.rest).toBeNull()
    const last = confirm(
      stations.map((row) => ({
        ...row,
        sets: row.sets.map((item) => ({ ...item, completed: row.id !== 'c' })),
      })),
      circuit,
      'c',
      'c1',
    )
    expect(last.rest?.sourceId).toBe('round:circuit:r:1')
    expect(last.moved).toBe(false)
  })

  it('does not rest for an interval block or while the interval timer is running', () => {
    const exercises = [
      exercise({ id: 'a', position: 0, blockId: 'intervals', sets: [set({ id: 'a1', position: 1, roundIndex: 1 })] }),
    ]
    const blocks = [block({ id: 'intervals', format: 'interval' })]
    expect(confirm(exercises, blocks, 'a', 'a1').rest).toBeNull()
    const straight = exercise({ id: 'bench', position: 0, sets: [set({ id: 'b1', position: 1, roundIndex: 1 })] })
    expect(confirm([straight], [], 'bench', 'b1', { interval: true }).rest).toBeNull()
  })

  it('visits an added set without creating another and does not loop', () => {
    const exercises = [
      exercise({
        id: 'a',
        position: 0,
        blockId: 'block',
        sets: [
          set({ id: 'a1', position: 1, roundIndex: 1, completed: true }),
          set({ id: 'extra', position: 2, roundIndex: null }),
        ],
      }),
      exercise({
        id: 'b',
        position: 1,
        blockId: 'block',
        sets: [set({ id: 'b1', position: 1, roundIndex: 1, completed: true })],
      }),
    ]
    const step = confirm(exercises, [block({ id: 'block' })], 'a', 'extra', {
      focus: { exerciseId: 'a', setId: 'extra' },
    })
    expect(step.moved).toBe(false)
    expect(step.rest).not.toBeNull()
    const again = confirm(exercises, [block({ id: 'block' })], 'a', 'extra', { newlyCompleted: false })
    expect(again.moved).toBe(false)
    expect(again.rest).toBeNull()
  })
})

describe('focus recovery and progress', () => {
  it('restores a saved row, otherwise the first open row, then the first row', () => {
    const exercises = [
      exercise({ id: 'a', position: 0, sets: [set({ id: 'a1', position: 1, completed: true })] }),
      exercise({ id: 'b', position: 1, sets: [] }),
      exercise({ id: 'c', position: 2, sets: [set({ id: 'c1', position: 1 }), set({ id: 'c2', position: 2 })] }),
    ]
    expect(resolveFocus(exercises, { exerciseId: 'c', setId: 'c2' })).toEqual({ exerciseId: 'c', setId: 'c2' })
    expect(resolveFocus(exercises, { exerciseId: 'gone', setId: 'x' })).toEqual({ exerciseId: 'c', setId: 'c1' })
    expect(resolveFocus(exercises, { exerciseId: 'a', setId: 'missing' })?.setId).toBe('a1')
    expect(resolveFocus([exercise({ id: 'empty', position: 0, sets: [] })], null)).toBeNull()
  })

  it('counts work groups separately from warm-ups and block rounds', () => {
    const exercises = [
      exercise({
        id: 'bench',
        position: 0,
        sets: [
          set({ id: 'w', position: 1, isWarmup: true, roundIndex: null, completed: true }),
          set({ id: 'b1', position: 2, roundIndex: 1, completed: true }),
          set({ id: 'b2', position: 3, roundIndex: 2 }),
        ],
      }),
      exercise({
        id: 'carry',
        position: 1,
        blockId: 'ss',
        sets: [
          set({ id: 'l', position: 1, roundIndex: 1, side: 'left', completed: true }),
          set({ id: 'r', position: 2, roundIndex: 1, side: 'right' }),
        ],
      }),
      exercise({
        id: 'row',
        position: 2,
        blockId: 'ss',
        sets: [set({ id: 'row1', position: 1, roundIndex: 1 })],
      }),
    ]
    const progress = sessionProgress(exercises, [block({ id: 'ss' })])
    expect(progress.exercises[0]).toMatchObject({ workDone: 1, workTotal: 2, warmupDone: 1, warmupTotal: 1, status: 'partial' })
    expect(progress.exercises[1]).toMatchObject({ workDone: 0, workTotal: 1, status: 'empty' })
    expect(progress.workTotal).toBe(4)
    expect(progress.blocks[0]).toMatchObject({ roundsDone: 0, roundsTotal: 1, extraWorkGroups: 0 })
    expect(stationChips(exercises.slice(1), 1, 'carry').map((chip) => chip.state)).toEqual(['now', 'next'])
  })

  it('peeks the next station without requiring the caller to mutate', () => {
    const exercises = [
      exercise({ id: 'a', position: 0, blockId: 'block', sets: [set({ id: 'a1', position: 1, roundIndex: 1 })] }),
      exercise({ id: 'b', position: 1, blockId: 'block', sets: [set({ id: 'b1', position: 1, roundIndex: 1 })] }),
    ]
    const peek = peekAdvance({
      exercises,
      blocks: [block({ id: 'block' })],
      exerciseId: 'a',
      setId: 'a1',
      focus: { exerciseId: 'a', setId: 'a1' },
      defaultRestSeconds: 90,
      intervalTimerActive: false,
    })
    expect(peek.focus?.setId).toBe('b1')
    expect(exercises[0]?.sets[0]?.completed).toBe(false)
  })
})
