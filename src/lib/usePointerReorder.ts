// Press-and-hold pointer reorder for mobile-first lists. HTML5 DnD is not
// used — it does not work on iOS and fights vertical scroll.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const HOLD_MS = 200
const CANCEL_MOVE_PX = 8

export interface ReorderActive {
  from: number
  over: number
}

export function usePointerReorder(options: {
  itemCount: number
  onMove: (from: number, to: number) => void
  announce?: (message: string) => void
}) {
  const { itemCount, onMove, announce } = options
  const [active, setActive] = useState<ReorderActive | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const dragRef = useRef<ReorderActive | null>(null)
  const holdTimer = useRef<number | null>(null)
  const pending = useRef<{
    index: number
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const listeners = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
  } | null>(null)

  const setItemRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      itemRefs.current[index] = el
    }
  }, [])

  useEffect(() => {
    itemRefs.current.length = itemCount
  }, [itemCount])

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const detach = useCallback(() => {
    if (!listeners.current) return
    document.removeEventListener('pointermove', listeners.current.move)
    document.removeEventListener('pointerup', listeners.current.up)
    document.removeEventListener('pointercancel', listeners.current.up)
    listeners.current = null
  }, [])

  const indexFromY = useCallback((clientY: number) => {
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < itemRefs.current.length; i += 1) {
      const el = itemRefs.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(clientY - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    return best
  }, [])

  const finish = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current
      clearHold()
      pending.current = null
      dragRef.current = null
      setActive(null)
      detach()
      document.body.classList.remove('is-reordering')
      if (commit && drag && drag.from !== drag.over) {
        onMove(drag.from, drag.over)
        announce?.(`Moved to position ${drag.over + 1}`)
      }
    },
    [announce, clearHold, detach, onMove],
  )

  const finishRef = useRef(finish)
  finishRef.current = finish
  useEffect(() => () => finishRef.current(false), [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && (dragRef.current || pending.current)) {
        event.preventDefault()
        finish(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  const moveBy = useCallback(
    (index: number, delta: number) => {
      const to = index + delta
      if (to < 0 || to >= itemCount) return
      onMove(index, to)
      announce?.(`Moved to position ${to + 1}`)
    },
    [announce, itemCount, onMove],
  )

  const getHandleProps = useCallback(
    (index: number) => {
      return {
        onPointerDown(event: ReactPointerEvent<HTMLElement>) {
          if (event.button !== 0 || itemCount < 2) return
          const target = event.target as HTMLElement
          if (target.closest('a, input, textarea, select, button[data-no-drag], [data-no-drag]')) {
            return
          }

          pending.current = {
            index,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
          }

          const onMovePointer = (moveEvent: PointerEvent) => {
            const waiting = pending.current
            if (!dragRef.current && waiting) {
              const dx = moveEvent.clientX - waiting.startX
              const dy = moveEvent.clientY - waiting.startY
              if (Math.hypot(dx, dy) > CANCEL_MOVE_PX) {
                clearHold()
                pending.current = null
                detach()
              }
              return
            }
            const drag = dragRef.current
            if (!drag) return
            moveEvent.preventDefault()
            const over = indexFromY(moveEvent.clientY)
            if (over !== drag.over) {
              const next = { from: drag.from, over }
              dragRef.current = next
              setActive(next)
            }
          }

          const onUp = () => {
            finish(Boolean(dragRef.current))
          }

          listeners.current = { move: onMovePointer, up: onUp }
          document.addEventListener('pointermove', onMovePointer, { passive: false })
          document.addEventListener('pointerup', onUp)
          document.addEventListener('pointercancel', onUp)

          holdTimer.current = window.setTimeout(() => {
            const waiting = pending.current
            if (!waiting || waiting.index !== index) return
            dragRef.current = { from: index, over: index }
            setActive({ from: index, over: index })
            document.body.classList.add('is-reordering')
          }, HOLD_MS)
        },
      }
    },
    [clearHold, detach, finish, indexFromY, itemCount],
  )

  return { active, setItemRef, getHandleProps, moveBy }
}
