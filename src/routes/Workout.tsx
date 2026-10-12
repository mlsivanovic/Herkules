// Active workout screen: elapsed timer, previous values, set logging for all
// measurement types, automatic rest timer, RPE, notes, reorder/swap/remove,
// finish (works fully offline — everything lands in IndexedDB + outbox).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { SessionDoc } from '../types/db'
import { formatDuration } from '../lib/units'
import { BottomSheet, EmptyState, Loader, Modal } from '../components/ui'
import { WorkoutLogger } from '../components/WorkoutLogger'
import { sessionFlowProgress } from '../lib/workoutFlow'
import { diagnoseSessionDuration, sessionDurationSeconds } from '../lib/sessionDuration'
import { ExercisePicker } from '../components/ExercisePicker'
import { IntervalTimerDock, IntervalTimerModal } from '../components/IntervalTimer'
import { progressionSuggestions } from '../lib/prescription'
import {
  IconChevronLeft,
  IconPlay,
  IconPlus,
  IconSun,
  IconTimer,
  IconTrash,
} from '../components/Icons'
import { useRestTimer } from '../lib/restTimer'
import { useIntervalTimer } from '../lib/intervalTimer'
import { useScreenWakeLock } from '../lib/wakeLock'
import { templatesGroupedByPlan } from '../lib/programs/catalog'
import { workoutSequenceSuggestion } from '../lib/programs/plans'
import { useT } from '../lib/i18n'
import { capabilitiesFor, startableProgrammingForAccount } from '../lib/capabilities'
import './workout.css'

interface StartState {
  templateId?: string | null
  scheduleItemId?: string | null
  plannedDate?: string | null
}

