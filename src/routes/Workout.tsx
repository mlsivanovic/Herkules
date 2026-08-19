// Active workout screen: elapsed timer, previous values, set logging for all
// measurement types, automatic rest timer, RPE, notes, reorder/swap/remove,
// finish (works fully offline — everything lands in IndexedDB + outbox).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore, newId } from '../lib/store'
import type { SessionDoc, SessionExerciseDoc, SetRow } from '../types/db'
import { blockRoleClass, normalizeBlockRole } from '../lib/blockRole'
import { formatDuration, formatWeight, formatDistance } from '../lib/units'
import { previousSetsForExercise } from '../lib/metrics'
import { timerCue } from '../lib/cues'
import { moveIndex, supersetPartners } from '../lib/reorder'
import { usePointerReorder } from '../lib/usePointerReorder'
import { EmptyState, Loader, Modal } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'
import { SetEditor, AddSetButton } from '../components/SetEditor'
import {
  IconGrip,
  IconPlay,
  IconPlus,
  IconSwap,
  IconTimer,
  IconTrash,
} from '../components/Icons'
import './workout.css'

interface StartState {
  templateId?: string | null
  scheduleItemId?: string | null
  plannedDate?: string | null
}

export function Workout() {
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
  const [restRemaining, setRestRemaining] = useState<number | null>(null)

  const active = store.sessions.find((s) => s.status === 'in_progress') ?? null
  const startingRef = useRef(false)
  const [announce, setAnnounce] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const activeId = active?.id

  useEffect(() => {
    if (activeId) setExpandedIds(readExpanded(activeId))
  }, [activeId])

  const moveExercise = useCallback(
    (from: number, to: number) => {
      const session = store.sessions.find((s) => s.status === 'in_progress')
      if (!session) return
      const ids = moveIndex(
        session.session_exercises.map((se) => se.id),
        from,
        to,
      )
      void store.reorderSessionExercises(session.id, ids)
    },
    [store],
  )

  const reorder = usePointerReorder({
    itemCount: active?.session_exercises.length ?? 0,
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
        setStartError(caught instanceof Error ? caught.message : 'Could not start the workout.')
      } finally {
        setBusy(false)
      }
    })()
    // Start only from the state carried by this navigation, on mount.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!store.ready) return <Loader />
  if (busy) return <Loader label="Preparing workout…" />

  if (!active) {
    return <StartScreen onStarted={() => navigate('/workout', { replace: true })} error={startError} />
  }

  return (
    <div className="workout-page">
      <header className="workout-header">
        <button type="button" className="btn btn--small" onClick={() => void navigate('/')}>
          ← Back
        </button>
        <div className="workout-title">
          <strong>{active.name}</strong>
          <span className="muted mono">
            <Elapsed startedAt={active.started_at} /> ·{' '}
            {countCompletedSets(active)} sets done
          </span>
        </div>
        <span className="row">
          <button
            type="button"
            className="btn btn--small"
            onClick={() => setDiscardOpen(true)}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn--small btn--accent"
            onClick={() => setFinishOpen(true)}
          >
            Finish
          </button>
        </span>
      </header>

      {active.session_exercises.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          hint="Add the first exercise to start logging."
          action={
            <button type="button" className="btn btn--primary" onClick={() => setPickerMode('add')}>
              <IconPlus width={18} height={18} /> Add exercise
            </button>
          }
        />
      ) : (
        <div className="stack">
          {active.session_exercises.map((se, index) => (
            <ExerciseCard
              key={se.id}
              session={active}
              exercise={se}
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
              expanded={expandedIds.has(se.id)}
              onToggleExpand={() => {
                if (!active) return
                setExpandedIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(se.id)) next.delete(se.id)
                  else next.add(se.id)
                  writeExpanded(active.id, next)
                  return next
                })
              }}
              onSwap={() => setSwapTarget(se.id)}
              onRestStart={(seconds) => setRestRemaining(seconds)}
            />
          ))}
          <button type="button" className="btn" onClick={() => setPickerMode('add')}>
            <IconPlus width={18} height={18} /> Add exercise
          </button>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announce}
      </span>

      {restRemaining !== null ? (
        <RestChip
          remaining={restRemaining}
          onTick={setRestRemaining}
          onDone={() => setRestRemaining(null)}
        />
      ) : null}

      {pickerMode === 'add' ? (
        <ExercisePicker
          title="Add exercise"
          onClose={() => setPickerMode(null)}
          onSelect={(exerciseId) => void store.addSessionExercise(active.id, exerciseId)}
        />
      ) : null}

      {swapTarget ? (
        <ExercisePicker
          title="Swap exercise"
          onClose={() => setSwapTarget(null)}
          onSelect={(exerciseId) =>
            void store.swapSessionExercise(active.id, swapTarget, exerciseId)
          }
        />
      ) : null}

      {discardOpen ? (
        <Modal title="Discard this workout?" onClose={() => setDiscardOpen(false)}>
          <p>
            Logged sets for <strong>{active.name}</strong> will be deleted. This cannot be undone.
          </p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                setDiscardOpen(false)
                void store.discardSession(active.id).then(() => navigate('/'))
              }}
            >
              Discard workout
            </button>
            <button type="button" className="btn btn--block" onClick={() => setDiscardOpen(false)}>
              Keep training
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
              void navigate(`/history/${active.id}`)
            } catch (caught) {
              setFinishError(
                caught instanceof Error ? caught.message : 'Could not finish the workout.',
              )
            } finally {
              setFinishBusy(false)
            }
          }}
        />
      ) : null}

      {conflict ? (
        <Modal title="Workout already in progress" onClose={() => setConflict(false)}>
          <p>
            You have an active workout (<strong>{active.name}</strong>). Only one workout can run at
            a time.
          </p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setConflict(false)
                navigate('/workout', { replace: true, state: null })
              }}
            >
              Resume current workout
            </button>
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void (async () => {
                  setStartError(null)
                  try {
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
                      caught instanceof Error ? caught.message : 'Could not start the workout.',
                    )
                  }
                  navigate('/workout', { replace: true, state: null })
                })()
              }}
            >
              Discard it and start the new one
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function StartScreen({ onStarted, error }: { onStarted(): void; error: string | null }) {
  const store = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const message = startError ?? error

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
        setStartError(caught instanceof Error ? caught.message : 'Could not start the workout.')
      })
  }

  return (
    <div className="workout-page">
      <header className="workout-header">
        <button type="button" className="btn btn--small" onClick={() => void navigate('/')}>
          ← Back
        </button>
        <div className="workout-title">
          <strong>Start a workout</strong>
        </div>
        <span aria-hidden="true" />
      </header>

      <div className="stack">
        {message ? (
          <p className="field-error" role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={() => start({})}
        >
          <IconPlay width={18} height={18} /> Empty workout
        </button>

        {store.templates.length > 0 ? (
          <>
            <div className="section-title">Start from a routine</div>
            {store.templates.map((template) => (
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
                    {store.templateItems.filter((i) => i.template_id === template.id).length}{' '}
                    exercises
                  </span>
                </span>
              </button>
            ))}
          </>
        ) : (
          <p className="muted">No routines yet — start empty or create one under Routines.</p>
        )}
      </div>
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

function expandedStorageKey(sessionId: string): string {
  return `herkules:expanded:${sessionId}`
}

function readExpanded(sessionId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(expandedStorageKey(sessionId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeExpanded(sessionId: string, ids: Set<string>): void {
  try {
    sessionStorage.setItem(expandedStorageKey(sessionId), JSON.stringify([...ids]))
  } catch {
    /* private mode / quota — expand still works for this mount */
  }
}

function countCompletedSets(session: SessionDoc): number {
  return session.session_exercises.reduce(
    (sum, se) => sum + se.sets.filter((s) => s.completed_at !== null).length,
    0,
  )
}

function ExerciseCard({
  session,
  exercise,
  itemRef,
  handleProps,
  gripProps,
  onMoveBy,
  dragging,
  dropTarget,
  expanded,
  onToggleExpand,
  onSwap,
  onRestStart,
}: {
  session: SessionDoc
  exercise: SessionExerciseDoc
  itemRef: (el: HTMLElement | null) => void
  handleProps: { onPointerDown(event: ReactPointerEvent<HTMLElement>): void }
  gripProps: { onPointerDown(event: ReactPointerEvent<HTMLElement>): void }
  onMoveBy(delta: number): void
  dragging: boolean
  dropTarget: boolean
  expanded: boolean
  onToggleExpand(): void
  onSwap(): void
  onRestStart(seconds: number): void
}) {
  const store = useStore()
  const units = store.profile?.unit_system ?? 'metric'
  const [notesOpen, setNotesOpen] = useState(false)
  const catalogVideo = exercise.exercise_id
    ? store.exercises.find((row) => row.id === exercise.exercise_id)?.video_url
    : null

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
    if (!wasCompleted && next.completed_at !== null) {
      onRestStart(exercise.rest_seconds ?? store.profile?.default_rest_seconds ?? 90)
    }
  }

  function addSet() {
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

  const partners = supersetPartners(
    session.session_exercises,
    exercise,
    (se) => se.name_snapshot,
  )
  const logged = exercise.sets.some((set) => set.completed_at !== null)
  const role = normalizeBlockRole(exercise.block_role)

  return (
    <section
      ref={itemRef}
      className={`card workout-exercise exercise-card-item ${blockRoleClass(role)}${logged ? ' workout-exercise--logged' : ''}${expanded ? ' workout-exercise--expanded' : ' workout-exercise--collapsed'}${dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
    >
      <div className="exercise-head">
        <div className="exercise-head__drag" {...handleProps}>
          <button
            type="button"
            className="exercise-grip"
            aria-label={`Reorder ${exercise.name_snapshot}`}
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
          <button
            type="button"
            className="exercise-head__toggle"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            <strong className="exercise-head__title">{exercise.name_snapshot}</strong>
          </button>
        </div>
        {catalogVideo ? (
          <a
            href={catalogVideo}
            target="_blank"
            rel="noreferrer noopener"
            className="form-chip"
            aria-label={`Form video for ${exercise.name_snapshot}`}
            onClick={(event) => event.stopPropagation()}
          >
            Form ↗
          </a>
        ) : null}
      </div>

      {partners.length > 0 ? (
        <div className="exercise-superset">
          <span className="badge badge--in-progress">Superset</span>
          <span className="exercise-superset__with">with {partners.join(', ')}</span>
        </div>
      ) : null}

      {expanded ? (
        <>
      <div className="exercise-meta-row">
        {exercise.notes ? (
          <button
            type="button"
            className="notes-chip"
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((open) => !open)}
          >
            Notes
          </button>
        ) : (
          <span />
        )}
        <div className="row">
          <button
            type="button"
            className="btn btn--icon btn--small"
            data-no-drag
            aria-label={`Swap ${exercise.name_snapshot} for another exercise`}
            onClick={onSwap}
          >
            <IconSwap width={16} height={16} />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--small btn--danger"
            data-no-drag
            aria-label={`Remove ${exercise.name_snapshot} from workout`}
            onClick={() => void store.removeSessionExercise(session.id, exercise.id)}
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      </div>

      {notesOpen && exercise.notes ? (
        <p className="workout-exercise-notes">{exercise.notes}</p>
      ) : null}

      {previous ? (
        <small className="muted">
          Previous:{' '}
          {previous
            .map((set) => {
              if (exercise.measurement_snapshot === 'weight_reps') {
                return `${formatWeight(set.weight_kg ?? 0, units)} × ${set.reps ?? '–'}`
              }
              if (exercise.measurement_snapshot === 'reps') return `${set.reps ?? '–'} reps`
              if (exercise.measurement_snapshot === 'duration')
                return formatDuration(set.duration_s ?? 0)
              return `${formatDistance(set.distance_m ?? 0, units)} in ${formatDuration(set.duration_s ?? 0)}`
            })
            .join(', ')}
        </small>
      ) : (
        <small className="muted">First time with this exercise — no history yet.</small>
      )}

      <div className="stack" style={{ gap: '0.35rem' }}>
        {exercise.sets.map((set, setIndex) => (
          <SetEditor
            key={set.id}
            index={setIndex}
            set={set}
            measurement={exercise.measurement_snapshot}
            units={units}
            onChange={handleSetChange}
            onComplete={handleComplete}
            onDelete={() => void store.deleteSet(session.id, exercise.id, set.id)}
          />
        ))}
        <AddSetButton onAdd={addSet} />
        {exercise.planned_sets > exercise.sets.length ? (
          <small className="muted">
            {exercise.planned_sets - exercise.sets.length} more set(s) planned
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
  const [notes, setNotes] = useState(session.notes ?? '')
  const [rpe, setRpe] = useState<string>(session.rpe === null ? '' : String(session.rpe))
  const completed = countCompletedSets(session)

  async function submit() {
    if (completed === 0 && !window.confirm('Finish without any completed sets?')) return
    await onFinish({
      notes: notes.trim() === '' ? null : notes.trim(),
      rpe: rpe === '' ? null : Number(rpe),
    })
  }

  return (
    <Modal title="Finish workout" onClose={onClose}>
      <div className="field">
        <label htmlFor="finish-notes">Workout notes</label>
        <textarea
          id="finish-notes"
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go?"
        />
      </div>
      <div className="field">
        <label htmlFor="finish-rpe">Session RPE (1–10)</label>
        <select id="finish-rpe" className="input" value={rpe} onChange={(e) => setRpe(e.target.value)}>
          <option value="">Not set</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        {completed} completed set(s). {formatDuration(elapsedOf(session))} total.
      </p>
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
        {busy ? 'Finishing…' : 'Finish workout'}
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
  onTick,
  onDone,
}: {
  remaining: number
  onTick(value: number): void
  onDone(): void
}) {
  useEffect(() => {
    if (remaining <= 0) {
      timerCue()
      onDone()
      return
    }
    const timer = window.setTimeout(() => onTick(remaining - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining, onTick, onDone])

  return (
    <div className="rest-chip" role="status">
      <IconTimer width={18} height={18} />
      <span className="mono">Rest {formatDuration(remaining)}</span>
      <button type="button" className="btn btn--small" onClick={() => onTick(remaining + 15)}>
        +15s
      </button>
      <button type="button" className="btn btn--small btn--ghost" onClick={onDone}>
        Skip
      </button>
    </div>
  )
}
