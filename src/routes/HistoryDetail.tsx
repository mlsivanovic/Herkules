// Session history detail: review a completed (or active) workout and edit it
// afterwards — edits touch only this session's snapshot, never the routine.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, newId } from '../lib/store'
import type { SessionDoc, SetRow } from '../types/db'
import { formatDateLong } from '../lib/dates'
import { formatDuration, formatWeight } from '../lib/units'
import { isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import { sessionVolume } from '../lib/metrics'
import { blockRoleClass } from '../lib/blockRole'
import { EmptyState, Loader, Modal, StatusBadge } from '../components/ui'
import { SetEditor, AddSetButton } from '../components/SetEditor'
import { IconTrash } from '../components/Icons'
import { displaySnapshotName, useT } from '../lib/i18n'
import './history.css'

export function HistoryDetail() {
  const { t } = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const session = store.sessions.find((s) => s.id === id) ?? null
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  const duration = useMemo(() => {
    if (!session?.ended_at) return null
    return Math.max(
      0,
      Math.round(
        (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000,
      ),
    )
  }, [session])

  const units = store.profile?.unit_system ?? 'metric'

  if (!store.ready) return <Loader />
  if (!session) {
    return <EmptyState title={t('history.notFoundTitle')} hint={t('common.mayHaveDeleted')} />
  }
  const current: SessionDoc = session

  const comments = store.sessionComments.filter((row) => row.session_id === session.id)
  const completedSets = session.session_exercises.reduce(
    (sum, se) => sum + se.sets.filter((s) => s.completed_at !== null).length,
    0,
  )

  function addSet(sessionExerciseId: string, asWarmup = false) {
    const exercise = current.session_exercises.find((row) => row.id === sessionExerciseId)
    if (!exercise) return
    if (asWarmup || exercise.is_warmup === true) {
      void store.addWarmupSets(current.id, sessionExerciseId, [{ weightKg: null, reps: null }])
      return
    }
    const position = exercise.sets.reduce((max, set) => Math.max(max, set.position), 0) + 1
    const set: SetRow = {
      id: newId(),
      session_exercise_id: sessionExerciseId,
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
    void store.upsertSet(current.id, set)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{session.name}</h1>
          <small className="muted">
            {formatDateLong(session.planned_date ?? session.started_at.slice(0, 10))}
            {duration !== null ? ` · ${formatDuration(duration)}` : ''} ·{' '}
            {t('history.setsCount', { count: completedSets })} ·{' '}
            {formatWeight(sessionVolume(session), units)} {t('common.volume')}
          </small>
        </div>
        <div className="row">
          {session.status === 'completed' || session.status === 'skipped' ? (
            <button
              type="button"
              className="btn btn--icon btn--danger"
              aria-label={t('calendar.deleteWorkout', { name: session.name })}
              onClick={() => setPendingDelete(true)}
            >
              <IconTrash width={18} height={18} />
            </button>
          ) : null}
          <StatusBadge
            status={
              session.status === 'in_progress'
                ? 'in-progress'
                : session.status === 'skipped'
                  ? 'skipped'
                  : 'completed'
            }
          />
        </div>
      </div>

      {comments.length > 0 ? (
        <div className="card stack" style={{ marginBottom: '1rem' }}>
          <div className="section-title">{t('history.coachNotes')}</div>
          {comments.map((row) => (
            <p key={row.id} style={{ margin: 0 }}>
              {row.body}
            </p>
          ))}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="history-notes">{t('history.notes')}</label>
        <textarea
          id="history-notes"
          className="input"
          rows={2}
          value={notesDirty ? notes : (session.notes ?? '')}
          onChange={(e) => {
            setNotes(e.target.value)
            setNotesDirty(true)
          }}
          onBlur={() => {
            if (notesDirty) {
              void store.updateSessionMeta(session.id, {
                notes: notes.trim() === '' ? null : notes.trim(),
              })
              setNotesDirty(false)
            }
          }}
        />
      </div>

      <div className="stack">
        {session.session_exercises.map((se) => (
          <section key={se.id} className={`card ${blockRoleClass(se.block_role)}`}>
            <div className="row row--between">
              <span className="row">
                <strong>{displaySnapshotName(se.name_snapshot, se.exercise_id)}</strong>
                {se.tempo ? (
                  <span className="badge badge--neutral" title={t('history.prescribedTempo')}>
                    {t('editor.tempo')} {se.tempo}
                  </span>
                ) : null}
              </span>
              <small className="muted">
                {t('history.setsCount', {
                  count: se.sets.filter((s) => s.completed_at !== null).length,
                })}
              </small>
            </div>
            {se.notes ? (
              <p className="muted" style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>
                {se.notes}
              </p>
            ) : null}
            <div className="stack" style={{ gap: '0.35rem', marginTop: '0.5rem' }}>
              {se.sets.length === 0 ? (
                <small className="muted">{t('history.noSets')}</small>
              ) : (
                se.sets.map((set, index) => (
                  <SetEditor
                    key={set.id}
                    index={index}
                    set={set}
                    measurement={se.measurement_snapshot}
                    units={units}
                    bodyweightLoad={isBodyweightLoadExercise({
                      id: se.exercise_id,
                      name: se.name_snapshot,
                    })}
                    onChange={(next) => void store.upsertSet(session.id, next)}
                    onComplete={(next) => void store.upsertSet(session.id, next)}
                    onDelete={() => void store.deleteSet(session.id, se.id, set.id)}
                  />
                ))
              )}
              <div className="row row--wrap" style={{ gap: '0.4rem' }}>
                <AddSetButton onAdd={() => addSet(se.id, false)} />
                {se.is_warmup === true ? null : (
                  <AddSetButton onAdd={() => addSet(se.id, true)} label={t('set.addWarmup')} />
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void navigate(-1)}>
          {t('common.back')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void navigate('/history')}>
          {t('history.allHistory')}
        </button>
      </div>

      {pendingDelete ? (
        <Modal title={t('calendar.deleteTitle')} onClose={() => setPendingDelete(false)}>
          <p>{t('calendar.deleteBody')}</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void store.deleteSession(session.id)
                setPendingDelete(false)
                void navigate(-1)
              }}
            >
              {t('calendar.deleteConfirm')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setPendingDelete(false)}>
              {t('history.keepIt')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
