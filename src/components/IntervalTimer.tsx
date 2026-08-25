// Interval / HIIT timer setup, full active display, and minimized timer dock.
import { useEffect, useState, type KeyboardEvent } from 'react'
import { Modal } from './ui'
import {
  IconMinus,
  IconPause,
  IconPlay,
  IconPlus,
  IconSkipForward,
  IconTimer,
} from './Icons'
import { clampConfig, type IntervalConfig, type IntervalPhase } from '../lib/intervals'
import type { IntervalTimerState } from '../lib/intervalTimer'
import { formatDuration } from '../lib/units'
import { useT } from '../lib/i18n'
import './intervalTimer.css'

interface IntervalActions {
  onPause(): void
  onResume(): void
  onSkipPhase(): void
  onReset(): void
}

interface IntervalTimerModalProps extends IntervalActions {
  state: IntervalTimerState
  initialConfig?: Partial<IntervalConfig>
  onClose(): void
  onStart(config: IntervalConfig): void
}

export function IntervalTimerModal({
  state,
  initialConfig,
  onClose,
  onStart,
  onPause,
  onResume,
  onSkipPhase,
  onReset,
}: IntervalTimerModalProps) {
  const { t } = useT()
  const [config, setConfig] = useState(() =>
    state.phase === 'idle' ? clampConfig(initialConfig ?? {}) : state.config,
  )
  const [confirmStop, setConfirmStop] = useState(false)
  const running = state.phase !== 'idle' && state.phase !== 'done'

  function update(field: keyof IntervalConfig, value: number) {
    setConfig((previous) => clampConfig({ ...previous, [field]: value }))
  }

  return (
    <Modal
      title={t('interval.title')}
      onClose={onClose}
      closeLabel={running ? t('interval.minimize') : undefined}
      className="interval-modal"
    >
      {running || state.phase === 'done' ? (
        <ActiveIntervalDisplay
          state={state}
          confirmStop={confirmStop}
          onConfirmStop={() => setConfirmStop(true)}
          onCancelStop={() => setConfirmStop(false)}
          onPause={onPause}
          onResume={onResume}
          onSkipPhase={onSkipPhase}
          onReset={() => {
            setConfig(state.config)
            setConfirmStop(false)
            onReset()
          }}
          onAgain={() => onStart(state.config)}
        />
      ) : (
        <div className="interval-setup">
          <div className="interval-stepper-grid">
            <TimerStepper
              id="interval-work"
              label={t('interval.work')}
              value={config.work}
              min={5}
              max={3600}
              step={5}
              onChange={(value) => update('work', value)}
            />
            <TimerStepper
              id="interval-rest"
              label={t('interval.rest')}
              value={config.rest}
              min={0}
              max={3600}
              step={5}
              onChange={(value) => update('rest', value)}
            />
            <TimerStepper
              id="interval-rounds"
              label={t('interval.rounds')}
              value={config.rounds}
              min={1}
              max={50}
              step={1}
              format="number"
              onChange={(value) => update('rounds', value)}
            />
            <TimerStepper
              id="interval-prepare"
              label={t('interval.prepare')}
              value={config.prepare}
              min={0}
              max={60}
              step={5}
              onChange={(value) => update('prepare', value)}
            />
          </div>
          <div className="interval-total">
            <span>{t('interval.totalDuration')}</span>
            <strong className="mono">{formatDuration(totalDuration(config))}</strong>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block interval-start"
            onClick={() => onStart(config)}
          >
            <IconPlay width={19} height={19} /> {t('interval.start')}
          </button>
        </div>
      )}
    </Modal>
  )
}

