// Today dashboard: active workout, today's plan, quick start, week snapshot.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { formatDateLong, startOfWeek, todayKey } from '../lib/dates'
import { occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import { workoutStreak } from '../lib/metrics'
import { EmptyState, Loader, StatusBadge } from '../components/ui'
import { IconPlay, IconPlus } from '../components/Icons'
import { TendonCheckin } from '../components/TendonCheckin'
import { WeightCheckin } from '../components/WeightCheckin'
import { BodyCompositionCheckin } from '../components/BodyCompositionCheckin'
import { AerobicGoal } from '../components/AerobicGoal'
import './today.css'
import { nextTemplateForPlan } from '../lib/programs/plans'
import { bcp47, useT } from '../lib/i18n'
import { capabilitiesFor } from '../lib/capabilities'

export function Today() {
  const { t } = useT()
  const navigate = useNavigate()
  const {
    sessions,
    schedules,
    rules,
    templates,
    planRoutines,
    profile,
    ready,
    skipOccurrence,
    unskipOccurrence,
  } = useStore()
  const caps = capabilitiesFor(profile)
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
      template: o.templateId
        ? templates.find((t) => t.id === o.templateId)
        : o.planId
          ? nextTemplateForPlan(o.planId, templates, sessions, planRoutines) ?? undefined
          : undefined,
    }))
  }, [schedules, rules, templates, sessions, planRoutines, today])

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
    <div className="today-page">
      <div className="page-head">
        <div>
          <h1>{firstName ? t('today.hi', { name: firstName }) : t('today.title')}</h1>
          <small className="muted">{formatDateLong(today)}</small>
        </div>
        <div className="today-stats">
          <div className="today-stat">
            <strong>{week.count}</strong>
            <span>{t('today.thisWeek')}</span>
          </div>
          <div className="today-stat">
            <strong>{week.streak}</strong>
            <span>{t('today.dayStreak')}</span>
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
                {t('today.startedContinue', {
                  time: new Date(active.started_at).toLocaleTimeString(bcp47(), {
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </small>
            </span>
            <IconPlay width={22} height={22} />
          </span>
        </button>
      ) : caps.canStartEmptyWorkout || caps.kind === 'light' || plannedToday.length > 0 ? (
        <button
          type="button"
          className="btn btn--primary btn--block today-start"
          onClick={() => void navigate('/workout')}
        >
          <IconPlay width={18} height={18} /> {t('today.startWorkout')}
        </button>
      ) : null}

      <div className="section-title">{t('today.plannedToday')}</div>
      {plannedToday.length === 0 && doneToday.length === 0 && skippedToday.length === 0 ? (
        <EmptyState title={t('today.nothingTitle')} hint={t('today.nothingHint')} />
      ) : (
        <div className="stack">
          {plannedToday.map((entry) => {
            const alreadyDone = doneToday.some((s) => s.schedule_item_id === entry.scheduleId)
            const skipped = skippedToday.find((s) => s.schedule_item_id === entry.scheduleId)
            return (
              <div key={entry.scheduleId} className="card row row--between">
                <span>
                  <strong>{entry.template?.name ?? t('today.workout')}</strong>{' '}
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
                      {t('common.start')}
                    </button>
                    {skipped ? (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => void unskipOccurrence(skipped.id)}
                      >
                        {t('common.undoSkip')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => void skipOccurrence(entry.scheduleId, today)}
                      >
                        {t('common.skip')}
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
                  <small className="muted">{t('today.review')}</small>
                </span>
              </button>
            ))}
        </div>
      )}

      <div className="section-title">{t('today.quickActions')}</div>
      <div className="row row--wrap">
        {caps.canCreateRoutines ? (
          <button type="button" className="btn" onClick={() => void navigate('/routines/new')}>
            <IconPlus width={18} height={18} /> {t('today.newRoutine')}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={() => void navigate('/calendar')}>
          {t('today.planCalendar')}
        </button>
        <button type="button" className="btn" onClick={() => void navigate('/history')}>
          {t('today.history')}
        </button>
      </div>

      <div className="today-checkins">
        <AerobicGoal />
        <WeightCheckin />
        <BodyCompositionCheckin />
        <TendonCheckin />
      </div>
    </div>
  )
}
