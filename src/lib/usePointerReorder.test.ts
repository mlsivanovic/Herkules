import { describe, expect, it } from 'vitest'
import { pointerReorderActivation } from './usePointerReorder'

describe('pointerReorderActivation', () => {
  it('requires a long hold on touch, including the grip', () => {
    expect(pointerReorderActivation('touch', true)).toEqual({
      immediate: false,
      holdMs: 600,
      slop: 32,
    })
    expect(pointerReorderActivation('touch', false).immediate).toBe(false)
    expect(pointerReorderActivation('pen', true).immediate).toBe(false)
  })

  it('starts mouse grip drags immediately and holds on the title', () => {
    expect(pointerReorderActivation('mouse', true)).toEqual({
      immediate: true,
      holdMs: 350,
      slop: 12,
    })
    expect(pointerReorderActivation('mouse', false)).toMatchObject({
      immediate: false,
      holdMs: 350,
    })
  })
})