function ActiveIntervalDisplay({
  state,
  confirmStop,
  onConfirmStop,
  onCancelStop,
  onPause,
  onResume,
  onSkipPhase,
  onReset,
  onAgain,
}: IntervalActions & {
  state: IntervalTimerState
  confirmStop: boolean
  onConfirmStop(): void
  onCancelStop(): void
  onAgain(): void
}) {
  const { t } = useT()
  const labels = phaseLabels(t)
  const done = state.phase === 'done'
  const duration = phaseDuration(state)
  const progress = done || duration === 0
    ? 100
    : Math.max(0, Math.min(100, ((duration - state.remaining) / duration) * 100))
  const next = nextPhase(state)

  return (
    <div className="interval-active">
      <div
        className={`interval-display interval-display--${state.phase}${state.paused ? ' interval-display--paused' : ''}`}
        role="timer"
        aria-label={t('interval.remaining', {
          phase: labels[state.phase],
          time: formatDuration(state.remaining),
          round: state.round,
          rounds: state.config.rounds,
        })}
      >
        <div className="interval-display__eyebrow">
          <span className="interval-display__phase">
            {state.paused ? t('interval.paused') : labels[state.phase]}
          </span>
          {!done && next ? (
            <span className="interval-display__next">
              {t('interval.next', { phase: labels[next] })}
            </span>
          ) : null}
        </div>
        <strong className="interval-display__time mono">
          {done ? '✓' : formatDuration(state.remaining)}
        </strong>
        <span className="interval-display__round">
          {done
            ? t('interval.completedRounds', { rounds: state.config.rounds })
            : t('interval.roundOf', { round: state.round, rounds: state.config.rounds })}
        </span>
        <span className="interval-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
      </div>

      {done ? (
        <div className="interval-actions">
          <button type="button" className="btn btn--primary btn--block" onClick={onAgain}>
            <IconPlay width={19} height={19} /> {t('interval.again')}
          </button>
          <button type="button" className="btn btn--block" onClick={onReset}>
            {t('interval.changeSettings')}
          </button>
        </div>
      ) : confirmStop ? (
        <div className="interval-stop-confirm" role="alert">
          <strong>{t('interval.stopConfirm')}</strong>
          <div className="row">
            <button type="button" className="btn" onClick={onCancelStop}>
              {t('interval.keepGoing')}
            </button>
            <button type="button" className="btn btn--danger" onClick={onReset}>
              {t('interval.stop')}
            </button>
          </div>
        </div>
      ) : (
        <div className="interval-actions">
          <button
            type="button"
            className="btn btn--primary btn--block interval-pause"
            onClick={state.paused ? onResume : onPause}
          >
            {state.paused ? <IconPlay width={20} height={20} /> : <IconPause width={20} height={20} />}
            {state.paused ? t('interval.resume') : t('interval.pause')}
          </button>
          <div className="interval-secondary-actions">
            <button type="button" className="btn" onClick={onSkipPhase}>
              <IconSkipForward width={18} height={18} /> {t('interval.skipPhase')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onConfirmStop}>
              {t('interval.stop')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function IntervalTimerDock({
  state,
  onOpen,
  onPause,
  onResume,
  onSkipPhase,
}: Omit<IntervalActions, 'onReset'> & {
  state: IntervalTimerState
  onOpen(): void
}) {
  const { t } = useT()
  const labels = phaseLabels(t)
  const visiblePhase = state.paused ? t('interval.paused') : labels[state.phase]

  return (
    <div className={`timer-dock timer-dock--${state.phase}${state.paused ? ' timer-dock--paused' : ''}`}>
      <button
        type="button"
        className="timer-dock__main"
        onClick={onOpen}
        aria-label={t('interval.openRunning', {
          phase: visiblePhase,
          time: formatDuration(state.remaining),
          round: state.round,
          rounds: state.config.rounds,
        })}
      >
        <IconTimer width={22} height={22} />
        <span className="timer-dock__copy">
          <span className="timer-dock__label">{visiblePhase}</span>
          <span className="timer-dock__time mono">{formatDuration(state.remaining)}</span>
        </span>
        <span className="timer-dock__meta mono">{state.round}/{state.config.rounds}</span>
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={state.paused ? onResume : onPause}
        aria-label={state.paused ? t('interval.resume') : t('interval.pause')}
        title={state.paused ? t('interval.resume') : t('interval.pause')}
      >
        {state.paused ? <IconPlay width={19} height={19} /> : <IconPause width={19} height={19} />}
      </button>
      <button
        type="button"
        className="btn btn--icon"
        onClick={onSkipPhase}
        aria-label={t('interval.skipPhase')}
        title={t('interval.skipPhase')}
      >
        <IconSkipForward width={19} height={19} />
      </button>
    </div>
  )
}

function TimerStepper({
  id,
  label,
  value,
  min,
  max,
  step,
  format = 'duration',
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: 'duration' | 'number'
  onChange(value: number): void
}) {
  const { t } = useT()
  const render = (next: number) => format === 'duration' ? formatDuration(next) : String(next)
  const [draft, setDraft] = useState(() => render(value))

  useEffect(() => {
    setDraft(format === 'duration' ? formatDuration(value) : String(value))
  }, [value, format])

  function commitDraft() {
    const parsed = format === 'duration' ? parseDuration(draft) : Number(draft)
    if (parsed === null || !Number.isFinite(parsed)) {
      setDraft(render(value))
      return
    }
    const next = Math.max(min, Math.min(max, Math.round(parsed)))
    onChange(next)
    setDraft(render(next))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  return (
    <div className="timer-stepper">
      <label htmlFor={id}>{label}</label>
      <div className="timer-stepper__controls">
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label={t('interval.decrease', { field: label })}
        >
          <IconMinus width={18} height={18} />
        </button>
        <input
          id={id}
          className="input mono timer-stepper__input"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label={t('interval.increase', { field: label })}
        >
          <IconPlus width={18} height={18} />
        </button>
      </div>
    </div>
  )
}

function phaseLabels(t: ReturnType<typeof useT>['t']): Record<IntervalPhase, string> {
  return {
    idle: t('interval.ready'),
    prepare: t('interval.prepare'),
    work: t('interval.work'),
    rest: t('interval.rest'),
    done: t('interval.done'),
  }
}

function phaseDuration(state: IntervalTimerState): number {
  if (state.phase === 'prepare') return state.config.prepare
  if (state.phase === 'work') return state.config.work
  if (state.phase === 'rest') return state.config.rest
  return 0
}

function nextPhase(state: IntervalTimerState): IntervalPhase | null {
  if (state.phase === 'prepare') return 'work'
  if (state.phase === 'rest') return 'work'
  if (state.phase === 'work') {
    if (state.round >= state.config.rounds) return 'done'
    return state.config.rest > 0 ? 'rest' : 'work'
  }
  return null
}

function totalDuration(config: IntervalConfig): number {
  return config.prepare + config.rounds * config.work + Math.max(0, config.rounds - 1) * config.rest
}

function parseDuration(value: string): number | null {
  const normalized = value.trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)
  const parts = normalized.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null
  }
  const numbers = parts.map(Number)
  if (numbers.some((part, index) => index > 0 && part >= 60)) return null
  if (numbers.length === 2) return numbers[0] * 60 + numbers[1]
  return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
}