export function Workout() {
  const { t } = useT()
  const store = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const startState = (location.state ?? null) as StartState | null

  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [pickerMode, setPickerMode] = useState<'add' | null>(null)
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [finishBusy, setFinishBusy] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const {
    remaining: restRemaining,
    start: startRest,
    addSeconds: addRestSeconds,
    skip: skipRest,
    cancelIfSource: cancelRestSource,
  } = useRestTimer()
  const intervalTimer = useIntervalTimer()
  const [intervalsOpen, setIntervalsOpen] = useState(false)

  const caps = capabilitiesFor(store.profile)
  const active = store.sessions.find((s) => s.status === 'in_progress') ?? null
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true)
  const { isLocked: wakeLocked, isSupported: wakeLockSupported } = useScreenWakeLock(
    wakeLockEnabled && active !== null,
  )
  const startingRef = useRef(false)
  const [focusToken, setFocusToken] = useState(0)
  const dockRef = useRef<HTMLDivElement>(null)
  const intervalBlock = active?.session_blocks?.find((block) => block.format === 'interval') ?? null
  const progress = active ? sessionFlowProgress(active) : null

  useEffect(() => {
    if (intervalTimer.active && restRemaining !== null) skipRest()
  }, [intervalTimer.active, restRemaining, skipRest])

  useEffect(() => {
    const node = dockRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const apply = () => {
      document.documentElement.style.setProperty('--workout-dock-h', `${node.offsetHeight}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty('--workout-dock-h', '0px')
    }
  }, [restRemaining, intervalTimer.active, active?.id])

  useEffect(() => {
    if (!startState || startingRef.current) return
    startingRef.current = true
    if (active) {
      setConflict(true)
      return
    }
    void (async () => {
      setBusy(true)
      setStartError(null)
      try {
        await store.startSession({
          templateId: startState.templateId ?? null,
          scheduleItemId: startState.scheduleItemId ?? null,
          plannedDate: startState.plannedDate ?? null,
        })
        navigate('/workout', { replace: true })
      } catch (caught) {
        setStartError(caught instanceof Error ? caught.message : t('errors.startWorkout'))
      } finally {
        setBusy(false)
      }
    })()
    // Start only from the state carried by this navigation, on mount.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!store.ready) return <Loader />
  if (busy) return <Loader label={t('workout.preparing')} />

  if (!active) {
    return <StartScreen onStarted={() => navigate('/workout', { replace: true })} error={startError} />
  }

  const workDone = progress?.workDone ?? 0
  const workTotal = progress?.workTotal ?? 0
  const finishReady = workTotal > 0 && workDone >= workTotal

  return (
    <div className="workout-page">
      <header className="workout-header">
        <div className="workout-header__bar">
          <button type="button" className="btn btn--icon btn--ghost" aria-label={t('workout.back')} onClick={() => void navigate('/')}>
            <IconChevronLeft width={22} height={22} />
          </button>
          <h1 className="workout-title">{active.name}</h1>
          <div className="workout-header__end">
            <button
              type="button"
              className="btn btn--icon btn--danger workout-discard"
              aria-label={t('workout.discard')}
              title={t('workout.discard')}
              onClick={() => setDiscardOpen(true)}
            >
              <IconTrash width={22} height={22} />
            </button>
            <button
              type="button"
              className={`btn workout-finish${finishReady ? ' btn--primary' : ''}`}
              onClick={() => setFinishOpen(true)}
            >
              {t('workout.finish')}
            </button>
          </div>
        </div>
        <div className="workout-header__meta">
          <div className="workout-header__stats">
            <span className="workout-stat">
              <span className="workout-stat__value mono">
                <Elapsed startedAt={active.started_at} />
              </span>
              <span className="workout-stat__label">{t('workout.elapsed')}</span>
            </span>
            <span className="workout-stat" aria-label={t('workout.workProgress', { done: workDone, total: workTotal })}>
              <span className="workout-stat__value mono">{workDone}/{workTotal}</span>
              <span className="workout-stat__label" aria-hidden="true">{t('workout.setsLabel')}</span>
            </span>
          </div>
          <div className="workout-header__tools">
            {wakeLockSupported ? (
              <button
                type="button"
                className={`btn btn--icon workout-tool${wakeLockEnabled ? ' is-on' : ''}`}
                aria-pressed={wakeLockEnabled}
                aria-label={wakeLocked ? t('workout.wakeLockEnabled') : t('workout.wakeLockDisabled')}
                title={wakeLocked ? t('workout.wakeLockEnabled') : t('workout.wakeLockDisabled')}
                onClick={() => setWakeLockEnabled((prev) => !prev)}
              >
                <IconSun width={26} height={26} />
              </button>
            ) : null}
            <button
              type="button"
              className={`btn btn--icon workout-tool${intervalTimer.active ? ' is-on' : ''}`}
              aria-label={t('workout.intervalTimer')}
              title={t('workout.intervalTimer')}
              onClick={() => setIntervalsOpen(true)}
            >
              <IconTimer width={26} height={26} />
            </button>
            {caps.canRestructureWorkout ? (
              <button type="button" className="btn workout-header__add" onClick={() => setPickerMode('add')}>
                <IconPlus width={18} height={18} /> {t('workout.addExercise')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {active.session_exercises.length === 0 ? (
        <EmptyState
          title={t('workout.noExercisesTitle')}
          hint={t('workout.noExercisesHint')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setPickerMode('add')}>
              <IconPlus width={18} height={18} /> {t('workout.addExercise')}
            </button>
          }
        />
      ) : (
        <WorkoutLogger
          session={active}
          userId={store.profile?.id ?? ''}
          canRestructure={caps.canRestructureWorkout}
          intervalActive={intervalTimer.active}
          defaultRestSeconds={store.profile?.default_rest_seconds ?? 90}
          onRest={(seconds, sourceId) => {
            if (!intervalTimer.active) startRest(seconds, { sourceId, manual: false })
          }}
          onCancelRestSource={cancelRestSource}
          onSwap={(exerciseId) => setSwapTarget(exerciseId)}
          focusToken={focusToken}
        />
      )}

      <div ref={dockRef} className="workout-dock-slot">
        {intervalTimer.active && !intervalsOpen ? (
          <IntervalTimerDock
            state={intervalTimer.state}
            onOpen={() => setIntervalsOpen(true)}
            onPause={intervalTimer.pause}
            onResume={intervalTimer.resume}
            onSkipPhase={intervalTimer.skipPhase}
          />
        ) : restRemaining !== null ? (
          <RestChip
            remaining={restRemaining}
            onAdd15={() => addRestSeconds(15)}
            onSkip={skipRest}
          />
        ) : null}
      </div>

      {intervalsOpen ? (
        <IntervalTimerModal
          state={intervalTimer.state}
          onClose={() => setIntervalsOpen(false)}
          onStart={(config) => {
            if (restRemaining !== null) skipRest()
            intervalTimer.start(config)
          }}
          onPause={intervalTimer.pause}
          onResume={intervalTimer.resume}
          onSkipPhase={intervalTimer.skipPhase}
          onReset={intervalTimer.reset}
          initialConfig={intervalBlock ? {
            prepare: intervalBlock.interval_prepare_s ?? 10,
            work: intervalBlock.interval_work_s ?? 30,
            rest: intervalBlock.interval_recovery_s ?? 60,
            rounds: intervalBlock.interval_rounds ?? intervalBlock.rounds_initial,
          } : undefined}
        />
      ) : null}

      {pickerMode === 'add' ? (
        <ExercisePicker
          title={t('workout.addExercise')}
          onClose={() => setPickerMode(null)}
          onSelect={(exerciseId) => void store.addSessionExercise(active.id, exerciseId)}
        />
      ) : null}

      {swapTarget ? (
        <ExercisePicker
          title={t('workout.swapExercise')}
          onClose={() => setSwapTarget(null)}
          onSelect={(exerciseId) =>
            void store.swapSessionExercise(active.id, swapTarget, exerciseId)
          }
        />
      ) : null}

      {discardOpen ? (
        <Modal title={t('workout.discardTitle')} onClose={() => setDiscardOpen(false)}>
          <p>{t('workout.discardBody', { name: active.name })}</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                setDiscardOpen(false)
                intervalTimer.reset()
                skipRest()
                void store.discardSession(active.id).then(() => navigate('/'))
              }}
            >
              {t('workout.discardConfirm')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setDiscardOpen(false)}>
              {t('workout.keepTraining')}
            </button>
          </div>
        </Modal>
      ) : null}

      {finishOpen ? (
        <FinishModal
          session={active}
          busy={finishBusy}
          error={finishError}
          onClose={() => {
            setFinishOpen(false)
            setFinishError(null)
          }}
          onBackToNext={() => {
            setFinishOpen(false)
            setFinishError(null)
            setFocusToken((token) => token + 1)
          }}
          onFinish={async (summary) => {
            setFinishError(null)
            setFinishBusy(true)
            try {
              await store.finishSession(active.id, summary)
              intervalTimer.reset()
              skipRest()
              // Replace the finish sheet's history entry so Back does not return to it.
              void navigate(`/history/${active.id}`, { replace: true })
            } catch (caught) {
              setFinishError(
                caught instanceof Error ? caught.message : t('errors.finishWorkout'),
              )
            } finally {
              setFinishBusy(false)
            }
          }}
        />
      ) : null}

      {conflict ? (
        <Modal title={t('workout.conflictTitle')} onClose={() => setConflict(false)}>
          <p>{t('workout.conflictBody', { name: active.name })}</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setConflict(false)
                navigate('/workout', { replace: true, state: null })
              }}
            >
              {t('workout.resume')}
            </button>
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void (async () => {
                  setStartError(null)
                  try {
                    intervalTimer.reset()
                    skipRest()
                    await store.discardSession(active.id)
                    setConflict(false)
                    await store.startSession({
                      templateId: startState?.templateId ?? null,
                      scheduleItemId: startState?.scheduleItemId ?? null,
                      plannedDate: startState?.plannedDate ?? null,
                    })
                  } catch (caught) {
                    setConflict(false)
                    setStartError(
                      caught instanceof Error ? caught.message : t('errors.startWorkout'),
                    )
                  }
                  navigate('/workout', { replace: true, state: null })
                })()
              }}
            >
              {t('workout.discardStartNew')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function StartScreen({ onStarted, error }: { onStarted(): void; error: string | null }) {
  const { t } = useT()
  const store = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const message = startError ?? error
  const caps = capabilitiesFor(store.profile)
  const { plans: visiblePlans, templates: visibleTemplates } = useMemo(
    () => startableProgrammingForAccount(store.plans, store.templates, store.profile),
    [store.plans, store.templates, store.profile],
  )
  const sequence = useMemo(
    () => workoutSequenceSuggestion(visibleTemplates, store.sessions, store.planRoutines),
    [store.planRoutines, store.sessions, visibleTemplates],
  )
  const routineGroups = useMemo(() => {
    const nextId = sequence.nextTemplate?.id
    return templatesGroupedByPlan(visiblePlans, visibleTemplates, store.planRoutines)
      .map((group) => ({
        ...group,
        templates: [...group.templates].sort(
          (a, b) => Number(b.id === nextId) - Number(a.id === nextId),
        ),
      }))
      .sort(
        (a, b) =>
          Number(b.templates.some((template) => template.id === nextId)) -
          Number(a.templates.some((template) => template.id === nextId)),
      )
  }, [sequence.nextTemplate?.id, store.planRoutines, visiblePlans, visibleTemplates])

  function start(input: Parameters<typeof store.startSession>[0]) {
    setBusy(true)
    setStartError(null)
    void store
      .startSession(input)
      .then(() => {
        setBusy(false)
        onStarted()
      })
      .catch((caught: unknown) => {
        setBusy(false)
        setStartError(caught instanceof Error ? caught.message : t('errors.startWorkout'))
      })
  }

  return (
    <div className="workout-page">
      <header className="workout-header">
        <div className="workout-header__bar">
          <button type="button" className="btn btn--small" onClick={() => void navigate('/')}>
            {t('workout.back')}
          </button>
          <h1 className="workout-title">{t('workout.startTitle')}</h1>
        </div>
      </header>

      <div className="stack">
        {message ? (
          <p className="field-error" role="alert">
            {message}
          </p>
        ) : null}
        {sequence.lastSession ? (
          <div className="card workout-start-sequence">
            <span>
              <small>{t('startSheet.lastWorkout')}</small>
              <strong>{sequence.lastSession.name}</strong>
            </span>
            {sequence.nextTemplate ? (
              <span>
                <small>{t('startSheet.nextInSequence')}</small>
                <strong>{sequence.nextTemplate.name}</strong>
              </span>
            ) : null}
          </div>
        ) : null}
        {caps.canStartEmptyWorkout ? (
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => start({})}
          >
            <IconPlay width={18} height={18} /> {t('workout.emptyWorkout')}
          </button>
        ) : null}
        {routineGroups.length === 0 ? (
          <p className="muted">
            {caps.kind === 'light' ? t('workout.noAssigned') : t('workout.noRoutines')}
          </p>
        ) : null}
      </div>

      {routineGroups.map((group) => (
        <Fragment key={group.plan?.id ?? 'unassigned'}>
          <div className="section-title">
            {group.plan
              ? group.plan.name
              : routineGroups.length === 1
                ? t('workout.fromRoutine')
                : t('routines.unassigned')}
          </div>
          <div className="stack">
            {group.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`card exercise-card workout-start-routine${
                  template.id === sequence.nextTemplate?.id
                    ? ' workout-start-routine--recommended'
                    : ''
                }`}
                disabled={busy}
                onClick={() => start({ templateId: template.id })}
              >
                <span className="row row--between">
                  <strong>{template.name}</strong>
                  <span className="row row--wrap workout-start-routine__badges">
                    {template.id === sequence.nextTemplate?.id ? (
                      <span className="badge badge--in-progress">
                        {t('startSheet.nextInSequence')}
                      </span>
                    ) : null}
                    <span className="badge badge--neutral">
                      {t('routines.exerciseCount', {
                        count: store.templateItems.filter((i) => i.template_id === template.id).length,
                      })}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

// Keeps ticking while the workout is open, including rest between sets.
// The length saved on finish stops at the last logged set.
function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  return <>{formatDuration(seconds)}</>
}

function FinishModal({
  session,
  busy,
  error,
  onClose,
  onBackToNext,
  onFinish,
}: {
  session: SessionDoc
  busy: boolean
  error: string | null
  onClose(): void
  onBackToNext(): void
  onFinish(summary: { notes: string | null; rpe: number | null }): Promise<void>
}) {
  const { t } = useT()
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [rpe, setRpe] = useState<string>(session.rpe === null ? '' : String(session.rpe))
  const progress = sessionFlowProgress(session)
  const suggestions = progressionSuggestions(session)
  const store = useStore()
  const [acceptProgression, setAcceptProgression] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const diagnosis = diagnoseSessionDuration(session)
  const nothingLogged = progress.workDone === 0 && progress.warmupDone === 0

  async function submit() {
    if (nothingLogged && !confirmEmpty) {
      setConfirmEmpty(true)
      return
    }
    if (acceptProgression) await store.applyProgressionSuggestions(session.id)
    await onFinish({
      notes: notes.trim() === '' ? null : notes.trim(),
      rpe: rpe === '' ? null : Number(rpe),
    })
  }

  return (
    <BottomSheet title={t('workout.finishTitle')} onClose={onClose}>
      <p className="workout-finish-summary">
        {t('workout.finishWorkDone', { done: progress.workDone, total: progress.workTotal })}
      </p>
      {progress.workTotal > progress.workDone ? (
        <p>{t('workout.finishWorkLeft', { count: progress.workTotal - progress.workDone })}</p>
      ) : null}
      <p>{t('workout.finishWarmup', { done: progress.warmupDone, total: progress.warmupTotal })}</p>
      <p className="muted">{formatDuration(elapsedOf(session))}</p>
      {diagnosis.unusuallyLong ? <p className="muted">{t('workout.longSession')}</p> : null}
      {confirmEmpty ? <p role="alert">{t('workout.finishEmptyBody')}</p> : null}
      <button type="button" className="btn btn--block" onClick={onBackToNext}>
        {t('workout.finishBack')}
      </button>
      <button type="button" className="notes-toggle" aria-expanded={notesOpen} onClick={() => setNotesOpen((open) => !open)}>
        {t('workout.finishNotes')} · {t('workout.sessionRpe')}
      </button>
      {notesOpen ? (
        <>
          <div className="field">
            <label htmlFor="finish-notes">{t('workout.finishNotes')}</label>
            <textarea
              id="finish-notes"
              className="input"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('workout.notesPlaceholder')}
            />
          </div>
          <div className="field">
            <label htmlFor="finish-rpe">{t('workout.sessionRpe')}</label>
            <select id="finish-rpe" className="input" value={rpe} onChange={(event) => setRpe(event.target.value)}>
              <option value="">{t('common.notSet')}</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      {suggestions.length > 0 ? (
        <label className="card row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={acceptProgression} onChange={(event) => setAcceptProgression(event.target.checked)} />
          <span>
            {t('workout.progressionPrompt', {
              change: suggestions.map((row) => t('workout.progressionChange', {
                name: row.exerciseName,
                from: row.fromWeightKg,
                to: row.toWeightKg,
              })).join(' · '),
            })}
          </span>
        </label>
      ) : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--accent btn--block" disabled={busy} onClick={() => void submit()}>
        {busy ? t('workout.finishing') : nothingLogged ? t('workout.finishAnyway') : t('workout.finishConfirm')}
      </button>
    </BottomSheet>
  )
}

function elapsedOf(session: SessionDoc): number {
  return sessionDurationSeconds(session, Date.now()) ?? 0
}

function RestChip({
  remaining,
  onAdd15,
  onSkip,
}: {
  remaining: number
  onAdd15(): void
  onSkip(): void
}) {
  const { t } = useT()

  return (
    <div
      className="timer-dock timer-dock--rest"
      role="status"
      aria-label={t('workout.rest', { time: formatDuration(remaining) })}
    >
      <span className="timer-dock__main timer-dock__main--static">
        <IconTimer width={22} height={22} />
        <span className="timer-dock__copy">
          <span className="timer-dock__label">{t('workout.restLabel')}</span>
          <span className="timer-dock__time mono">{formatDuration(remaining)}</span>
        </span>
      </span>
      <button type="button" className="btn" onClick={onAdd15}>
        {t('common.plus15')}
      </button>
      <button type="button" className="btn btn--ghost" onClick={onSkip}>
        {t('common.skip')}
      </button>
    </div>
  )
}
