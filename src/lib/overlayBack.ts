// Android Back / browser Back closes the top overlay, then navigates normally.

export function overlayOnPop(depth: number, ignore: number): {
  depth: number
  ignore: number
  shouldClose: boolean
} {
  if (ignore > 0) return { depth, ignore: ignore - 1, shouldClose: false }
  if (depth <= 0) return { depth: 0, ignore: 0, shouldClose: false }
  return { depth: depth - 1, ignore: 0, shouldClose: true }
}

type Closer = () => void

let closers: Closer[] = []
let ignorePop = 0
let listening = false

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
  window.history.pushState({ herkulesOverlay: closers.length + 1 }, '')
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
    ignorePop += 1
    window.history.back()
  }
}
