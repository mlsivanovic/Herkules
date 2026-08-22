// Pointer reorder for mobile-first lists. HTML5 DnD is not used — it does
// not work on iOS and fights vertical scroll.
//
// Grip (immediate): touch-action:none + drag starts on pointerdown.
// Title (hold): long-press so the list can still scroll from the title.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { t } from './i18n'
import { indexAtClientY } from './reorder'

const MOUSE_HOLD_MS = 180
const TOUCH_HOLD_MS = 380
const MOUSE_SLOP_PX = 12
const TOUCH_SLOP_PX = 32
const SCROLL_EDGE_PX = 72

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
  const scrollRaf = useRef<number | null>(null)
  const lastY = useRef(0)
  const pending = useRef<{
    index: number
    pointerId: number
    startX: number
    startY: number
    slop: number
    captureEl: HTMLElement
  } | null>(null)
  const listeners = useRef<{
    move: (event: PointerEvent) => void
    up: (event: PointerEvent) => void
    cancel: (event: PointerEvent) => void
    touchMove: (event: TouchEvent) => void
  } | null>(null)

  const setItemRef = useCallback((index: number) => {
    return (el: HTMLElement | null) => {
      // Ignore the null callback React fires when the ref identity changes
      // on reorder — clearing by index would wipe a sibling that already
      // claimed that slot and make later drops snap to the ends.
      if (el) itemRefs.current[index] = el
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

  const stopAutoScroll = useCallback(() => {
    if (scrollRaf.current !== null) {
      window.cancelAnimationFrame(scrollRaf.current)
      scrollRaf.current = null
    }
  }, [])

  const detach = useCallback(() => {
    if (!listeners.current) return
    document.removeEventListener('pointermove', listeners.current.move)
    document.removeEventListener('pointerup', listeners.current.up)
    document.removeEventListener('pointercancel', listeners.current.cancel)
    document.removeEventListener('touchmove', listeners.current.touchMove, true)
    listeners.current = null
  }, [])

  const indexFromY = useCallback((clientY: number) => {
    const rects = itemRefs.current.map((el) => {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    })
    return indexAtClientY(rects, clientY)
  }, [])

  const tickAutoScroll = useCallback(() => {
    scrollRaf.current = null
    if (!dragRef.current) return
    const y = lastY.current
    const view = window.innerHeight
    let dy = 0
    if (y < SCROLL_EDGE_PX) dy = -Math.max(4, Math.ceil((SCROLL_EDGE_PX - y) / 3))
    else if (y > view - SCROLL_EDGE_PX)
      dy = Math.max(4, Math.ceil((y - (view - SCROLL_EDGE_PX)) / 3))
    if (dy === 0) return
    window.scrollBy(0, dy)
    const over = indexFromY(lastY.current)
    const drag = dragRef.current
    if (drag && over !== drag.over) {
      const next = { from: drag.from, over }
      dragRef.current = next
      setActive(next)
    }
    scrollRaf.current = window.requestAnimationFrame(tickAutoScroll)
  }, [indexFromY])

  const beginDrag = useCallback((index: number, captureEl: HTMLElement, pointerId: number) => {
    clearHold()
    try {
      captureEl.setPointerCapture(pointerId)
    } catch {
      // Pointer may already have been released.
    }
    dragRef.current = { from: index, over: index }
    setActive({ from: index, over: index })
    document.body.classList.add('is-reordering')
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  }, [clearHold])

  const finish = useCallback(
    (commit: boolean) => {
      const drag = dragRef.current
      const waiting = pending.current
      if (waiting) {
        try {
          waiting.captureEl.releasePointerCapture(waiting.pointerId)
        } catch {
          // Already released.
        }
      }
      clearHold()
      stopAutoScroll()
      pending.current = null
      dragRef.current = null
      setActive(null)
      detach()
      document.body.classList.remove('is-reordering')
      if (commit && drag && drag.from !== drag.over) {
        onMove(drag.from, drag.over)
        announce?.(t('common.movedTo', { n: drag.over + 1 }))
      }
    },
    [announce, clearHold, detach, onMove, stopAutoScroll],
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
      announce?.(t('common.movedTo', { n: to + 1 }))
    },
    [announce, itemCount, onMove],
  )

  const getHandleProps = useCallback(
    (index: number, opts?: { immediate?: boolean }) => {
      return {
        onPointerDown(event: ReactPointerEvent<HTMLElement>) {
          if (event.button !== 0 || itemCount < 2) return
          const target = event.target as HTMLElement
          if (target.closest('a, input, textarea, select, button[data-no-drag], [data-no-drag]')) {
            return
          }

          const fromGrip = Boolean(target.closest('.exercise-grip'))
          const isTouch = event.pointerType === 'touch' || event.pointerType === 'pen'
          const immediate = Boolean(opts?.immediate || fromGrip)
          const slop = isTouch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX
          const holdMs = isTouch ? TOUCH_HOLD_MS : MOUSE_HOLD_MS
          const captureEl = event.currentTarget

          if (immediate) {
            event.preventDefault()
            event.stopPropagation()
          }

          pending.current = {
            index,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            slop,
            captureEl,
          }
          lastY.current = event.clientY

          const onMovePointer = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pending.current?.pointerId && !dragRef.current) return
            lastY.current = moveEvent.clientY
            const waiting = pending.current
            if (!dragRef.current && waiting) {
              const dx = moveEvent.clientX - waiting.startX
              const dy = moveEvent.clientY - waiting.startY
              if (Math.hypot(dx, dy) > waiting.slop) {
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
            if (scrollRaf.current === null) {
              scrollRaf.current = window.requestAnimationFrame(tickAutoScroll)
            }
          }

          const onUp = (upEvent: PointerEvent) => {
            if (pending.current && upEvent.pointerId !== pending.current.pointerId) return
            finish(Boolean(dragRef.current))
          }

          const onCancel = () => {
            finish(false)
          }

          const onTouchMove = (touchEvent: TouchEvent) => {
            if (!dragRef.current) return
            touchEvent.preventDefault()
          }

          listeners.current = {
            move: onMovePointer,
            up: onUp,
            cancel: onCancel,
            touchMove: onTouchMove,
          }
          document.addEventListener('pointermove', onMovePointer, { passive: false })
          document.addEventListener('pointerup', onUp)
          document.addEventListener('pointercancel', onCancel)
          document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })

          if (immediate) {
            beginDrag(index, captureEl, event.pointerId)
          } else {
            holdTimer.current = window.setTimeout(() => {
              const waiting = pending.current
              if (!waiting || waiting.index !== index) return
              beginDrag(index, waiting.captureEl, waiting.pointerId)
            }, holdMs)
          }
        },
      }
    },
    [beginDrag, clearHold, detach, finish, indexFromY, itemCount, tickAutoScroll],
  )

  return { active, setItemRef, getHandleProps, moveBy }
}
