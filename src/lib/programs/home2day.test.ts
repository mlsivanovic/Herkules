import { describe, expect, it } from 'vitest'
import { SYS } from './exercises'
import {
  HOME2_PROGRAM_TAG,
  HOME2_SOURCE_KEY,
  HOME2_TEMPLATES,
} from './home2day'
import { buildProgramRows, isCanonicalRecipe } from './recipe'

describe('Home 2-day recipe', () => {
  it('is two full-body days tagged A then B', () => {
    expect(HOME2_TEMPLATES.map((row) => row.slot)).toEqual(['A', 'B'])
    expect(HOME2_TEMPLATES.every((row) => row.notes.startsWith(HOME2_PROGRAM_TAG))).toBe(true)
    expect(HOME2_SOURCE_KEY).toBe('home-2-day')
  })

  it('pairs the main lifts as supersets and keeps suitcase before curls', () => {
    const [dayA, dayB] = HOME2_TEMPLATES
    expect(dayA?.blocks.map((block) => [block.key, block.format])).toEqual([
      ['warmup', 'straight'],
      ['squat_pull', 'superset'],
      ['push_hinge', 'superset'],
      ['row_raise', 'superset'],
      ['arms_core', 'superset'],
    ])
    expect(dayB?.blocks.map((block) => [block.key, block.format])).toEqual([
      ['warmup', 'straight'],
      ['hinge_pull', 'superset'],
      ['press_lunge', 'superset'],
      ['push_face', 'superset'],
      ['carry', 'straight'],
      ['arms', 'straight'],
    ])
    expect(dayA?.blocks.find((block) => block.key === 'squat_pull')?.items.map((item) => item.exerciseId)).toEqual([
      SYS.bulgarianSplitSquat,
      SYS.pullUp,
    ])
    expect(dayB?.blocks.find((block) => block.key === 'carry')?.items[0]?.exerciseId).toBe(SYS.suitcaseHold)
    expect(dayB?.blocks.find((block) => block.key === 'arms')?.items[0]?.exerciseId).toBe(SYS.hammerCurl)
  })

  it('starts pull-ups at three rounds with RIR 2–3, not four to failure', () => {
    const pull = HOME2_TEMPLATES[0]?.items.find((item) => item.exerciseId === SYS.pullUp)
    expect(pull?.plannedSets).toBe(3)
    expect(pull?.reps).toEqual([5, 8])
    expect(pull?.rir).toEqual([2, 3])
  })

  it('uses home-only loading: TRX, split stance, no cable face pull', () => {
    const ids = HOME2_TEMPLATES.flatMap((day) => day.items.map((item) => item.exerciseId))
    expect(ids).toContain(SYS.trxFacePull)
    expect(ids).toContain(SYS.trxBodySaw)
    expect(ids).toContain(SYS.reverseLunge)
    expect(ids).toContain(SYS.singleLegRdl)
    expect(ids).not.toContain(SYS.facePull)
    expect(ids).not.toContain(SYS.gobletSquat)
    expect(ids).not.toContain(SYS.dbRdl)
  })

  it('builds a canonical recipe', () => {
    const templates = Object.fromEntries(
      HOME2_TEMPLATES.map((row) => [row.slot, { id: `t-${row.slot}`, name: row.name, notes: row.notes, source_slot: row.slot }]),
    )
    let id = 0
    const recipe = buildProgramRows({
      definitions: HOME2_TEMPLATES,
      templates,
      now: '2026-08-23T00:00:00.000Z',
      newId: () => `id-${++id}`,
    })
    expect(isCanonicalRecipe({
      definitions: HOME2_TEMPLATES,
      templates,
      blocks: recipe.blocks,
      items: recipe.items,
    })).toBe(true)
    expect(recipe.items.every((item) => item.notes && item.notes.length > 20 || item.is_warmup)).toBe(true)
  })
})
