// Chronological history list: every finished and skipped workout, grouped
// by month. Detail review and post-hoc editing live on /history/:id.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { SessionDoc } from '../types/db'
import { formatDateShort, formatMonthLabel } from '../lib/dates'
import { formatDuration, formatWeight } from '../lib/units'
import { sessionVolume } from '../lib/metrics'
import { EmptyState, Loader, StatusBadge } from '../components/ui'
import './history.css'

function dayKey(session: SessionDoc): string {
  return session.planned_date ?? session.started_at.slice(0, 10)
}

function durationOf(session: SessionDoc): number | null {
  if (!session.ended_at) return null
  return Math.max(
    0,
    Math.round(
      (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000,
    ),
  )
}

export function History() {
  const store = useStore()
  const navigate = useNavigate()
  const units = store.profile?.unit_system ?? 'metric'

  const finished = useMemo(
    () =>
      store.sessions
        .filter((s) => s.status === 'completed' || s.status === 'skipped')
        .sort((a, b) => {
          const key = dayKey(a).localeCompare(dayKey(b))
          return key !== 0 ? -key : b.started_at.localeCompare(a.started_at)
        }),
    [store.sessions],
  )

  const groups = useMemo(() => {
    const map = new Map<string, SessionDoc[]>()
    for (const session of finished) {
      const month = dayKey(session).slice(0, 7)
      const list = map.get(month) ?? []
      list.push(session)
      map.set(month, list)
    }
    return [...map.entries()]
  }, [finished])

  if (!store.ready) return <Loader />

  return (
    <div>
      <div className="page-head">
        <h1>History</h1>
        <span className="muted">
          {finished.length} workout{finished.length === 1 ? '' : 's'}
        </span>
      </div>

      {finished.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          hint="Finished and skipped workouts will show up here."
        />
      ) : (
        groups.map(([month, sessions]) => (
          <section key={month}>
            <div className="section-title">
              {formatMonthLabel(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1)}
            </div>
            <div className="stack">
              {sessions.map((session) => {
                const sets = session.session_exercises.reduce(
                  (sum, se) => sum + se.sets.filter((set) => set.completed_at !== null).length,
                  0,
                )
                const duration = durationOf(session)
                const summary =
                  session.status === 'skipped'
                    ? 'Skipped'
                    : [
                        sets > 0 ? `${sets} sets` : null,
                        duration !== null ? formatDuration(duration) : null,
                        session.session_exercises.length > 0
                          ? formatWeight(sessionVolume(session), units)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                return (
                  <button
                    key={session.id}
                    type="button"
                    className="card exercise-card history-row"
                    onClick={() => void navigate(`/history/${session.id}`)}
                  >
                    <span className="row row--between">
                      <span>
                        <strong>{formatDateShort(dayKey(session))}</strong>{' '}
                        <span className="muted">{session.name}</span>{' '}
                        <StatusBadge
                          status={session.status === 'skipped' ? 'skipped' : 'completed'}
                        />
                      </span>
                      <small className="muted">{summary}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
