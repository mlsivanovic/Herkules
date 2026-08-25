// Persistent, timestamp-based interval timer controller. The phase machine lives
// in intervals.ts; this module keeps it accurate across backgrounding and UI changes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { timerCue } from './cues'
import {
  clampConfig,
  IDLE_INTERVAL,
  nextIntervalState,
  startInterval,
  type IntervalConfig,
  type IntervalPhase,
} from './intervals'

export const INTERVAL_STORAGE_KEY = 'herkules:interval-timer-v1'

export interface IntervalTimerState {
  config: IntervalConfig
  phase: IntervalPhase
  round: number
  remaining: number
  targetMs: number | null
  paused: boolean
}

let memoryState: IntervalTimerState | null = null

export function createIdleIntervalTimer(
  input: Partial<IntervalConfig> = {},
): IntervalTimerState {
  return {
    config: clampConfig(input),
    ...IDLE_INTERVAL,
    targetMs: null,
    paused: false,
  }
}

export function startIntervalTimer(
  input: Partial<IntervalConfig>,
  nowMs: number = Date.now(),
): IntervalTimerState {
  const config = clampConfig(input)
  const initial = startInterval(config)
  return {
    config,
    ...initial,
    targetMs: nowMs + initial.remaining * 1000,
    paused: false,
  }
}

/** Advance through every elapsed boundary, including time spent in the background. */
export function advanceIntervalTimer(
  state: IntervalTimerState,
  nowMs: number = Date.now(),
): IntervalTimerState {
  if (
    state.paused ||
    state.targetMs === null ||
    state.phase === 'idle' ||
    state.phase === 'done'
  ) {
    return state
  }

  let phase: IntervalPhase = state.phase
  let round = state.round
  let targetMs = state.targetMs

  while (nowMs >= targetMs) {
    const next = nextIntervalState({ phase, round, remaining: 0 }, state.config)
    phase = next.phase
    round = next.round
    if (phase === 'done') {
      return {
        ...state,
        phase,
        round,
        remaining: 0,
        targetMs: null,
        paused: false,
      }
    }
    targetMs += next.remaining * 1000
  }

  const remaining = Math.max(0, Math.ceil((targetMs - nowMs) / 1000))
  if (
    phase === state.phase &&
    round === state.round &&
    targetMs === state.targetMs &&
    remaining === state.remaining
  ) {
    return state
  }

  return { ...state, phase, round, remaining, targetMs }
}

export function pauseIntervalTimer(
  state: IntervalTimerState,
  nowMs: number = Date.now(),
): IntervalTimerState {
  const current = advanceIntervalTimer(state, nowMs)
  if (current.phase === 'idle' || current.phase === 'done' || current.paused) return current
  return { ...current, targetMs: null, paused: true }
}

export function resumeIntervalTimer(
  state: IntervalTimerState,
  nowMs: number = Date.now(),
): IntervalTimerState {
  if (!state.paused || state.phase === 'idle' || state.phase === 'done') return state
  return {
    ...state,
    targetMs: nowMs + Math.max(1, state.remaining) * 1000,
    paused: false,
  }
}

export function skipIntervalPhase(
  state: IntervalTimerState,
  nowMs: number = Date.now(),
): IntervalTimerState {
  const current = advanceIntervalTimer(state, nowMs)
  if (current.phase === 'idle' || current.phase === 'done') return current
  const next = nextIntervalState(
    { phase: current.phase, round: current.round, remaining: 0 },
    current.config,
  )
  return {
    ...current,
    ...next,
    targetMs: next.phase === 'done' || current.paused ? null : nowMs + next.remaining * 1000,
    paused: current.paused && next.phase !== 'done',
  }
}

function isIntervalPhase(value: unknown): value is IntervalPhase {
  return value === 'idle' || value === 'prepare' || value === 'work' || value === 'rest' || value === 'done'
}

export function readIntervalTimerState(): IntervalTimerState {
  let candidate: unknown = memoryState
  try {
    const raw = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(INTERVAL_STORAGE_KEY)
      : null
    if (raw) candidate = JSON.parse(raw) as unknown
  } catch {
    /* private browsing or restricted iframe */
  }

  if (!candidate || typeof candidate !== 'object') return createIdleIntervalTimer()
  const row = candidate as Partial<IntervalTimerState>
  if (!isIntervalPhase(row.phase) || !row.config || typeof row.config !== 'object') {
    return createIdleIntervalTimer()
  }

  const config = clampConfig(row.config)
  const round = Math.max(1, Math.min(config.rounds, Math.round(Number(row.round)) || 1))
  const remaining = Math.max(0, Math.round(Number(row.remaining)) || 0)
  const paused = Boolean(row.paused)
  const targetMs = Number.isFinite(Number(row.targetMs)) && Number(row.targetMs) > 0
    ? Number(row.targetMs)
    : null

  if (row.phase !== 'idle' && row.phase !== 'done' && !paused && targetMs === null) {
    return createIdleIntervalTimer(config)
  }

  return {
    config,
    phase: row.phase,
    round,
    remaining,
    targetMs: row.phase === 'idle' || row.phase === 'done' || paused ? null : targetMs,
    paused: paused && row.phase !== 'idle' && row.phase !== 'done',
  }
}

export function writeIntervalTimerState(state: IntervalTimerState): void {
  memoryState = state
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(INTERVAL_STORAGE_KEY, JSON.stringify(state))
    }
  } catch {
    /* private browsing or restricted iframe */
  }
}

export interface IntervalTimerController {
  state: IntervalTimerState
  active: boolean
  start(config: Partial<IntervalConfig>): void
  pause(): void
  resume(): void
  skipPhase(): void
  reset(): void
}

export function useIntervalTimer(): IntervalTimerController {
  const [state, setState] = useState<IntervalTimerState>(readIntervalTimerState)
  const stateRef = useRef(state)

  const commit = useCallback((next: IntervalTimerState, cue = false) => {
    stateRef.current = next
    writeIntervalTimerState(next)
    setState(next)
    if (cue) timerCue()
  }, [])

  useEffect(() => {
    function tick() {
      const current = stateRef.current
      const next = advanceIntervalTimer(current)
      if (next === current) return
      commit(next, next.phase !== current.phase || next.round !== current.round)
    }

    tick()
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [commit])

  return {
    state,
    active: state.phase !== 'idle' && state.phase !== 'done',
    start: useCallback((config: Partial<IntervalConfig>) => {
      commit(startIntervalTimer(config))
    }, [commit]),
    pause: useCallback(() => {
      commit(pauseIntervalTimer(stateRef.current))
    }, [commit]),
    resume: useCallback(() => {
      commit(resumeIntervalTimer(stateRef.current))
    }, [commit]),
    skipPhase: useCallback(() => {
      const current = stateRef.current
      const next = skipIntervalPhase(current)
      commit(next, next.phase !== current.phase || next.round !== current.round)
    }, [commit]),
    reset: useCallback(() => {
      commit(createIdleIntervalTimer(stateRef.current.config))
    }, [commit]),
  }
}
