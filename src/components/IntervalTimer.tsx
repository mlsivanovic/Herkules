// Interval / HIIT companion timer: prepare → (work ⇄ rest) × rounds.
// Sound and haptic cues fire on every phase change; a screen wake lock is
// held while running so the phone stays awake on cardio equipment.
import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui'
import { timerCue } from '../lib/cues'
import {
  clampConfig,
  IDLE_INTERVAL,
  nextIntervalState,
  startInterval,
  type IntervalState,
} from '../lib/intervals'
import { formatDuration } from '../lib/units'
import './intervalTimer.css'

interface WakeLockSentinelLike {
  release(): Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

const PHASE_LABEL: Record<IntervalState['phase'], string> = {
  idle: 'Ready',
  prepare: 'Get ready',
  work: 'WORK',
  rest: 'Rest',
  done: 'Done!',
}

export function IntervalTimerModal({ onClose }: { onClose(): void }) {
  const [config, setConfig] = useState(() => clampConfig({}))
  const [state, setState] = useState<IntervalState>(IDLE_INTERVAL)
  const [paused, setPaused] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)

  useEffect(
    () => () => {
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    },
    [],
  )

  async function acquireWakeLock(): Promise<void> {
    try {
      const lock = (navigator as WakeLockNavigator).wakeLock
      wakeLockRef.current = (await lock?.request('screen')) ?? null
    } catch {
      /* denied or unsupported — the timer keeps working anyway */
    }
  }

  function releaseWakeLock(): void {
    void wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'done' || paused) return
    if (state.remaining <= 0) {
      const next = nextIntervalState(state, config)
      timerCue()
      setState(next)
      if (next.phase === 'done') releaseWakeLock()
      return
    }
    const timer = window.setTimeout(() => setState({ ...state, remaining: state.remaining - 1 }), 1000)
    return () => window.clearTimeout(timer)
  }, [state, paused, config])

  const running = state.phase !== 'idle' && state.phase !== 'done'

  function update(field: keyof typeof config, value: string) {
    setConfig((prev) => clampConfig({ ...prev, [field]: Number(value) || 0 }))
  }

  return (
    <Modal title="Interval timer" onClose={onClose}>
      {running || state.phase === 'done' ? (
        <>
          <div
            className={`interval-display interval-display--${state.phase === 'done' ? 'done' : state.phase}`}
            role="timer"
            aria-label={`${PHASE_LABEL[state.phase]}, ${formatDuration(state.remaining)} remaining, round ${state.round} of ${config.rounds}`}
          >
            <span className="interval-display__phase">{PHASE_LABEL[state.phase]}</span>
            <strong className="interval-display__time mono">
              {state.phase === 'done' ? '🎉' : formatDuration(state.remaining)}
            </strong>
            <span className="muted">
              Round {Math.min(state.round, config.rounds)} / {config.rounds}
            </span>
          </div>
          <div className="row row--wrap">
            {state.phase !== 'done' ? (
              <button
                type="button"
                className="btn"
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                releaseWakeLock()
                setPaused(false)
                setState(IDLE_INTERVAL)
              }}
            >
              Reset
            </button>
            {state.phase === 'done' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setState(startInterval(config))
                  setPaused(false)
                  void acquireWakeLock()
                }}
              >
                Go again
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="interval-prepare">Prepare (s)</label>
              <input
                id="interval-prepare"
                className="input"
                type="number"
                min={0}
                max={60}
                value={config.prepare}
                onChange={(e) => update('prepare', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="interval-rounds">Rounds</label>
              <input
                id="interval-rounds"
                className="input"
                type="number"
                min={1}
                max={50}
                value={config.rounds}
                onChange={(e) => update('rounds', e.target.value)}
              />
            </div>
          </div>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="interval-work">Work (s)</label>
              <input
                id="interval-work"
                className="input"
                type="number"
                min={5}
                max={3600}
                value={config.work}
                onChange={(e) => update('work', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="interval-rest">Rest (s)</label>
              <input
                id="interval-rest"
                className="input"
                type="number"
                min={0}
                max={3600}
                value={config.rest}
                onChange={(e) => update('rest', e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              setState(startInterval(config))
              setPaused(false)
              void acquireWakeLock()
            }}
          >
            Start intervals
          </button>
          <p className="muted" style={{ margin: '0.5rem 0 0' }}>
            {config.rounds} × {formatDuration(config.work)} work
            {config.rest > 0 ? ` / ${formatDuration(config.rest)} rest` : ''}
            {config.prepare > 0 ? `, ${formatDuration(config.prepare)} prepare` : ''}. Log the
            result manually in the set row.
          </p>
        </>
      )}
    </Modal>
  )
}
