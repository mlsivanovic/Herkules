import { describe, expect, it } from 'vitest'
import { STARTER_PROGRAMS, starterBySourceKey } from './catalog'
import { SYS } from './exercises'
import { HYBRID_SOURCE_KEY } from './hybrid4day'
import { buildProgramRows, buildProgramUpgrade, isCanonicalRecipe } from './recipe'
import { STREET_SOURCE_KEY, STREET_TEMPLATES } from './street3day'
import { HOME2_SOURCE_KEY, HOME2_TEMPLATES } from './home2day'
import { HOME_TEMPLATES } from './home3day'

const GYM_ONLY = new Set<string>([
  SYS.barbellBackSquat,
  SYS.barbellBenchPress,
  SYS.deadlift,
  SYS.overheadPress,
  SYS.barbellRow,
  SYS.trapBarDeadlift,
  SYS.landminePress,
  SYS.latPulldown,
  SYS.seatedCableRow,
  SYS.facePull,
  SYS.tricepsPushdown,
  SYS.halfKneelingCablePress,
  SYS.pallofPress,
  SYS.chestPressMachine,
  SYS.legPress,
  SYS.legExtension,
  SYS.lyingLegCurl,
  SYS.seatedLegCurl,
  SYS.seatedCalfRaise,
  SYS.chestSupportedRow,
  SYS.stationaryBike,
  SYS.rowingMachine,
])

describe('starter catalog', () => {
  it('lists eight unique programs including Hybrid, Street and Home 2-day', () => {
    expect(STARTER_PROGRAMS).toHaveLength(8)
    const keys = STARTER_PROGRAMS.map((row) => row.sourceKey)
    expect(new Set(keys).size).toBe(8)
    expect(keys).toContain(HYBRID_SOURCE_KEY)
    expect(keys).toContain(STREET_SOURCE_KEY)
    expect(keys).toContain(HOME2_SOURCE_KEY)
    expect(starterBySourceKey('missing')).toBeNull()
  })

  it('gives every program consecutive A– slots and a buildable recipe', () => {
    for (const program of STARTER_PROGRAMS) {
      expect(program.templates.map((row) => row.slot)).toEqual(
        ['A', 'B', 'C', 'D'].slice(0, program.templates.length),
      )
      expect(program.templates.every((row) => row.items.length > 0)).toBe(true)
      const templates = Object.fromEntries(
        program.templates.map((row) => [row.slot, { id: `t-${row.slot}`, name: row.name, notes: row.notes, source_slot: row.slot }]),
      )
      let id = 0
      const recipe = buildProgramRows({
        definitions: program.templates,
        templates,
        now: '2026-08-21T00:00:00.000Z',
        newId: () => `id-${++id}`,
      })
      expect(recipe.blocks.length).toBeGreaterThan(0)
      expect(isCanonicalRecipe({
        definitions: program.templates,
        templates,
        blocks: recipe.blocks,
        items: recipe.items,
      })).toBe(true)
      const upgrade = buildProgramUpgrade({
        ownerId: 'u1',
        existingPlan: null,
        installed: null,
        now: '2026-08-21T00:00:00.000Z',
        newId: () => `new-${++id}`,
        sourceKey: program.sourceKey,
        sourceVersion: program.sourceVersion,
        planName: program.planName,
        planNotes: program.planNotes,
        definitions: program.templates,
      })
      expect(upgrade.created).toBe(true)
      expect(upgrade.plan.source_key).toBe(program.sourceKey)
    }
  })

  it('keeps Street and Home off gym machines, cables and barbells', () => {
    const streetIds = STREET_TEMPLATES.flatMap((day) => day.items.map((item) => item.exerciseId))
    const homeIds = HOME_TEMPLATES.flatMap((day) => day.items.map((item) => item.exerciseId))
    const home2Ids = HOME2_TEMPLATES.flatMap((day) => day.items.map((item) => item.exerciseId))
    expect(streetIds.some((id) => GYM_ONLY.has(id))).toBe(false)
    expect(homeIds.some((id) => GYM_ONLY.has(id))).toBe(false)
    expect(home2Ids.some((id) => GYM_ONLY.has(id))).toBe(false)
    expect(streetIds).toContain(SYS.pullUp)
    expect(streetIds).toContain(SYS.dip)
    expect(homeIds).toContain(SYS.gobletSquat)
    expect(home2Ids).toContain(SYS.pullUp)
    expect(home2Ids).toContain(SYS.bulgarianSplitSquat)
    expect(home2Ids).toContain(SYS.trxFacePull)
  })
})
