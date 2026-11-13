import { afterEach, describe, expect, it } from 'vitest'
import {
  decideAndroidBack,
  hashPathname,
  hasAndroidBackStep,
  historyIndex,
  parentPath,
  pushBackStep,
  takeAndroidBackStep,
} from './androidBack'

describe('hashPathname', () => {
  it('reads the route out of a hash URL', () => {
    expect(hashPathname('#/routines/abc?day=1')).toBe('/routines/abc')
    expect(hashPathname('#/')).toBe('/')
    expect(hashPathname('')).toBe('/')
    expect(hashPathname('#/settings/')).toBe('/settings')
  })
})

describe('historyIndex', () => {
  it('reads the router index and ignores anything else', () => {
    expect(historyIndex({ idx: 3, key: 'a' })).toBe(3)
    expect(historyIndex({ idx: 0 })).toBe(0)
    expect(historyIndex(null)).toBeNull()
    expect(historyIndex({ key: 'a' })).toBeNull()
  })
})

describe('parentPath', () => {
  it('walks editors and detail screens up to their list, then home', () => {
    expect(parentPath('/routines/new')).toBe('/routines')
    expect(parentPath('/routines/routine-1')).toBe('/routines')
    expect(parentPath('/routines')).toBe('/')
    expect(parentPath('/plans/plan-1')).toBe('/routines')
    expect(parentPath('/starters/hybrid-v2/0')).toBe('/starters/hybrid-v2')
    expect(parentPath('/starters/hybrid-v2')).toBe('/routines')
    expect(parentPath('/exercises/new')).toBe('/exercises')
    expect(parentPath('/exercises')).toBe('/')
    expect(parentPath('/history/session-1')).toBe('/history')
    expect(parentPath('/history')).toBe('/')
    expect(parentPath('/coach/client-1')).toBe('/coach')
    expect(parentPath('/coach')).toBe('/')
    expect(parentPath('/calendar')).toBe('/')
    expect(parentPath('/progress')).toBe('/')
    expect(parentPath('/settings')).toBe('/')
    expect(parentPath('/workout')).toBe('/')
    expect(parentPath('/update-password')).toBe('/settings')
  })

  it('treats home and signed-out screens as roots', () => {
    expect(parentPath('/')).toBeNull()
    expect(parentPath('/login')).toBeNull()
    expect(parentPath('/signup')).toBeNull()
    expect(parentPath('/reset-password')).toBeNull()
    expect(parentPath('/join/token')).toBeNull()
  })

  it('strips one segment from an unknown path', () => {
    expect(parentPath('/missing/child')).toBe('/missing')
    expect(parentPath('/missing')).toBe('/')
  })
})

describe('decideAndroidBack', () => {
  const here = { pathname: '/routines/routine-1', historyIndex: 2, overlayOpen: false, hasStep: false }

  it('closes an open dialog before anything else', () => {
    expect(decideAndroidBack({ ...here, historyIndex: 0, overlayOpen: true })).toEqual({ type: 'back' })
  })

  it('closes an in-page step before leaving the route', () => {
    expect(decideAndroidBack({ ...here, hasStep: true })).toEqual({ type: 'step' })
  })

  it('uses history when the stack has a previous screen', () => {
    expect(decideAndroidBack(here)).toEqual({ type: 'back' })
  })

  it('replaces an empty stack with the parent screen', () => {
    expect(decideAndroidBack({ ...here, historyIndex: 0 })).toEqual({ type: 'replace', path: '/routines' })
    expect(decideAndroidBack({ ...here, historyIndex: null })).toEqual({ type: 'replace', path: '/routines' })
  })

  it('minimizes only from a root', () => {
    expect(decideAndroidBack({ pathname: '/', historyIndex: 0, overlayOpen: false, hasStep: false })).toEqual({
      type: 'minimize',
    })
    expect(decideAndroidBack({ pathname: '/login', historyIndex: null, overlayOpen: false, hasStep: false })).toEqual({
      type: 'minimize',
    })
  })
})

describe('back steps', () => {
  afterEach(() => {
    while (takeAndroidBackStep()) {
      /* drain */
    }
  })

  it('closes the last registered layer and can be released', () => {
    const closed: string[] = []
    const releasePane = pushBackStep(() => closed.push('pane'))
    pushBackStep(() => closed.push('menu'))
    expect(hasAndroidBackStep()).toBe(true)
    expect(takeAndroidBackStep()).toBe(true)
    expect(closed).toEqual(['menu'])
    releasePane()
    expect(hasAndroidBackStep()).toBe(false)
    expect(takeAndroidBackStep()).toBe(false)
  })
})
