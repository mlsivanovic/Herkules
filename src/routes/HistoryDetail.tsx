// Session history detail: review a completed (or active) workout and edit it
// afterwards — edits touch only this session's snapshot, never the routine.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, newId } from '../lib/store'
import type { SessionDoc, SetRow } from '../types/db'
import { formatDateLong } from '../lib/dates'
import { formatDuration, formatWeight } from '../lib/units'
import { sessionVolume } from '../lib/metrics'
import { EmptyState, Loader, StatusBadge } from '../components/ui'
import { SetEditor, AddSetButton } from '../components/SetEditor'
import './history.css'

export function HistoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const session = store.sessions.find((s) => s.id === id) ?? null
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)

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
    return <EmptyState title="Workout not found" hint="It may have been deleted." />
  }
  const current: SessionDoc = session

  const completedSets = session.session_exercises.reduce(
    (sum, se) => sum + se.sets.filter((s) => s.completed_at !== null).length,
    0,
  )

  function addSet(sessionExerciseId: string, position: number) {
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
            {duration !== null ? ` · ${formatDuration(duration)}` : ''} · {completedSets} sets ·{' '}
            {formatWeight(sessionVolume(session), units)} volume
          </small>
        </div>
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

      <div className="field">
        <label htmlFor="history-notes">Notes</label>
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
          <section key={se.id} className="card">
            <div className="row row--between">
              <strong>{se.name_snapshot}</strong>
              <small className="muted">{se.sets.filter((s) => s.completed_at !== null).length} sets</small>
            </div>
            <div className="stack" style={{ gap: '0.35rem', marginTop: '0.5rem' }}>
              {se.sets.length === 0 ? (
                <small className="muted">No sets logged.</small>
              ) : (
                se.sets.map((set, index) => (
                  <SetEditor
                    key={set.id}
                    index={index}
                    set={set}
                    measurement={se.measurement_snapshot}
                    units={units}
                    onChange={(next) => void store.upsertSet(session.id, next)}
                    onComplete={(next) => void store.upsertSet(session.id, next)}
                    onDelete={() => void store.deleteSet(session.id, se.id, set.id)}
                  />
                ))
              )}
              <AddSetButton onAdd={() => addSet(se.id, se.sets.length + 1)} />
            </div>
          </section>
        ))}
      </div>

      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void navigate(-1)}>
          Back
        </button>
      </div>
    </div>
  )
}
