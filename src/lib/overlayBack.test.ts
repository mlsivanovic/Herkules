import { afterEach, describe, expect, it, vi } from 'vitest'
import { overlayEntryIsCurrent, overlayHistoryState, overlayOnPop, pushOverlay } from './overlayBack'

describe('overlayOnPop', () => {
  it('closes only the top overlay and ignores the pop caused by the close button', () => {
    expect(overlayOnPop(2, 0)).toEqual({ depth: 1, ignore: 0, shouldClose: true })
    expect(overlayOnPop(1, 1)).toEqual({ depth: 1, ignore: 0, shouldClose: false })
    expect(overlayOnPop(0, 0)).toEqual({ depth: 0, ignore: 0, shouldClose: false })
  })
})

describe('overlay history entry', () => {
  it('keeps the router index and yields back only while that entry is current', () => {
    const routerEntry = { idx: 4, key: 'cal', usr: null }
    const overlay = overlayHistoryState(routerEntry, 2)
    expect(overlay).toMatchObject({ idx: 4, key: 'cal', herkulesOverlay: 2 })
    expect(overlayEntryIsCurrent(overlay, 2)).toBe(true)

    const reviewed = { idx: 4, key: 'hist', usr: null }
    expect(overlayEntryIsCurrent(reviewed, 2)).toBe(false)
    expect(overlayEntryIsCurrent(null, 2)).toBe(false)
  })
})

describe('pushOverlay release', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not undo a route replace, and still goes back when the sheet itself closes', () => {
    const entries: unknown[] = [{ idx: 2, key: 'cal', usr: null }]
    let cursor = 0
    let backs = 0
    const listeners = new Set<() => void>()
    const history = {
      get state() {
        return entries[cursor]
      },
      pushState(state: unknown) {
        entries.splice(cursor + 1)
        entries.push(state)
        cursor += 1
      },
      replaceState(state: unknown) {
        entries[cursor] = state
      },
      back() {
        backs += 1
        if (cursor > 0) cursor -= 1
        for (const listener of [...listeners]) listener()
      },
    }
    vi.stubGlobal('window', {
      history,
      addEventListener(type: string, fn: () => void) {
        if (type === 'popstate') listeners.add(fn)
      },
      removeEventListener() {},
    })

    const abandoned = pushOverlay(() => {})
    history.replaceState({ idx: 2, key: 'hist', usr: null })
    abandoned()
    expect(backs).toBe(0)
    expect(entries[cursor]).toMatchObject({ key: 'hist' })

    let closedByPop = 0
    const release = pushOverlay(() => {
      closedByPop += 1
    })
    release()
    expect(backs).toBe(1)
    expect(closedByPop).toBe(0)
    expect(entries[cursor]).toMatchObject({ key: 'hist' })
  })
})
