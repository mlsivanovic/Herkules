// Interval timer state machine: prepare → (work ⇄ rest) × rounds → done.
// Pure logic, fully unit-testable; the ticking lives in the component.

export type IntervalPhase = 'idle' | 'prepare' | 'work' | 'rest' | 'done'

export interface IntervalConfig {
  prepare: number
  work: number
  rest: number
  rounds: number
}

export interface IntervalState {
  phase: IntervalPhase
  round: number
  remaining: number
}

export const IDLE_INTERVAL: IntervalState = { phase: 'idle', round: 1, remaining: 0 }

function clamp(value: number, min: number, max: number, fallback: number): number {
  const rounded = Math.round(Number(value))
  if (!Number.isFinite(rounded)) return fallback
  return Math.max(min, Math.min(max, rounded))
}

export function clampConfig(input: Partial<IntervalConfig>): IntervalConfig {
  return {
    prepare: clamp(input.prepare ?? 10, 0, 60, 10),
    work: clamp(input.work ?? 30, 5, 3600, 30),
    rest: clamp(input.rest ?? 30, 0, 3600, 30),
    rounds: clamp(input.rounds ?? 8, 1, 50, 8),
  }
}

export function startInterval(config: IntervalConfig): IntervalState {
  return config.prepare > 0
    ? { phase: 'prepare', round: 1, remaining: config.prepare }
    : { phase: 'work', round: 1, remaining: config.work }
}

/** The state after the current phase's countdown reaches zero. */
export function nextIntervalState(state: IntervalState, config: IntervalConfig): IntervalState {
  switch (state.phase) {
    case 'idle':
    case 'done':
      return state
    case 'prepare':
      return { phase: 'work', round: 1, remaining: config.work }
    case 'work':
      if (state.round >= config.rounds) return { phase: 'done', round: state.round, remaining: 0 }
      if (config.rest > 0) return { phase: 'rest', round: state.round, remaining: config.rest }
      return { phase: 'work', round: state.round + 1, remaining: config.work }
    case 'rest':
      return { phase: 'work', round: state.round + 1, remaining: config.work }
  }
}
