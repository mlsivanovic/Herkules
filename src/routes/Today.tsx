// Today dashboard: active workout, today's plan, quick start, week snapshot.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { formatDateLong, startOfWeek, todayKey } from '../lib/dates'
import { occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import { workoutStreak } from '../lib/metrics'
import { EmptyState, Loader, StatusBadge } from '../components/ui'
import { IconPlay, IconPlus } from '../components/Icons'
import './today.css'

export function Today() {
  const navigate = useNavigate()
  const { sessions, schedules, rules, templates, profile, ready, skipOccurrence, unskipOccurrence } =
    useStore()
  const today = todayKey()
  const weekStartDay = profile?.week_start ?? 'monday'

  const active = sessions.find((s) => s.status === 'in_progress') ?? null

  const plannedToday = useMemo(() => {
    const refs: ScheduleRef[] = schedules.map((schedule) => ({
      schedule,
      rule: schedule.recurrence_rule_id
        ? rules.find((r) => r.id === schedule.recurrence_rule_id) ?? null
        : null,
    }))
    return occurrencesInRange(refs, today, today).map((o) => ({
      scheduleId: o.scheduleId,
      template: templates.find((t) => t.id === o.templateId),
    }))
  }, [schedules, rules, templates, today])

  const doneToday = sessions.filter(
    (s) => s.status === 'completed' && (s.planned_date ?? s.started_at.slice(0, 10)) === today,
  )
  const skippedToday = sessions.filter(
    (s) => s.status === 'skipped' && (s.planned_date ?? s.started_at.slice(0, 10)) === today,
  )

  const week = useMemo(() => {
    const from = startOfWeek(today, weekStartDay)
    const inWeek = sessions.filter((s) => {
      if (s.status !== 'completed') return false
      const key = s.planned_date ?? s.started_at.slice(0, 10)
      return key >= from && key <= today
    })
    return { count: inWeek.length, streak: workoutStreak(sessions, today) }
  }, [sessions, today, weekStartDay])

  if (!ready) return <Loader />

  const firstName = (profile?.display_name ?? '').trim().split(' ')[0]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{firstName ? `Hi, ${firstName}` : 'Today'}</h1>
          <small className="muted">{formatDateLong(today)}</small>
        </div>
        <div className="today-stats">
          <div className="today-stat">
            <strong>{week.count}</strong>
            <span>this week</span>
          </div>
          <div className="today-stat">
            <strong>{week.streak}</strong>
            <span>day streak</span>
          </div>
        </div>
      </div>

      {active ? (
        <button
          type="button"
          className="card today-active"
          onClick={() => void navigate('/workout')}
        >
          <span className="row row--between">
            <span>
              <StatusBadge status="in-progress" /> <strong>{active.name}</strong>
              <small className="muted" style={{ display: 'block' }}>
                Started {new Date(active.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} — tap to continue
              </small>
            </span>
            <IconPlay width={22} height={22} />
          </span>
        </button>
      ) : null}

      <div className="section-title">Planned today</div>
      {plannedToday.length === 0 && doneToday.length === 0 && skippedToday.length === 0 ? (
        <EmptyState
          title="Nothing planned today"
          hint="Take a rest day, or start something anyway."
          action={
            <button type="button" className="btn btn--primary" onClick={() => void navigate('/workout')}>
              <IconPlay width={18} height={18} /> Start empty workout
            </button>
          }
        />
      ) : (
        <div className="stack">
          {plannedToday.map((entry) => {
            const alreadyDone = doneToday.some((s) => s.schedule_item_id === entry.scheduleId)
            const skipped = skippedToday.find((s) => s.schedule_item_id === entry.scheduleId)
            return (
              <div key={entry.scheduleId} className="card row row--between">
                <span>
                  <strong>{entry.template?.name ?? 'Workout'}</strong>{' '}
                  {alreadyDone ? (
                    <StatusBadge status="completed" />
                  ) : skipped ? (
                    <StatusBadge status="skipped" />
                  ) : (
                    <StatusBadge status="planned" />
                  )}
                </span>
                {!alreadyDone && !active ? (
                  <span className="row">
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={() =>
                        void navigate('/workout', {
                          state: {
                            templateId: entry.template?.id,
                            scheduleItemId: entry.scheduleId,
                            plannedDate: today,
                          },
                        })
                      }
                    >
                      Start
                    </button>
                    {skipped ? (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => void unskipOccurrence(skipped.id)}
                      >
                        Undo skip
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => void skipOccurrence(entry.scheduleId, today)}
                      >
                        Skip
                      </button>
                    )}
                  </span>
                ) : null}
              </div>
            )
          })}
          {doneToday
            .filter((s) => !plannedToday.some((p) => p.scheduleId === s.schedule_item_id))
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className="card exercise-card"
                onClick={() => void navigate(`/history/${s.id}`)}
              >
                <span className="row row--between">
                  <span>
                    <strong>{s.name}</strong> <StatusBadge status="completed" />
                  </span>
                  <small className="muted">Review →</small>
                </span>
              </button>
            ))}
        </div>
      )}

      <div className="section-title">Quick actions</div>
      <div className="row row--wrap">
        <button type="button" className="btn" onClick={() => void navigate('/workout')}>
          <IconPlay width={18} height={18} /> Start workout
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/routines/new')}>
          <IconPlus width={18} height={18} /> New routine
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/calendar')}>
          Plan in calendar
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/history')}>
          Workout history
        </button>
      </div>
    </div>
  )
}
