// Android's system back (button and edge swipe) finishes the activity, because
// this app is one WebView and hash changes do not make WebView.canGoBack() true.
// Handle it here: close the top layer, then one history step, then the parent
// screen, and only background the app from a root (home or a signed-out screen).

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { overlayIsOpen } from './overlayBack'

export type AndroidBackDecision =
  | { type: 'back' }
  | { type: 'step' }
  | { type: 'replace'; path: string }
  | { type: 'minimize' }

const BACK_ROOTS = new Set(['/', '/login', '/signup', '/reset-password'])

/** Path inside the hash, without a query or a second hash. */
export function hashPathname(hash: string): string {
  const body = hash.startsWith('#') ? hash.slice(1) : hash
  const path = body.split(/[?#]/)[0] ?? ''
  if (!path || path === '/') return '/'
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

/** React Router stores its stack position on the history entry. */
export function historyIndex(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) return null
  const idx = (state as { idx?: unknown }).idx
  return typeof idx === 'number' ? idx : null
}

/** Parent screen when this page was opened with an empty history stack. */
export function parentPath(pathname: string): string | null {
  const path = hashPathname(pathname)
  if (BACK_ROOTS.has(path) || path === '/join' || path.startsWith('/join/')) return null

  if (path.startsWith('/starters/')) {
    const parts = path.split('/')
    if (parts.length >= 4 && parts[2] && parts[3]) return `/starters/${parts[2]}`
    return '/routines'
  }
  if (path.startsWith('/routines/')) return '/routines'
  if (path.startsWith('/plans/')) return '/routines'
  if (path.startsWith('/exercises/')) return '/exercises'
  if (path.startsWith('/history/')) return '/history'
  if (path.startsWith('/coach/')) return '/coach'
  if (path === '/update-password') return '/settings'
  if (
    path === '/routines' ||
    path === '/exercises' ||
    path === '/history' ||
    path === '/coach' ||
    path === '/calendar' ||
    path === '/progress' ||
    path === '/settings' ||
    path === '/workout'
  ) {
    return '/'
  }

  const cut = path.lastIndexOf('/')
  return cut > 0 ? path.slice(0, cut) : '/'
}

/**
 * One system-back press.
 * An open dialog wins, then an in-page step (settings section, profile menu),
 * then real history, then the parent route. Roots minimize instead of trapping.
 */
export function decideAndroidBack(input: {
  pathname: string
  historyIndex: number | null
  overlayOpen: boolean
  hasStep: boolean
}): AndroidBackDecision {
  if (input.overlayOpen) return { type: 'back' }
  if (input.hasStep) return { type: 'step' }
  if ((input.historyIndex ?? 0) > 0) return { type: 'back' }
  const parent = parentPath(input.pathname)
  if (parent) return { type: 'replace', path: parent }
  return { type: 'minimize' }
}

type Step = () => void

const steps: Step[] = []

/** Register a layer that system back should close before leaving the route. */
export function pushBackStep(close: Step): () => void {
  steps.push(close)
  return () => {
    const index = steps.lastIndexOf(close)
    if (index !== -1) steps.splice(index, 1)
  }
}

export function hasAndroidBackStep(): boolean {
  return steps.length > 0
}

/** Close the top in-page layer. Returns false when none is open. */
export function takeAndroidBackStep(): boolean {
  const close = steps.pop()
  if (!close) return false
  close()
  return true
}

function replaceHash(path: string): void {
  const next = path.startsWith('/') ? path : `/${path}`
  const url = `${window.location.pathname}${window.location.search}#${next}`
  const previous = window.history.state
  const state = typeof previous === 'object' && previous !== null ? { ...previous } : {}
  delete state.herkulesOverlay
  // The parent screen should not inherit the child's router state (workout start, etc.).
  state.usr = null
  if (typeof state.idx !== 'number') state.idx = 0
  window.history.replaceState(state, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

let started = false

/** Listen for the Android system back button and the edge-swipe gesture. */
export function startAndroidBack(): void {
  if (started || Capacitor.getPlatform() !== 'android') return
  started = true
  void App.addListener('backButton', () => {
    const decision = decideAndroidBack({
      pathname: hashPathname(window.location.hash),
      historyIndex: historyIndex(window.history.state),
      overlayOpen: overlayIsOpen(),
      hasStep: hasAndroidBackStep(),
    })
    if (decision.type === 'back') {
      window.history.back()
      return
    }
    if (decision.type === 'step') {
      takeAndroidBackStep()
      return
    }
    if (decision.type === 'replace') {
      replaceHash(decision.path)
      return
    }
    void App.minimizeApp()
  }).catch(() => {})
}
