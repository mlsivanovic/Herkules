import { describe, expect, it } from 'vitest'
import {
  HYBRID_PROGRAM_TAG,
  HYBRID_TEMPLATES,
  SYS,
  hybridSlotFromNotes,
  hybridTemplatesFrom,
  isHybridProgramInstalled,
} from './hybrid4day'

describe('hybrid program tags', () => {
  it('tags every template with a unique slot', () => {
    const slots = HYBRID_TEMPLATES.map((t) => hybridSlotFromNotes(t.notes))
    expect(slots).toEqual(['A', 'B', 'C', 'D'])
    expect(HYBRID_TEMPLATES.every((t) => t.notes.startsWith(HYBRID_PROGRAM_TAG))).toBe(true)
  })

  it('detects a full install and ignores unrelated routines', () => {
    const installed = HYBRID_TEMPLATES.map((t, i) => ({ id: `t-${i}`, name: t.name, notes: t.notes }))
    expect(isHybridProgramInstalled(installed)).toBe(true)
    expect(isHybridProgramInstalled(installed.slice(0, 3))).toBe(false)
    expect(
      hybridTemplatesFrom([...installed, { id: 'other', name: 'Push day', notes: 'Push day' }])?.A.id,
    ).toBe('t-0')
  })

  it('still matches after the user edits the notes if the name is kept', () => {
    const renamedNotes = HYBRID_TEMPLATES.map((t, i) => ({
      id: `t-${i}`,
      name: t.name,
      notes: 'custom coaching',
    }))
    expect(isHybridProgramInstalled(renamedNotes)).toBe(true)
  })

  it('uses only catalog ids from SYS', () => {
    const catalog = new Set<string>(Object.values(SYS))
    const used = HYBRID_TEMPLATES.flatMap((t) => t.items.map((item) => item.exerciseId))
    for (const id of used) expect(catalog.has(id)).toBe(true)
    expect(SYS.bodyweightSquat).toBe('11111111-1111-4111-8111-111111111215')
    expect(SYS.wristPronationSupination).toBe('11111111-1111-4111-8111-111111111231')
  })
})
