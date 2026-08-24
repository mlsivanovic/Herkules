// Timestamp-based rest timer logic with sessionStorage persistence and Web Notifications.
// Survives page changes and tab backgrounding without drifting.
import { useCallback, useEffect, useState } from 'react'
import { timerCue } from './cues'
import { requestNotificationPermission, showNotification } from './notifications'
import { t } from './i18n'

export const REST_STORAGE_KEY = 'herkules:rest-target-ms'

export function readRestTarget(): number | null {
  try {
    const raw = sessionStorage.getItem(REST_STORAGE_KEY)
    if (!raw) return null
    const ms = Number(raw)
    return Number.isFinite(ms) && ms > 0 ? ms : null
  } catch {
    return null
  }
}

export function writeRestTarget(targetMs: number | null): void {
  try {
    if (targetMs !== null && targetMs > 0) {
      sessionStorage.setItem(REST_STORAGE_KEY, String(targetMs))
    } else {
      sessionStorage.removeItem(REST_STORAGE_KEY)
    }
  } catch {
    /* private mode */
  }
}

/** Compute remaining seconds based on target timestamp and current time. */
export function calculateRemainingSeconds(
  targetMs: number | null,
  nowMs: number = Date.now(),
): number | null {
  if (targetMs === null || !Number.isFinite(targetMs)) return null
  const diffMs = targetMs - nowMs
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / 1000)
}

/** Creates a new target timestamp for `seconds` from now. */
export function computeTargetMs(seconds: number, nowMs: number = Date.now()): number {
  return nowMs + Math.max(1, Math.round(seconds)) * 1000
}

/** Adds seconds to existing target (or now if none). */
export function extendTargetMs(
  targetMs: number | null,
  additionalSeconds: number,
  nowMs: number = Date.now(),
): number {
  const base = targetMs !== null && targetMs > nowMs ? targetMs : nowMs
  return base + Math.round(additionalSeconds) * 1000
}

export interface RestTimerState {
  remaining: number | null
  targetMs: number | null
  start: (seconds: number) => void
  addSeconds: (seconds: number) => void
  skip: () => void
}

export function useRestTimer(): RestTimerState {
  const [targetMs, setTargetMs] = useState<number | null>(readRestTarget)
  const [remaining, setRemaining] = useState<number | null>(() =>
    calculateRemainingSeconds(readRestTarget()),
  )

  const start = useCallback((seconds: number) => {
    void requestNotificationPermission()
    const target = computeTargetMs(seconds)
    writeRestTarget(target)
    setTargetMs(target)
    setRemaining(Math.ceil(seconds))
  }, [])

  const addSeconds = useCallback((seconds: number) => {
    setTargetMs((prev) => {
      const next = extendTargetMs(prev, seconds)
      writeRestTarget(next)
      setRemaining(calculateRemainingSeconds(next))
      return next
    })
  }, [])

  const skip = useCallback(() => {
    writeRestTarget(null)
    setTargetMs(null)
    setRemaining(null)
  }, [])

  useEffect(() => {
    if (targetMs === null) {
      setRemaining(null)
      return
    }

    function tick() {
      const rem = calculateRemainingSeconds(targetMs)
      if (rem === null || rem <= 0) {
        writeRestTarget(null)
        setTargetMs(null)
        setRemaining(null)
        timerCue()
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          showNotification(t('rest.notificationTitle'), {
            body: t('rest.notificationBody'),
          })
        }
      } else {
        setRemaining(rem)
      }
    }

    tick()
    const interval = window.setInterval(tick, 300)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onVisibilityChange)
    }
  }, [targetMs])

  return {
    remaining,
    targetMs,
    start,
    addSeconds,
    skip,
  }
}
