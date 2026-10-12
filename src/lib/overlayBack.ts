// Android Back / browser Back closes the top overlay, then navigates normally.
//
// Each overlay pushes one history entry. Closing it calls history.back().
// A route change from inside the overlay (calendar day sheet → workout review)
// already leaves that entry. history.back() in the overlay cleanup would undo
// the route change and land back on the screen under the sheet.

export function overlayOnPop(depth: number, ignore: number): {
  depth: number
  ignore: number
  shouldClose: boolean
} {
  if (ignore > 0) return { depth, ignore: ignore - 1, shouldClose: false }
  if (depth <= 0) return { depth: 0, ignore: 0, shouldClose: false }
  return { depth: depth - 1, ignore: 0, shouldClose: true }
}

/** History state for an overlay entry. Keeps the router index (`idx`) intact. */
export function overlayHistoryState(previous: unknown, token: number): Record<string, unknown> {
  const base = typeof previous === 'object' && previous !== null ? { ...previous } : {}
  return { ...base, herkulesOverlay: token }
}

/** True when `state` is still the history entry pushed for this overlay. */
export function overlayEntryIsCurrent(state: unknown, token: number): boolean {
  if (typeof state !== 'object' || state === null) return false
  return (state as { herkulesOverlay?: unknown }).herkulesOverlay === token
}

type Closer = () => void

let closers: Closer[] = []
let ignorePop = 0
let listening = false
let nextToken = 1

function onPop(): void {
  const decision = overlayOnPop(closers.length, ignorePop)
  ignorePop = decision.ignore
  if (!decision.shouldClose) return
  const close = closers.pop()
  close?.()
}

/** Push one history entry. The returned function releases it without closing twice. */
export function pushOverlay(onClose: Closer): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!listening) {
    window.addEventListener('popstate', onPop)
    listening = true
  }
  const token = nextToken++
  window.history.pushState(overlayHistoryState(window.history.state, token), '')
  closers.push(onClose)
  let active = true
  return () => {
    if (!active) return
    active = false
    const index = closers.lastIndexOf(onClose)
    if (index === -1) return
    if (index !== closers.length - 1) {
      closers.splice(index, 1)
      return
    }
    closers.pop()
    // A later navigation replaced or covered this entry. Going back here
    // would pop that navigation (day sheet → history detail).
    if (!overlayEntryIsCurrent(window.history.state, token)) return
    ignorePop += 1
    window.history.back()
  }
}
