// Timestamp-based rest timer logic with sessionStorage persistence and Web Notifications.
// Survives page changes and tab backgrounding without drifting.
import { useCallback, useEffect, useState } from 'react'
import { timerCue } from './cues'
import { requestNotificationPermission, showNotification } from './notifications'
import { t } from './i18n'

export const REST_STORAGE_KEY = 'herkules:rest-target-ms'

export interface RestOrigin {
  sourceId: string
  /** Manual rests are not cancelled when an older set is undone. */
  manual: boolean
}

interface RestRecord {
  targetMs: number
  origin: RestOrigin | null
}

let memoryRecord: RestRecord | null = null

function parseRestRaw(raw: string | null): RestRecord | null {
  if (!raw) return null
  if (raw.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || !('targetMs' in parsed)) return null
      const targetMs = Number((parsed as { targetMs: unknown }).targetMs)
      if (!Number.isFinite(targetMs) || targetMs <= 0) return null
      const originRaw = (parsed as { origin?: unknown }).origin
      let origin: RestOrigin | null = null
      if (typeof originRaw === 'object' && originRaw !== null && 'sourceId' in originRaw) {
        const sourceId = (originRaw as { sourceId: unknown }).sourceId
        const manual = (originRaw as { manual?: unknown }).manual === true
        if (typeof sourceId === 'string' && sourceId) origin = { sourceId, manual }
      }
      return { targetMs, origin }
    } catch {
      return null
    }
  }
  const ms = Number(raw)
  return Number.isFinite(ms) && ms > 0 ? { targetMs: ms, origin: null } : null
}

function readRecord(): RestRecord | null {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      return parseRestRaw(sessionStorage.getItem(REST_STORAGE_KEY))
    }
  } catch {
    /* private browsing or restricted iframe */
  }
  return memoryRecord
}

export function readRestTarget(): number | null {
  return readRecord()?.targetMs ?? null
}

export function readRestOrigin(): RestOrigin | null {
  return readRecord()?.origin ?? null
}

export function writeRestTarget(targetMs: number | null, origin?: RestOrigin | null): void {
  if (targetMs === null || targetMs <= 0) {
    memoryRecord = null
  } else {
    // Omitting origin keeps the rest tied to the set that started it (+15s).
    const kept = origin === undefined ? (readRecord()?.origin ?? null) : origin
    memoryRecord = { targetMs, origin: kept }
  }
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      if (memoryRecord === null) sessionStorage.removeItem(REST_STORAGE_KEY)
      else if (memoryRecord.origin) sessionStorage.setItem(REST_STORAGE_KEY, JSON.stringify(memoryRecord))
      else sessionStorage.setItem(REST_STORAGE_KEY, String(memoryRecord.targetMs))
    }
  } catch {
    /* private browsing or restricted iframe */
  }
}

/** Cancel only the rest that this confirmation started. */
export function cancelRestFromSource(sourceId: string): boolean {
  const record = readRecord()
  if (!record?.origin || record.origin.manual || record.origin.sourceId !== sourceId) return false
  writeRestTarget(null)
  return true
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
  origin: RestOrigin | null
  start: (seconds: number, origin?: RestOrigin | null) => void
  addSeconds: (seconds: number) => void
  skip: () => void
  cancelIfSource: (sourceId: string) => boolean
}

export function useRestTimer(): RestTimerState {
  const [targetMs, setTargetMs] = useState<number | null>(readRestTarget)
  const [origin, setOrigin] = useState<RestOrigin | null>(readRestOrigin)
  const [remaining, setRemaining] = useState<number | null>(() =>
    calculateRemainingSeconds(readRestTarget()),
  )

  const start = useCallback((seconds: number, nextOrigin?: RestOrigin | null) => {
    void requestNotificationPermission()
    const target = computeTargetMs(seconds)
    const stored = nextOrigin ?? null
    writeRestTarget(target, stored)
    setOrigin(stored)
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
    setOrigin(null)
    setTargetMs(null)
    setRemaining(null)
  }, [])

  const cancelIfSource = useCallback((sourceId: string) => {
    const cancelled = cancelRestFromSource(sourceId)
    if (!cancelled) return false
    setOrigin(null)
    setTargetMs(null)
    setRemaining(null)
    return true
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
        setOrigin(null)
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
    origin,
    start,
    addSeconds,
    skip,
    cancelIfSource,
  }
}
