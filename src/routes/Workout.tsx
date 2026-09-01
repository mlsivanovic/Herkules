// Active workout screen: elapsed timer, previous values, set logging for all
// measurement types, automatic rest timer, RPE, notes, reorder/swap/remove,
// finish (works fully offline — everything lands in IndexedDB + outbox).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore, newId } from '../lib/store'
import type { SessionDoc, SessionExerciseDoc, SetRow } from '../types/db'
import { blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import { distanceForInput, formatDuration, formatWeight, formatDistance, weightForInput } from '../lib/units'
import { formatSetLoad, isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import { formVideoUrl } from '../lib/video'
import { previousSetsForExercise } from '../lib/metrics'
import { moveIndex, sortByPosition, supersetPartners } from '../lib/reorder'
import { usePointerReorder } from '../lib/usePointerReorder'
import { EmptyState, Loader, Modal, NotesDisclosure } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'
import { IntervalTimerDock, IntervalTimerModal } from '../components/IntervalTimer'
import { isBlockRoundComplete, isSetGroupComplete, progressionSuggestions } from '../lib/prescription'
import { SetEditor, AddSetButton } from '../components/SetEditor'
import {
  IconGrip,
  IconChevronLeft,
  IconPlay,
  IconPlus,
  IconSun,
  IconSwap,
  IconTimer,
  IconTrash,
} from '../components/Icons'
import { useRestTimer } from '../lib/restTimer'
import { useIntervalTimer } from '../lib/intervalTimer'
import { useScreenWakeLock } from '../lib/wakeLock'
import { templatesGroupedByPlan } from '../lib/programs/catalog'
import { blockFormatLabel, displaySnapshotName, t as translate, useT, workoutRoleLabel } from '../lib/i18n'
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
  } = useRestTimer()
  const intervalTimer = useIntervalTimer()
  const [intervalsOpen, setIntervalsOpen] = useState(false)
  const [selectedIntervalBlockId, setSelectedIntervalBlockId] = useState<string | null>(null)

  const caps = capabilitiesFor(store.profile)
  const active = store.sessions.find((s) => s.status === 'in_progress') ?? null
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true)
  const { isLocked: wakeLocked, isSupported: wakeLockSupported } = useScreenWakeLock(
    wakeLockEnabled && active !== null,
  )
  const startingRef = useRef(false)
  const [announce, setAnnounce] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const activeId = active?.id
  const intervalBlock = active?.session_blocks?.find((block) => block.format === 'interval') ?? null
  const selectedIntervalBlock = active?.session_blocks?.find(
    (block) => block.id === selectedIntervalBlockId && block.format === 'interval',
  ) ?? intervalBlock
  const orderedExercises = useMemo(
    () => (active ? sortByPosition(active.session_exercises) : []),
    [active],
  )

  useEffect(() => {
    if (activeId) setCollapsedIds(readCollapsed(activeId))
  }, [activeId])

  useEffect(() => {
    if (intervalTimer.active && restRemaining !== null) skipRest()
  }, [intervalTimer.active, restRemaining, skipRest])

  const moveExercise = useCallback(
    (from: number, to: number) => {
      const session = store.sessions.find((s) => s.status === 'in_progress')
      if (!session) return
      const ids = moveIndex(
        sortByPosition(session.session_exercises).map((se) => se.id),
        from,
        to,
      )
      void store.reorderSessionExercises(session.id, ids)
    },
    [store],
  )

  const reorder = usePointerReorder({
    itemCount: orderedExercises.length,
    onMove: moveExercise,
    announce: setAnnounce,
  })

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

  const completedSets = countCompletedSets(active)

  return (
    <div className="workout-page">
      <header className="workout-header">
        <div className="workout-header__bar">
          <button type="button" className="btn btn--icon btn--ghost" aria-label={t('workout.back')} onClick={() => void navigate('/')}>
            <IconChevronLeft width={22} height={22} />
          </button>
          <h1 className="workout-title">{active.name}</h1>
          <button
            type="button"
            className="btn btn--small btn--primary workout-finish"
            onClick={() => setFinishOpen(true)}
          >
            {t('workout.finish')}
          </button>
        </div>
        <div className="workout-header__meta">
          <div className="workout-header__stats">
            <span className="workout-stat">
              <span className="workout-stat__value mono">
                <Elapsed startedAt={active.started_at} />
              </span>
              <span className="workout-stat__label">{t('workout.elapsed')}</span>
            </span>
            <span
              className="workout-stat"
              aria-label={t('workout.setsDone', { count: completedSets })}
            >
              <span className="workout-stat__value mono">{completedSets}</span>
              <span className="workout-stat__label" aria-hidden="true">
                {t('workout.setsLabel')}
              </span>
            </span>
          </div>
          <div className="workout-header__tools">
            {wakeLockSupported ? (
              <button
                type="button"
                className={`btn btn--icon btn--small ${wakeLocked ? 'btn--primary' : ''}`}
                aria-label={wakeLocked ? t('workout.wakeLockEnabled') : t('workout.wakeLockDisabled')}
                title={wakeLocked ? t('workout.wakeLockEnabled') : t('workout.wakeLockDisabled')}
                onClick={() => setWakeLockEnabled((prev) => !prev)}
              >
                <IconSun width={18} height={18} />
              </button>
            ) : null}
            <button
              type="button"
              className={`btn btn--icon btn--small ${intervalTimer.state.phase !== 'idle' ? 'btn--primary' : ''}`}
              aria-label={t('workout.intervalTimer')}
              title={t('workout.intervalTimer')}
              onClick={() => setIntervalsOpen(true)}
            >
              <IconTimer width={18} height={18} />
            </button>
            <button
              type="button"
              className="btn btn--icon btn--small btn--ghost workout-discard"
              aria-label={t('workout.discard')}
              title={t('workout.discard')}
              onClick={() => setDiscardOpen(true)}
            >
              <IconTrash width={18} height={18} />
            </button>
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
        <div className="stack">
          {orderedExercises.map((se, index) => {
            const block = active.session_blocks?.find((row) => row.id === se.session_block_id) ?? null
            const previous = index > 0 ? orderedExercises[index - 1] : null
            const showBlock = block && previous?.session_block_id !== block.id
            const collapsed = collapsedIds.has(se.id)
            return (
            <Fragment key={se.id}>
              {showBlock ? (
                <div className="workout-block-head">
                  <span className="badge badge--neutral">{workoutRoleLabel(block.role)}</span>
                  <strong>{blockFormatLabel(block.format)}</strong>
                  {block.format === 'circuit' ? (
                    <small className="muted">
                      {t('workout.circuitMeta', {
                        rounds: block.rounds_initial,
                        rest: block.rest_after_round_s ?? 0,
                      })}
                    </small>
                  ) : null}
                  {block.format === 'superset' ? (
                    <small className="muted">
                      {t('workout.supersetMeta', { rest: block.rest_after_round_s ?? 0 })}
                    </small>
                  ) : null}
                  {block.format === 'interval' ? (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => {
                        if (!intervalTimer.active && intervalTimer.state.phase === 'done') {
                          intervalTimer.reset()
                        }
                        setSelectedIntervalBlockId(block.id)
                        setIntervalsOpen(true)
                      }}
                    >
                      {t('workout.openTimer', {
                        rounds: block.interval_rounds ?? 0,
                        work: block.interval_work_s ?? 0,
                        rest: block.interval_recovery_s ?? 0,
                      })}
                    </button>
                  ) : null}
                  {block.notes ? <small className="muted">{block.notes}</small> : null}
                </div>
              ) : null}
              <ExerciseCard
              key={se.id}
              session={active}
              exercise={se}
              block={block}
              itemRef={reorder.setItemRef(index)}
              handleProps={reorder.getHandleProps(index)}
              gripProps={reorder.getHandleProps(index, { immediate: true })}
              onMoveBy={(delta) => reorder.moveBy(index, delta)}
              dragging={reorder.active?.from === index}
              dropTarget={
                reorder.active !== null &&
                reorder.active.over === index &&
                reorder.active.from !== index
              }
              expanded={!collapsed}
              reorderable={collapsed && caps.canRestructureWorkout}
              onToggleExpand={() => {
                if (!active) return
                setCollapsedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(se.id)) next.delete(se.id)
                  else next.add(se.id)
                  writeCollapsed(active.id, next)
                  return next
                })
              }}
              onSwap={caps.canRestructureWorkout ? () => setSwapTarget(se.id) : () => undefined}
              canRestructure={caps.canRestructureWorkout}
              onRestStart={(seconds) => {
                if (!intervalTimer.active) startRest(seconds)
              }}
            />
            </Fragment>
          )})}
          {caps.canRestructureWorkout ? (
          <button type="button" className="btn" onClick={() => setPickerMode('add')}>
            <IconPlus width={18} height={18} /> {t('workout.addExercise')}
          </button>
          ) : null}
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

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
          initialConfig={selectedIntervalBlock ? {
            prepare: selectedIntervalBlock.interval_prepare_s ?? 10,
            work: selectedIntervalBlock.interval_work_s ?? 30,
            rest: selectedIntervalBlock.interval_recovery_s ?? 60,
            rounds: selectedIntervalBlock.interval_rounds ?? selectedIntervalBlock.rounds_initial,
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
          onFinish={async (summary) => {
            setFinishError(null)
            setFinishBusy(true)
            try {
              await store.finishSession(active.id, summary)
              intervalTimer.reset()
              skipRest()
              void navigate(`/history/${active.id}`)
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
  const routineGroups = useMemo(
    () => templatesGroupedByPlan(visiblePlans, visibleTemplates, store.planRoutines),
    [visiblePlans, visibleTemplates, store.planRoutines],
  )

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
          <p className="muted">{caps.kind === 'light' ? t('workout.noAssigned') : t('workout.noRoutines')}</p>
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
                className="card exercise-card"
                disabled={busy}
                onClick={() => start({ templateId: template.id })}
              >
                <span className="row row--between">
                  <strong>{template.name}</strong>
                  <span className="badge badge--neutral">
                    {t('routines.exerciseCount', {
                      count: store.templateItems.filter((i) => i.template_id === template.id).length,
                    })}
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

function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  return <>{formatDuration(seconds)}</>
}

function collapsedStorageKey(sessionId: string): string {
  return `herkules:collapsed:${sessionId}`
}

function readCollapsed(sessionId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(collapsedStorageKey(sessionId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeCollapsed(sessionId: string, ids: Set<string>): void {
  try {
    sessionStorage.setItem(collapsedStorageKey(sessionId), JSON.stringify([...ids]))
  } catch {
    /* private mode / quota — collapse still works for this mount */
  }
}

function countCompletedSets(session: SessionDoc): number {
  return session.session_exercises.reduce(
    (sum, se) => sum + se.sets.filter((s) => s.completed_at !== null).length,
    0,
  )
}

function rangeLabel(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '—'
  if (min == null) return String(max)
  if (max == null || min === max) return String(min)
  return `${min}–${max}`
}

function prescriptionLabel(
  exercise: SessionExerciseDoc,
  units: 'metric' | 'imperial',
): string {
  const sets = exercise.planned_sets
  if (exercise.measurement_snapshot === 'weight_reps' || exercise.measurement_snapshot === 'reps') {
    const reps = rangeLabel(exercise.target_reps_min ?? exercise.target_reps, exercise.target_reps_max ?? exercise.target_reps)
    const bodyweightLoad = isBodyweightLoadExercise({
      id: exercise.exercise_id,
      name: exercise.name_snapshot,
    })
    const load =
      exercise.target_weight_kg != null
        ? ` @ ${formatSetLoad(exercise.target_weight_kg, units, bodyweightLoad)}`
        : bodyweightLoad
          ? ` @ ${formatSetLoad(null, units, true)}`
          : ''
    return `${sets} × ${reps} ${translate('set.reps')}${load}`
  }
  if (exercise.measurement_snapshot === 'duration' || exercise.measurement_snapshot === 'weight_duration') {
    const duration = rangeLabel(exercise.target_duration_min_s ?? exercise.target_duration_s, exercise.target_duration_max_s ?? exercise.target_duration_s)
    const load = exercise.target_weight_kg != null ? `${formatWeight(exercise.target_weight_kg, units)} × ` : ''
    return `${sets} × ${load}${duration}s`
  }
  const distance = rangeLabel(exercise.target_distance_min_m ?? exercise.target_distance_m, exercise.target_distance_max_m ?? exercise.target_distance_m)
  const load = exercise.measurement_snapshot === 'weight_distance' && exercise.target_weight_kg != null
    ? `${formatWeight(exercise.target_weight_kg, units)} × `
    : ''
  return `${sets} × ${load}${distance} m`
}

function ExerciseCard({
  session,
  exercise,
  block,
  itemRef,
  handleProps,
  gripProps,
  onMoveBy,
  dragging,
  dropTarget,
  expanded,
  reorderable,
  onToggleExpand,
  onSwap,
  onRestStart,
  canRestructure = true,
}: {
  session: SessionDoc
  exercise: SessionExerciseDoc
  block: NonNullable<SessionDoc['session_blocks']>[number] | null
  itemRef: (el: HTMLElement | null) => void
  handleProps: { onPointerDown(event: ReactPointerEvent<HTMLElement>): void }
  gripProps: { onPointerDown(event: ReactPointerEvent<HTMLElement>): void }
  onMoveBy(delta: number): void
  dragging: boolean
  dropTarget: boolean
  expanded: boolean
  reorderable: boolean
  onToggleExpand(): void
  onSwap(): void
  onRestStart(seconds: number): void
  canRestructure?: boolean
}) {
  const { t } = useT()
  const store = useStore()
  const units = store.profile?.unit_system ?? 'metric'
  const shownName = displaySnapshotName(exercise.name_snapshot, exercise.exercise_id)
  const [notesOpen, setNotesOpen] = useState(false)
  const catalogExercise = exercise.exercise_id
    ? store.exercises.find((row) => row.id === exercise.exercise_id)
    : null
  const catalogVideo = formVideoUrl(catalogExercise?.name ?? exercise.name_snapshot)
  const catalogSource = catalogExercise?.source_url ?? null

  const previous = useMemo(
    () =>
      previousSetsForExercise(
        store.sessions,
        exercise.exercise_id ?? '',
        exercise.name_snapshot,
        session.id,
      ),
    [store.sessions, exercise.exercise_id, exercise.name_snapshot, session.id],
  )

  function handleSetChange(next: SetRow) {
    void store.upsertSet(session.id, next)
  }

  function handleComplete(next: SetRow) {
    const wasCompleted = (exercise.sets.find((s) => s.id === next.id)?.completed_at ?? null) !== null
    void store.upsertSet(session.id, next)
    if (!wasCompleted && next.completed_at !== null && isSetGroupComplete(exercise.sets, next)) {
      if (block?.format === 'interval') return
      if (block?.format === 'circuit' || block?.format === 'superset') {
        const blockExercises = session.session_exercises.filter((row) => row.session_block_id === block.id)
        if (isBlockRoundComplete(blockExercises, next)) {
          const rest = block.rest_after_round_s ?? exercise.rest_seconds ?? store.profile?.default_rest_seconds ?? 90
          if (rest > 0) onRestStart(rest)
        }
        return
      }
      onRestStart(exercise.rest_seconds ?? store.profile?.default_rest_seconds ?? 90)
    }
  }

  const bodyweightLoad = isBodyweightLoadExercise({
    id: exercise.exercise_id,
    name: exercise.name_snapshot,
  })
  const exerciseIsWarmup = exercise.is_warmup === true || block?.role === 'warmup'

  function addSet(asWarmup = false) {
    if (asWarmup || exerciseIsWarmup) {
      void store.addWarmupSets(session.id, exercise.id, [{ weightKg: null, reps: null }])
      return
    }
    const position = exercise.sets.reduce((m, s) => Math.max(m, s.position), 0) + 1
    const set: SetRow = {
      id: newId(),
      session_exercise_id: exercise.id,
      position,
      weight_kg: null,
      reps: null,
      duration_s: null,
      distance_m: null,
      rpe: null,
      notes: null,
      is_warmup: false,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    void store.upsertSet(session.id, set)
  }

  const blockPartners = block?.format === 'superset'
    ? session.session_exercises
      .filter((row) => row.session_block_id === block.id && row.id !== exercise.id)
      .map((row) => displaySnapshotName(row.name_snapshot, row.exercise_id))
    : []
  const partners = blockPartners.length > 0 ? blockPartners : supersetPartners(
    session.session_exercises,
    exercise,
    (se) => displaySnapshotName(se.name_snapshot, se.exercise_id),
  )
  const logged = exercise.sets.some((set) => set.completed_at !== null)
  const role = normalizeBlockRole(exercise.block_role)

  return (
    <section
      ref={itemRef}
      className={`card workout-exercise exercise-card-item ${blockRoleClass(role)}${logged ? ' workout-exercise--logged' : ''}${expanded ? ' workout-exercise--expanded' : ' workout-exercise--collapsed'}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
    >
      <div className="exercise-head">
        <div className="exercise-head__drag" {...(reorderable ? handleProps : {})}>
          {reorderable ? (
            <button
              type="button"
              className="exercise-grip"
              aria-label={t('editor.reorder', { name: shownName })}
              {...gripProps}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || (event.altKey && event.key === 'ArrowUp')) {
                  event.preventDefault()
                  onMoveBy(-1)
                } else if (event.key === 'ArrowDown' || (event.altKey && event.key === 'ArrowDown')) {
                  event.preventDefault()
                  onMoveBy(1)
                }
              }}
            >
              <IconGrip width={16} height={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="exercise-head__toggle"
            aria-expanded={expanded}
            title={expanded ? t('workout.collapseToReorder', { name: shownName }) : undefined}
            onClick={onToggleExpand}
          >
            <strong className="exercise-head__title">{shownName}</strong>
          </button>
        </div>
        {catalogVideo ? (
          <a
            href={catalogVideo}
            target="_blank"
            rel="noreferrer noopener"
            className="form-link-icon"
            aria-label={t('editor.watchForm', { name: shownName })}
            title={t('editor.watchForm', { name: shownName })}
            onClick={(event) => event.stopPropagation()}
          >
            <span aria-hidden="true">▶️</span>
          </a>
        ) : null}
      </div>

      {partners.length > 0 ? (
        <div className="exercise-superset">
          <span className="badge badge--in-progress">{t('blockFormat.superset')}</span>
          <span className="exercise-superset__with">
            {t('workout.withPartners', { names: partners.join(', ') })}
          </span>
        </div>
      ) : null}

      <div className="row row--wrap workout-prescription">
        <span className="badge badge--neutral">{prescriptionLabel(exercise, units)}</span>
        {exercise.target_rpe_min != null || exercise.target_rpe_max != null ? (
          <span className="badge badge--neutral">RPE {rangeLabel(exercise.target_rpe_min, exercise.target_rpe_max)}</span>
        ) : null}
        {exercise.target_rir_min != null || exercise.target_rir_max != null ? (
          <span className="badge badge--neutral">RIR {rangeLabel(exercise.target_rir_min, exercise.target_rir_max)}</span>
        ) : null}
        {exercise.side_mode && exercise.side_mode !== 'bilateral' ? (
          <span className="badge badge--neutral">
            {exercise.side_mode === 'per_leg' ? t('workout.perLeg') : t('workout.perSide')}
          </span>
        ) : null}
        {exercise.tempo_intent === 'explosive' ? (
          <span className="badge badge--in-progress">{t('workout.explosive')}</span>
        ) : null}
        {exerciseIsWarmup ? <span className="badge badge--planned">{t('workout.warmup')}</span> : null}
        {block?.role === 'tendon' ? <span className="badge badge--planned">{t('workoutRole.tendon')}</span> : null}
        {catalogSource && catalogSource !== catalogVideo ? (
          <a
            href={catalogSource}
            target="_blank"
            rel="noreferrer noopener"
            className="form-link-icon"
            aria-label={t('editor.openGuide', { name: shownName })}
            title={t('editor.openGuide', { name: shownName })}
            onClick={(event) => event.stopPropagation()}
          >
            <span aria-hidden="true">📖</span>
          </a>
        ) : null}
      </div>

      {expanded ? (
        <>
      {exercise.notes ? (
        <NotesDisclosure
          label={t('workout.notes')}
          preview={exercise.notes}
          open={notesOpen}
          onToggle={() => setNotesOpen((open) => !open)}
          panelId={`workout-notes-${exercise.id}`}
        >
          <p>{exercise.notes}</p>
        </NotesDisclosure>
      ) : null}

      <div className="exercise-meta-row">
        {exercise.tempo ? (
          <span className="badge badge--neutral tempo-badge" title={t('workout.prescribedTempo')}>
            {t('editor.tempo')} {exercise.tempo}
          </span>
        ) : (
          <span />
        )}
        {canRestructure ? (
        <div className="row">
          <button
            type="button"
            className="btn btn--icon btn--small"
            data-no-drag
            aria-label={t('workout.swapNamed', { name: shownName })}
            onClick={onSwap}
          >
            <IconSwap width={16} height={16} />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--small btn--danger"
            data-no-drag
            aria-label={t('workout.removeFromWorkout', { name: shownName })}
            onClick={() => void store.removeSessionExercise(session.id, exercise.id)}
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
        ) : (
          <span />
        )}
      </div>

      {previous ? (
        <small className="muted">
          {t('workout.previous')}{' '}
          {previous
            .map((set) => {
              if (exercise.measurement_snapshot === 'weight_reps') {
                return `${formatSetLoad(set.weight_kg, units, bodyweightLoad)} × ${set.reps ?? '–'}`
              }
              if (exercise.measurement_snapshot === 'reps')
                return `${set.reps ?? '–'} ${t('set.reps')}`
              if (exercise.measurement_snapshot === 'duration')
                return formatDuration(set.duration_s ?? 0)
              if (exercise.measurement_snapshot === 'weight_duration')
                return `${formatWeight(set.weight_kg ?? 0, units)} × ${formatDuration(set.duration_s ?? 0)}`
              if (exercise.measurement_snapshot === 'weight_distance')
                return `${formatWeight(set.weight_kg ?? 0, units)} × ${formatDistance(set.distance_m ?? 0, units)}`
              return t('workout.distanceInTime', {
                distance: formatDistance(set.distance_m ?? 0, units),
                duration: formatDuration(set.duration_s ?? 0),
              })
            })
            .join(', ')}
        </small>
      ) : (
        <small className="muted">{t('workout.firstTime')}</small>
      )}

      <div className="stack" style={{ gap: '0.35rem' }}>
        {exercise.sets.map((set, setIndex) => (
          <SetEditor
            key={set.id}
            index={setIndex}
            set={set}
            measurement={exercise.measurement_snapshot}
            units={units}
            bodyweightLoad={bodyweightLoad}
            suggestion={{
              weight: weightForInput(exercise.target_weight_kg ?? previous?.[setIndex]?.weight_kg ?? null, units),
              reps: exercise.target_reps_min != null || exercise.target_reps_max != null
                ? rangeLabel(exercise.target_reps_min, exercise.target_reps_max)
                : previous?.[setIndex]?.reps != null ? String(previous[setIndex]?.reps) : '',
              duration: exercise.target_duration_min_s != null || exercise.target_duration_max_s != null
                ? `${rangeLabel(exercise.target_duration_min_s, exercise.target_duration_max_s)}s`
                : previous?.[setIndex]?.duration_s != null ? formatDuration(previous[setIndex]?.duration_s ?? 0) : '',
              distance: distanceForInput(exercise.target_distance_m ?? previous?.[setIndex]?.distance_m ?? null, units),
            }}
            onChange={handleSetChange}
            onComplete={handleComplete}
            onDelete={() => void store.deleteSet(session.id, exercise.id, set.id)}
          />
        ))}
        <div className="row row--wrap" style={{ gap: '0.4rem' }}>
          <AddSetButton onAdd={() => addSet(false)} />
          {exerciseIsWarmup ? null : (
            <AddSetButton onAdd={() => addSet(true)} label={t('set.addWarmup')} />
          )}
        </div>
        {exercise.planned_sets > exercise.sets.length ? (
          <small className="muted">
            {t('workout.morePlanned', {
              count: exercise.planned_sets - exercise.sets.length,
            })}
          </small>
        ) : null}
      </div>
        </>
      ) : null}

    </section>
  )
}

function FinishModal({
  session,
  busy,
  error,
  onClose,
  onFinish,
}: {
  session: SessionDoc
  busy: boolean
  error: string | null
  onClose(): void
  onFinish(summary: { notes: string | null; rpe: number | null }): Promise<void>
}) {
  const { t } = useT()
  const [notes, setNotes] = useState(session.notes ?? '')
  const [rpe, setRpe] = useState<string>(session.rpe === null ? '' : String(session.rpe))
  const completed = countCompletedSets(session)
  const suggestions = progressionSuggestions(session)
  const store = useStore()
  const [acceptProgression, setAcceptProgression] = useState(suggestions.length > 0)

  async function submit() {
    if (completed === 0 && !window.confirm(t('workout.finishEmpty'))) return
    if (acceptProgression) await store.applyProgressionSuggestions(session.id)
    await onFinish({
      notes: notes.trim() === '' ? null : notes.trim(),
      rpe: rpe === '' ? null : Number(rpe),
    })
  }

  return (
    <Modal title={t('workout.finishTitle')} onClose={onClose}>
      <div className="field">
        <label htmlFor="finish-notes">{t('workout.finishNotes')}</label>
        <textarea
          id="finish-notes"
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('workout.notesPlaceholder')}
        />
      </div>
      <div className="field">
        <label htmlFor="finish-rpe">{t('workout.sessionRpe')}</label>
        <select id="finish-rpe" className="input" value={rpe} onChange={(e) => setRpe(e.target.value)}>
          <option value="">{t('common.notSet')}</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        {t('workout.completedSummary', {
          count: completed,
          duration: formatDuration(elapsedOf(session)),
        })}
      </p>
      {suggestions.length > 0 ? (
        <label className="card row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={acceptProgression} onChange={(event) => setAcceptProgression(event.target.checked)} />
          <span>
            <strong>{t('workout.applyDouble')}</strong>
            <small className="muted" style={{ display: 'block' }}>
              {suggestions.map((row) => `${row.exerciseName}: ${row.fromWeightKg} → ${row.toWeightKg} kg`).join(' · ')}
            </small>
          </span>
        </label>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn--accent btn--block"
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? t('workout.finishing') : t('workout.finishConfirm')}
      </button>
    </Modal>
  )
}

function elapsedOf(session: SessionDoc): number {
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(session.started_at).getTime()) / 1000))
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
