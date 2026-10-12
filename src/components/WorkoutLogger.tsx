// Focused logger for the active session. One station at a time, same set rows
// and the same store writes as the rest of the app.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionDoc, SessionExerciseDoc, SetRow } from '../types/db'
import { isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import { newId, useStore } from '../lib/store'
import { formatLoggedSet } from '../lib/setDisplay'
import { formVideoUrl } from '../lib/video'
import {
  concreteTarget,
  findPreviousPerformance,
  matchPreviousSet,
  pickPreparedValue,
  setGroupOrdinal,
} from '../lib/metrics'
import {
  advanceAfterConfirm,
  flowFromSession,
  flowMembers,
  peekAdvance,
  resolveFocus,
  sessionProgress,
  stationChips,
  type FlowFocus,
} from '../lib/workoutFlow'
import {
  readSetDrafts,
  readWorkoutFocus,
  writeSetDraft,
  writeWorkoutFocus,
} from '../lib/workoutUiState'
import type { SetDraftInput } from '../lib/validation'
import {
  distanceForInput,
  formatDuration,
  formatWeight,
  weightForInput,
} from '../lib/units'
import { blockFormatLabel, displaySnapshotName, useT } from '../lib/i18n'
import { SetEditor, AddSetButton, type SetSuggestion } from './SetEditor'
import { BottomSheet, Modal, NotesDisclosure } from './ui'
import { IconSwap, IconTrash } from './Icons'

const MANY_SETS = 6

function rangeLabel(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return ''
  if (min == null) return String(max)
  if (max == null || min === max) return String(min)
  return `${min}–${max}`
}

function prescriptionLine(exercise: SessionExerciseDoc, units: 'metric' | 'imperial'): string {
  const reps = rangeLabel(exercise.target_reps_min ?? exercise.target_reps, exercise.target_reps_max ?? exercise.target_reps)
  const weight = exercise.uses_backup || exercise.target_weight_kg == null
    ? ''
    : formatWeight(exercise.target_weight_kg, units)
  const bits = [`${exercise.planned_sets}×`]
  if (weight) bits.push(weight)
  if (reps) bits.push(reps)
  if (exercise.target_rir_min != null || exercise.target_rir_max != null) {
    bits.push(`RIR ${rangeLabel(exercise.target_rir_min, exercise.target_rir_max)}`)
  }
  return bits.join(' ')
}

function draftFromLogged(set: SetRow, units: 'metric' | 'imperial', bodyweight: boolean): SetDraftInput {
  const bw = set.weight_kg === 0 || (bodyweight && set.weight_kg == null)
  return {
    weight: bw ? '' : weightForInput(set.weight_kg, units),
    bodyweight: bw,
    reps: set.reps == null ? '' : String(set.reps),
    duration: set.duration_s == null ? '' : formatDuration(set.duration_s),
    distance: distanceForInput(set.distance_m, units),
    rpe: set.rpe == null ? '' : String(set.rpe),
  }
}

export function WorkoutLogger({
  session,
  userId,
  canRestructure,
  intervalActive,
  defaultRestSeconds,
  onRest,
  onCancelRestSource,
  onSwap,
  focusToken = 0,
}: {
  session: SessionDoc
  userId: string
  canRestructure: boolean
  intervalActive: boolean
  defaultRestSeconds: number
  onRest(seconds: number, sourceId: string): void
  onCancelRestSource(sourceId: string): boolean
  onSwap(exerciseId: string): void
  focusToken?: number
}) {
  const { t } = useT()
  const store = useStore()
  const units = store.profile?.unit_system ?? 'metric'
  const flow = useMemo(() => flowFromSession(session), [session])
  const progress = useMemo(
    () => sessionProgress(flow.exercises, flow.blocks),
    [flow.blocks, flow.exercises],
  )
  const focusRef = useRef<FlowFocus | null>(readWorkoutFocus(userId, session.id))
  const [focus, setFocus] = useState<FlowFocus | null>(focusRef.current)
  const [overview, setOverview] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [offerId, setOfferId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, SetDraftInput>>(() => readSetDrafts(userId, session.id))
  const [draftVersion, setDraftVersion] = useState(0)
  const [externalDraft, setExternalDraft] = useState<SetDraftInput | null>(null)
  const [undo, setUndo] = useState<{ before: SetRow; sourceId: string | null; name: string; n: number } | null>(null)

  useEffect(() => {
    const preferred = focusRef.current ?? readWorkoutFocus(userId, session.id)
    const next = resolveFocus(flow.exercises, preferred)
    focusRef.current = next
    setFocus((current) => {
      if (current?.exerciseId === next?.exerciseId && current?.setId === next?.setId) return current
      return next
    })
    if (next && userId) writeWorkoutFocus(userId, session.id, next)
  }, [flow.exercises, session.id, userId])

  const seenFocusToken = useRef(focusToken)
  useEffect(() => {
    if (!focusToken || focusToken === seenFocusToken.current) return
    seenFocusToken.current = focusToken
    const next = resolveFocus(flow.exercises, null)
    focusRef.current = next
    setFocus(next)
    if (next && userId) writeWorkoutFocus(userId, session.id, next)
  }, [focusToken, flow.exercises, session.id, userId])

  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), 8000)
    return () => window.clearTimeout(timer)
  }, [undo])

  function choose(next: FlowFocus | null) {
    focusRef.current = next
    setFocus(next)
    setOfferId(null)
    if (next && userId) writeWorkoutFocus(userId, session.id, next)
  }

  const ordered = [...session.session_exercises].sort((a, b) => a.position - b.position)
  const exercise = ordered.find((row) => row.id === focus?.exerciseId) ?? ordered[0] ?? null
  const exerciseIndex = exercise ? ordered.findIndex((row) => row.id === exercise.id) : -1
  const block = exercise
    ? session.session_blocks?.find((row) => row.id === exercise.session_block_id) ?? null
    : null
  const flowExercise = flow.exercises.find((row) => row.id === exercise?.id) ?? null
  const members = flowExercise ? flowMembers(flowExercise, flow.exercises, flow.blocks) : []
  const activeSet = exercise?.sets.find((row) => row.id === focus?.setId) ?? null
  const roundLabel = block && (block.format === 'superset' || block.format === 'circuit') && activeSet?.round_index
    ? t(block.format === 'circuit' ? 'workout.circuitRound' : 'workout.supersetRound', {
        current: activeSet.round_index,
        total: progress.blocks.find((row) => row.blockId === block.id)?.roundsTotal || block.rounds_initial,
      })
    : null

  function rememberDraft(setId: string, draft: SetDraftInput) {
    setDrafts((current) => ({ ...current, [setId]: draft }))
    if (userId) writeSetDraft(userId, session.id, setId, draft)
  }

  function clearDraft(setId: string) {
    setDrafts((current) => {
      const next = { ...current }
      delete next[setId]
      return next
    })
    if (userId) writeSetDraft(userId, session.id, setId, null)
  }

  async function handleComplete(current: SessionExerciseDoc, next: SetRow) {
    const before = current.sets.find((row) => row.id === next.id) ?? next
    await store.upsertSet(session.id, next)
    clearDraft(next.id)
    const opened = before.completed_at != null && next.completed_at == null
    const logged = before.completed_at == null && next.completed_at != null
    if (opened) {
      if (undo?.before.id === before.id && undo.sourceId) onCancelRestSource(undo.sourceId)
      setUndo(null)
      setAnnounce(t('set.undo'))
      return
    }
    if (!logged) {
      setAnnounce(t('workout.savedLocal'))
      return
    }
    const decision = advanceAfterConfirm({
      ...flowFromSession(session),
      confirmedExerciseId: current.id,
      confirmedSetId: next.id,
      focus: focusRef.current,
      newlyCompleted: true,
      defaultRestSeconds,
      intervalTimerActive: intervalActive,
    })
    if (decision.rest) onRest(decision.rest.seconds, decision.rest.sourceId)
    if (decision.moved && decision.focus) choose(decision.focus)
    else setOfferId(decision.offerExerciseId)
    const name = displaySnapshotName(current.name_snapshot, current.exercise_id)
    setUndo({
      before,
      sourceId: decision.rest?.sourceId ?? null,
      name,
      n: current.sets.findIndex((row) => row.id === next.id) + 1,
    })
    setAnnounce(t('workout.savedLocal'))
  }

  async function undoLast() {
    if (!undo) return
    const sourceId = undo.sourceId
    await store.upsertSet(session.id, undo.before)
    if (sourceId) onCancelRestSource(sourceId)
    setUndo(null)
    setAnnounce(t('set.undo'))
  }

  function addSet(asWarmup: boolean) {
    if (!exercise) return
    if (asWarmup || exercise.is_warmup) {
      void store.addWarmupSets(session.id, exercise.id, [{ weightKg: null, reps: null }])
      return
    }
    const position = exercise.sets.reduce((max, row) => Math.max(max, row.position), 0) + 1
    const now = new Date().toISOString()
    const row: SetRow = {
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
      created_at: now,
      updated_at: now,
    }
    void store.upsertSet(session.id, row)
  }

  function repeatLast() {
    if (!exercise || !activeSet) return
    const previous = [...exercise.sets]
      .filter((row) => row.completed_at && row.id !== activeSet.id)
      .sort((a, b) => a.position - b.position)
      .at(-1)
    if (!previous) return
    const bodyweight = isBodyweightLoadExercise({ id: exercise.exercise_id, name: exercise.name_snapshot })
    const draft = draftFromLogged(previous, units, bodyweight)
    setExternalDraft(draft)
    setDraftVersion((version) => version + 1)
    rememberDraft(activeSet.id, draft)
  }

  function suggestionFor(current: SessionExerciseDoc, row: SetRow): SetSuggestion {
    const bodyweight = isBodyweightLoadExercise({ id: current.exercise_id, name: current.name_snapshot })
    const history = findPreviousPerformance(
      store.sessions,
      { exerciseId: current.exercise_id, name: current.name_snapshot },
      session.id,
    )
    const ordinal = setGroupOrdinal(current.sets, row)
    const matched = history.status === 'match'
      ? matchPreviousSet(history.sets, {
          isWarmup: row.is_warmup === true,
          roundIndex: row.round_index ?? null,
          side: row.side ?? null,
          direction: row.direction ?? null,
          ordinal,
        })
      : null
    const targetWeight = current.uses_backup ? null : current.target_weight_kg
    const weight = pickPreparedValue({
      saved: row.weight_kg,
      hasSaved: row.weight_kg != null,
      target: targetWeight ?? null,
      previous: matched?.set.weight_kg ?? null,
    })
    const repsTarget = concreteTarget(current.target_reps, current.target_reps_min, current.target_reps_max)
    const reps = pickPreparedValue({
      saved: row.reps,
      hasSaved: row.reps != null,
      target: repsTarget,
      previous: matched?.set.reps ?? null,
    })
    const durationTarget = concreteTarget(current.target_duration_s, current.target_duration_min_s, current.target_duration_max_s)
    const duration = pickPreparedValue({
      saved: row.duration_s,
      hasSaved: row.duration_s != null,
      target: durationTarget,
      previous: matched?.set.duration_s ?? null,
    })
    const distanceTarget = concreteTarget(current.target_distance_m, current.target_distance_min_m, current.target_distance_max_m)
    const distance = pickPreparedValue({
      saved: row.distance_m,
      hasSaved: row.distance_m != null,
      target: distanceTarget,
      previous: matched?.set.distance_m ?? null,
    })
    const fillSource = [weight, reps, duration, distance].find((field) => field.source === 'target' || field.source === 'previous')
    const previousText = matched
      ? `${formatLoggedSet(matched.set, current.measurement_snapshot, units, bodyweight)} · ${history.status === 'match' ? history.startedAt.slice(0, 10) : ''}`
      : history.status === 'ambiguous'
        ? t('workout.ambiguousPrevious')
        : null
    return {
      weight: weight.source === 'saved' || weight.value == null ? '' : weightForInput(weight.value, units),
      reps: reps.source === 'saved' || reps.value == null ? '' : String(reps.value),
      duration: duration.source === 'saved' || duration.value == null ? '' : formatDuration(duration.value),
      distance: distance.source === 'saved' || distance.value == null ? '' : distanceForInput(distance.value, units),
      source: fillSource?.source === 'target' || fillSource?.source === 'previous' ? fillSource.source : 'empty',
      previousText,
    }
  }

  const shownName = exercise ? displaySnapshotName(exercise.name_snapshot, exercise.exercise_id) : ''
  const catalog = exercise?.exercise_id ? store.exercises.find((row) => row.id === exercise.exercise_id) : null
  const video = catalog ? formVideoUrl(catalog.name) : exercise ? formVideoUrl(exercise.name_snapshot) : null
  const visibleSets = exercise
    ? exercise.sets.length <= MANY_SETS || showAll
      ? exercise.sets
      : exercise.sets.filter((_row, index) => {
          const activeIndex = exercise.sets.findIndex((candidate) => candidate.id === focus?.setId)
          return Math.abs(index - activeIndex) <= 1
        })
    : []
  const peek = exercise && activeSet && activeSet.completed_at == null
    ? peekAdvance({
        ...flow,
        exerciseId: exercise.id,
        setId: activeSet.id,
        focus,
        defaultRestSeconds,
        intervalTimerActive: intervalActive,
      })
    : null
  const peekExercise = peek?.focus
    ? ordered.find((row) => row.id === peek.focus?.exerciseId)
    : offerId
      ? ordered.find((row) => row.id === offerId)
      : null
  const peekName = peekExercise ? displaySnapshotName(peekExercise.name_snapshot, peekExercise.exercise_id) : ''
  const nextHint = peek?.moved && peek.focus && peekExercise
    ? peek.focus.exerciseId === exercise?.id
      ? t('workout.nextSetHint', {
          name: peekName,
          n: (peekExercise.sets.findIndex((row) => row.id === peek.focus?.setId) + 1) || 1,
        })
      : t('workout.nextStationHint', { name: peekName })
    : offerId && peekName
      ? t('workout.nextStationHint', { name: peekName })
      : null
  const removeExercise = ordered.find((row) => row.id === removeId) ?? null
  const chips = block && activeSet?.round_index && members.length > 1
    ? stationChips(members, activeSet.round_index, exercise?.id ?? null)
    : []

  function overviewList() {
    const groups: { id: string; title: string; exerciseIds: string[] }[] = []
    const seen = new Set<string>()
    for (const row of ordered) {
      if (seen.has(row.id)) continue
      const flowRow = flow.exercises.find((item) => item.id === row.id)
      const group = flowRow ? flowMembers(flowRow, flow.exercises, flow.blocks) : []
      if (group.length > 1) {
        for (const member of group) seen.add(member.id)
        const blockId = flowRow?.blockId
        const blockRow = session.session_blocks?.find((item) => item.id === blockId)
        const blockProgress = progress.blocks.find((item) => item.blockId === blockId)
        groups.push({
          id: blockId ?? flowRow?.supersetGroup ?? row.id,
          title: blockRow
            ? `${blockFormatLabel(blockRow.format)} · ${blockProgress?.roundsDone ?? 0}/${blockProgress?.roundsTotal ?? 0}`
            : t('blockFormat.superset'),
          exerciseIds: group.map((member) => member.id),
        })
      } else {
        seen.add(row.id)
        groups.push({ id: row.id, title: '', exerciseIds: [row.id] })
      }
    }
    return groups
  }

  return (
    <div className="workout-layout">
      <div className="workout-overview-panel" aria-label={t('workout.overview')}>
        <OverviewList
          groups={overviewList()}
          ordered={ordered}
          progress={progress}
          activeId={exercise?.id ?? null}
          onChoose={(exerciseId) => choose(resolveFocus(flow.exercises, { exerciseId, setId: 'missing' }))}
        />
      </div>

      <div className="workout-station">
        <button type="button" className="workout-overview-open" onClick={() => setOverview(true)}>
          <span>{t('workout.overview')}</span>
          <small>
            {exercise
              ? t('workout.overviewPosition', { index: exerciseIndex + 1, total: ordered.length })
              : t('workout.workProgress', { done: progress.workDone, total: progress.workTotal })}
          </small>
        </button>

        {exercise ? (
          <>
            {roundLabel ? <p className="workout-kicker">{roundLabel}</p> : null}
            {chips.length > 0 ? (
              <ol className="workout-stations">
                {chips.map((chip) => {
                  const row = ordered.find((item) => item.id === chip.exerciseId)
                  const label = row ? displaySnapshotName(row.name_snapshot, row.exercise_id) : chip.exerciseId
                  const stateLabel = chip.state === 'done'
                    ? t('workout.stationDone')
                    : chip.state === 'now'
                      ? t('workout.stationNow')
                      : chip.state === 'next'
                        ? t('workout.stationNext')
                        : chip.state === 'absent'
                          ? t('workout.stationAbsent')
                          : ''
                  return (
                    <li key={chip.exerciseId} className={`workout-station-chip is-${chip.state}`}>
                      <span>{label}</span>
                      {stateLabel ? <small>{stateLabel}</small> : null}
                    </li>
                  )
                })}
              </ol>
            ) : null}
            <h2 className="workout-station__name">{shownName}</h2>
            <p className="workout-plan">
              {prescriptionLine(exercise, units)}
              {exercise.is_warmup || block?.role === 'warmup' ? ` · ${t('workout.warmup')}` : ''}
              {exercise.side_mode === 'per_leg' ? ` · ${t('workout.perLeg')}` : ''}
              {exercise.side_mode === 'per_side' ? ` · ${t('workout.perSide')}` : ''}
            </p>
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

            <div className="workout-sets">
              {visibleSets.map((row) => (
                <SetEditor
                  key={row.id}
                  index={exercise.sets.findIndex((candidate) => candidate.id === row.id)}
                  set={row}
                  measurement={exercise.measurement_snapshot}
                  units={units}
                  bodyweightLoad={isBodyweightLoadExercise({ id: exercise.exercise_id, name: exercise.name_snapshot })}
                  exerciseName={shownName}
                  active={row.id === focus?.setId}
                  suggestion={suggestionFor(exercise, row)}
                  persistedDraft={drafts[row.id] ?? null}
                  draftVersion={row.id === focus?.setId ? draftVersion : 0}
                  externalDraft={row.id === focus?.setId ? externalDraft : null}
                  onDraft={(draft) => rememberDraft(row.id, draft)}
                  onChange={(next) => void store.upsertSet(session.id, next)}
                  onComplete={(next) => handleComplete(exercise, next)}
                  onDelete={() => void store.deleteSet(session.id, exercise.id, row.id)}
                />
              ))}
            </div>
            {exercise.sets.length > MANY_SETS ? (
              <button type="button" className="btn" onClick={() => setShowAll((open) => !open)}>
                {showAll ? t('workout.fewerSets') : t('workout.allSets', { count: exercise.sets.length })}
              </button>
            ) : null}
            <div className="workout-set-tools">
              <AddSetButton onAdd={() => addSet(false)} />
              {exercise.is_warmup || block?.role === 'warmup' ? null : (
                <AddSetButton onAdd={() => addSet(true)} label={t('set.addWarmup')} />
              )}
              <button type="button" className="btn set-add" onClick={repeatLast}>
                {t('workout.repeatLast')}
              </button>
            </div>
            <div className="workout-step">
              <button
                type="button"
                className="btn"
                disabled={exerciseIndex <= 0}
                onClick={() => {
                  const previous = ordered[exerciseIndex - 1]
                  if (previous) choose(resolveFocus(flow.exercises, { exerciseId: previous.id, setId: 'missing' }))
                }}
              >
                {t('workout.previousExercise')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!offerId && exerciseIndex >= ordered.length - 1}
                onClick={() => {
                  const targetId = offerId ?? ordered[exerciseIndex + 1]?.id
                  if (!targetId) return
                  choose(resolveFocus(flow.exercises, { exerciseId: targetId, setId: 'missing' }))
                }}
              >
                {t('workout.nextExercise')}
              </button>
            </div>
            {nextHint ? <p className="workout-next-hint">{nextHint}</p> : null}
            <div className="workout-tools">
              {video ? (
                <a className="btn" href={video} target="_blank" rel="noreferrer noopener">
                  {t('editor.watchForm', { name: shownName })}
                </a>
              ) : null}
              {canRestructure ? (
                <>
                  <button type="button" className="btn" onClick={() => onSwap(exercise.id)}>
                    <IconSwap width={16} height={16} /> {t('workout.swapNamed', { name: shownName })}
                  </button>
                  <button type="button" className="btn" onClick={() => {
                    const hasData = exercise.sets.some((row) =>
                      row.completed_at || row.weight_kg != null || row.reps != null || row.duration_s != null || row.distance_m != null,
                    )
                    if (!hasData) {
                      void store.removeSessionExercise(session.id, exercise.id)
                      return
                    }
                    setRemoveId(exercise.id)
                  }}>
                    <IconTrash width={16} height={16} /> {t('workout.removeFromWorkout', { name: shownName })}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {undo ? (
          <div className="workout-undo" role="status">
            <span>{t('workout.undoSet', { exercise: undo.name, n: undo.n })}</span>
            <button type="button" className="btn" onClick={() => void undoLast()}>{t('set.undo')}</button>
          </div>
        ) : null}
        <span className="visually-hidden" aria-live="polite">{announce}</span>
      </div>

      {overview ? (
        <BottomSheet title={t('workout.overview')} onClose={() => setOverview(false)}>
          <OverviewList
            groups={overviewList()}
            ordered={ordered}
            progress={progress}
            activeId={exercise?.id ?? null}
            onChoose={(exerciseId) => {
              choose(resolveFocus(flow.exercises, { exerciseId, setId: 'missing' }))
              setOverview(false)
            }}
          />
        </BottomSheet>
      ) : null}

      {removeExercise ? (
        <Modal title={t('workout.removeTitle', { name: displaySnapshotName(removeExercise.name_snapshot, removeExercise.exercise_id) })} onClose={() => setRemoveId(null)}>
          <p>{t('workout.removeBody', { name: displaySnapshotName(removeExercise.name_snapshot, removeExercise.exercise_id) })}</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void store.removeSessionExercise(session.id, removeExercise.id)
                setRemoveId(null)
              }}
            >
              {t('workout.removeConfirm')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setRemoveId(null)}>
              {t('workout.keepExercise')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function OverviewList({
  groups,
  ordered,
  progress,
  activeId,
  onChoose,
}: {
  groups: { id: string; title: string; exerciseIds: string[] }[]
  ordered: SessionExerciseDoc[]
  progress: ReturnType<typeof sessionProgress>
  activeId: string | null
  onChoose(exerciseId: string): void
}) {
  const { t } = useT()
  return (
    <div className="workout-overview-list">
      {groups.map((group) => (
        <section key={group.id}>
          {group.title ? <h3 className="workout-overview-kicker">{group.title}</h3> : null}
          {group.exerciseIds.map((id) => {
            const row = ordered.find((item) => item.id === id)
            const itemProgress = progress.exercises.find((item) => item.exerciseId === id)
            if (!row || !itemProgress) return null
            const status = itemProgress.status === 'done'
              ? t('workout.groupDone')
              : itemProgress.status === 'partial'
                ? t('workout.groupPartial')
                : itemProgress.status === 'empty'
                  ? t('workout.groupEmpty')
                  : ''
            const count = itemProgress.workTotal > 0
              ? t('workout.workProgress', { done: itemProgress.workDone, total: itemProgress.workTotal })
              : itemProgress.warmupTotal > 0
                ? t('workout.warmupProgress', { done: itemProgress.warmupDone, total: itemProgress.warmupTotal })
                : ''
            return (
              <button
                key={id}
                type="button"
                className={`workout-overview-item${id === activeId ? ' is-active' : ''}`}
                aria-current={id === activeId ? 'true' : undefined}
                onClick={() => onChoose(id)}
              >
                <strong>{displaySnapshotName(row.name_snapshot, row.exercise_id)}</strong>
                <small>
                  {row.is_warmup ? `${t('workout.warmup')} · ` : ''}
                  {status}
                  {count ? ` · ${count}` : ''}
                </small>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
