import { describe, expect, it } from 'vitest'
import { overlayOnPop } from './overlayBack'

describe('overlayOnPop', () => {
  it('closes only the top overlay and ignores the pop caused by the close button', () => {
    expect(overlayOnPop(2, 0)).toEqual({ depth: 1, ignore: 0, shouldClose: true })
    expect(overlayOnPop(1, 1)).toEqual({ depth: 1, ignore: 0, shouldClose: false })
    expect(overlayOnPop(0, 0)).toEqual({ depth: 0, ignore: 0, shouldClose: false })
  })
})
