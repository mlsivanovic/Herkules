import { describe, expect, it } from 'vitest'
import {
  HYBRID_PROGRAM_TAG,
  HYBRID_SOURCE_VERSION,
  HYBRID_TEMPLATES,
  SYS,
  buildHybridV2Rows,
  buildHybridV2Upgrade,
  hybridSlotFromNotes,
  hybridTemplatesFrom,
  isHybridProgramInstalled,
  isHybridV2CanonicalRecipe,
} from './hybrid4day'

describe('Hybrid V2 canonical recipe', () => {
  it('tags every template with a unique source slot', () => {
    expect(HYBRID_SOURCE_VERSION).toBe(3)
    expect(HYBRID_TEMPLATES.map((row) => hybridSlotFromNotes(row.notes))).toEqual(['A', 'B', 'C', 'D'])
    expect(HYBRID_TEMPLATES.every((row) => row.notes.startsWith(HYBRID_PROGRAM_TAG))).toBe(true)
  })

  it('detects all four routines by source slot, notes or canonical name', () => {
    const installed = HYBRID_TEMPLATES.map((row, index) => ({
      id: `t-${index}`,
      name: row.name,
      notes: row.notes,
      source_slot: row.slot,
    }))
    expect(isHybridProgramInstalled(installed)).toBe(true)
    expect(isHybridProgramInstalled(installed.slice(0, 3))).toBe(false)
    expect(hybridTemplatesFrom(installed)?.C.id).toBe('t-2')
  })

  it('matches the complete V2 item and block snapshot', () => {
    const templates = {
      A: { id: 't-A' }, B: { id: 't-B' }, C: { id: 't-C' }, D: { id: 't-D' },
    }
    let id = 0
    const recipe = buildHybridV2Rows({
      templates,
      now: '2026-08-20T12:00:00.000Z',
      newId: () => `id-${++id}`,
    })
    const counts = Object.fromEntries(Object.entries(templates).map(([slot, template]) => [
      slot,
      recipe.items.filter((item) => item.template_id === template.id).length,
    ]))
    expect(counts).toEqual({ A: 9, B: 10, C: 12, D: 12 })
    expect(recipe.blocks).toHaveLength(23)
    expect(recipe.items.every((item) => item.block_id && item.tempo)).toBe(true)
    expect(recipe.items.every((item) => item.tempo_intent === 'controlled' || item.tempo_intent === 'explosive')).toBe(true)
  })

  it('pairs time-efficient assistance work as real block-level supersets', () => {
    const pairs = HYBRID_TEMPLATES.flatMap((day) => day.blocks
      .filter((block) => block.format === 'superset')
      .map((block) => [day.slot, block.items.map((item) => item.exerciseId)] as const))
    expect(pairs).toEqual([
      ['A', [SYS.dumbbellBenchPress, SYS.chestSupportedRow]],
      ['B', [SYS.landminePress, SYS.latPulldown]],
      ['B', [SYS.facePull, SYS.tricepsPushdown]],
      ['C', [SYS.oneArmDumbbellRow, SYS.halfKneelingCablePress]],
    ])
  })

  it('includes the missing C swing and structured circuit progression', () => {
    const day = HYBRID_TEMPLATES.find((row) => row.slot === 'C')
    const finisher = day?.blocks.find((block) => block.key === 'finisher')
    expect(day?.items).toHaveLength(12)
    expect(finisher?.items[0]?.exerciseId).toBe(SYS.kettlebellSwing)
    expect(finisher).toMatchObject({ format: 'circuit', roundsInitial: 3, roundsMax: 4, restAfterRoundS: 60 })
  })

  it('encodes the B interval instead of a generic duration/rest slot', () => {
    const block = HYBRID_TEMPLATES.find((row) => row.slot === 'B')?.blocks.find((row) => row.format === 'interval')
    expect(block?.interval).toEqual({ prepareS: 10, workS: 30, recoveryS: 60, rounds: 6, targetRpe: [8, 8] })
    expect(block?.restAfterRoundS).toBe(0)
  })

  it('uses reduced D tendon volume and carry/isometric semantics', () => {
    const day = HYBRID_TEMPLATES.find((row) => row.slot === 'D')
    const tendon = day?.blocks.find((block) => block.role === 'tendon')
    expect(tendon?.items).toHaveLength(6)
    expect(day?.items).toHaveLength(12)
    const a = HYBRID_TEMPLATES.find((row) => row.slot === 'A')
    expect(a?.items.find((item) => item.exerciseId === SYS.farmerCarry)?.distanceM).toEqual([30, 40])
    expect(a?.items.find((item) => item.exerciseId === SYS.isometricHammerCurl)?.durationS).toEqual([20, 30])
  })

  it('preserves existing plan/template ids while replacing the V1 recipe', () => {
    const existingPlan = {
      id: 'plan-existing', owner_id: 'u-1', name: 'Hybrid 4-day', notes: null,
      source_key: null, source_version: 0, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    }
    const installed = Object.fromEntries(HYBRID_TEMPLATES.map((row) => [row.slot, {
      id: `template-${row.slot}`, owner_id: 'u-1', name: row.name, notes: row.notes,
      plan_id: existingPlan.id, plan_position: row.slot.charCodeAt(0) - 65,
      created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    }])) as Parameters<typeof buildHybridV2Upgrade>[0]['installed']
    let id = 0
    const upgrade = buildHybridV2Upgrade({
      ownerId: 'u-1', existingPlan, installed, now: '2026-08-20T00:00:00Z',
      newId: () => `new-${++id}`, planName: 'Hybrid 4-day', planNotes: 'V2',
    })
    expect(upgrade.created).toBe(false)
    expect(upgrade.plan.id).toBe('plan-existing')
    expect(upgrade.plan.source_version).toBe(3)
    expect(Object.values(upgrade.templates).map((row) => row.id)).toEqual([
      'template-A', 'template-B', 'template-C', 'template-D',
    ])
    expect(new Set(upgrade.items.map((row) => row.id)).size).toBe(43)
    expect(upgrade.items.filter((row) => row.template_id === 'template-C')).toHaveLength(12)
    expect(isHybridV2CanonicalRecipe({
      templates: upgrade.templates,
      blocks: upgrade.blocks,
      items: upgrade.items,
    })).toBe(true)
    const withoutSwing = upgrade.items.filter((row) => row.exercise_id !== SYS.kettlebellSwing || row.template_id !== 'template-C')
    expect(isHybridV2CanonicalRecipe({
      templates: upgrade.templates,
      blocks: upgrade.blocks,
      items: withoutSwing,
    })).toBe(false)
  })
})
