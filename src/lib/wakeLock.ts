// Screen Wake Lock API helper: keeps the screen awake during active workouts.
// Handles auto-reacquisition on document visibility changes (e.g. switching back to the tab).
import { useEffect, useRef, useState } from 'react'

export interface WakeLockSentinelLike {
  released: boolean
  release(): Promise<void>
  addEventListener?(type: 'release', listener: () => void): void
  removeEventListener?(type: 'release', listener: () => void): void
}

export type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>
  }
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

export async function requestScreenWakeLock(): Promise<WakeLockSentinelLike | null> {
  if (!isWakeLockSupported()) return null
  try {
    const nav = navigator as WakeLockNavigator
    return (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    // Fails silently if denied, battery saver active, or window minimized
    return null
  }
}

export function useScreenWakeLock(enabled: boolean): {
  isLocked: boolean
  isSupported: boolean
} {
  const isSupported = isWakeLockSupported()
  const [locked, setLocked] = useState(false)
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled || !isSupported) {
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {})
        sentinelRef.current = null
        setLocked(false)
      }
      return
    }

    let cancelled = false

    async function acquire() {
      const sentinel = await requestScreenWakeLock()
      if (cancelled) {
        void sentinel?.release().catch(() => {})
        return
      }
      if (sentinel) {
        sentinelRef.current = sentinel
        setLocked(true)
        sentinel.addEventListener?.('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null
            setLocked(false)
          }
        })
      } else {
        setLocked(false)
      }
    }

    void acquire()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && enabledRef.current && !sentinelRef.current) {
        void acquire()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {})
        sentinelRef.current = null
        setLocked(false)
      }
    }
  }, [enabled, isSupported])

  return {
    isLocked: locked,
    isSupported,
  }
}
