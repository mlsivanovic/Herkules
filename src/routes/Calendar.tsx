// Calendar: month view with per-day statuses (planned / in-progress /
// completed / skipped), logged aerobic activities, and scheduling.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  formatDayShort,
  formatMonthLabel,
  isoWeekday,
  monthGrid,
  parseDateKey,
  todayKey,
  type DateKey,
} from '../lib/dates'
import { dayStatus, occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import type { DayWorkoutStatus } from '../lib/recurrence'
import { EmptyState, Loader, Modal, StatusBadge } from '../components/ui'
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from '../components/Icons'
import { templatesGroupedByPlan } from '../lib/programs/catalog'
import { nextTemplateForPlan } from '../lib/programs/plans'
import { aerobicActivityLabel, bcp47, useT } from '../lib/i18n'
import { isLightAccount, programmingForAccount } from '../lib/capabilities'
import type { AerobicActivityRow } from '../types/db'
import './calendar.css'

export function Calendar() {
  const { t } = useT()
  const navigate = useNavigate()
  const { schedules, rules, templates, planRoutines, sessions, aerobicActivities, profile, ready } =
    useStore()
  const weekStart = profile?.week_start ?? 'monday'
  const today = todayKey()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<DateKey | null>(null)
  const [schedulerFor, setSchedulerFor] = useState<DateKey | null>(null)

  const grid = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart])
  const weekdayLabels =
    weekStart === 'monday'
      ? [t('weekdays.mon'), t('weekdays.tue'), t('weekdays.wed'), t('weekdays.thu'), t('weekdays.fri'), t('weekdays.sat'), t('weekdays.sun')]
      : [t('weekdays.sun'), t('weekdays.mon'), t('weekdays.tue'), t('weekdays.wed'), t('weekdays.thu'), t('weekdays.fri'), t('weekdays.sat')]

  const refs: ScheduleRef[] = useMemo(
    () =>
      schedules.map((schedule) => ({
        schedule,
        rule: schedule.recurrence_rule_id
          ? rules.find((r) => r.id === schedule.recurrence_rule_id) ?? null
          : null,
      })),
    [schedules, rules],
  )

  const { plannedByDate, statusByDate } = useMemo(() => {
    const occurrences = occurrencesInRange(refs, grid[0] ?? today, grid[grid.length - 1] ?? today)
    const planned = new Map<DateKey, typeof occurrences>()
    for (const occurrence of occurrences) {
      const list = planned.get(occurrence.key) ?? []
      list.push(occurrence)
      planned.set(occurrence.key, list)
    }
    const sessionsByDate = new Map<DateKey, typeof sessions>()
    for (const session of sessions) {
      const key = session.planned_date ?? session.started_at.slice(0, 10)
      const list = sessionsByDate.get(key) ?? []
      list.push(session)
      sessionsByDate.set(key, list)
    }
    const activeSession = sessions.find((s) => s.status === 'in_progress')
    const activeKey = activeSession
      ? activeSession.planned_date ?? activeSession.started_at.slice(0, 10)
      : null

    const statuses = new Map<DateKey, DayWorkoutStatus>()
    for (const key of grid) {
      const daySessions = sessionsByDate.get(key) ?? []
      const status = dayStatus(
        key,
        planned.get(key)?.length ?? 0,
        daySessions.filter((s) => s.status === 'completed').length,
        activeKey === key && key === today,
        today,
        daySessions.filter((s) => s.status === 'skipped').length,
      )
      if (status) statuses.set(key, status)
    }
    return { plannedByDate: planned, statusByDate: statuses }
  }, [refs, grid, sessions, today])

  const aerobicByDate = useMemo(() => {
    const map = new Map<DateKey, AerobicActivityRow[]>()
    for (const row of aerobicActivities) {
      const list = map.get(row.recorded_on) ?? []
      list.push(row)
      map.set(row.recorded_on, list)
    }
    return map
  }, [aerobicActivities])

  function shiftMonth(delta: number) {
    const date = new Date(year, month + delta, 1)
    setYear(date.getFullYear())
    setMonth(date.getMonth())
    setSelectedDay(null)
  }

  if (!ready) return <Loader />

  const templateById = new Map(templates.map((t) => [t.id, t]))
  const selectedSessions = selectedDay
    ? sessions.filter((s) => (s.planned_date ?? s.started_at.slice(0, 10)) === selectedDay)
    : []
  const selectedAerobic = selectedDay ? (aerobicByDate.get(selectedDay) ?? []) : []

  return (
    <div>
      <div className="page-head">
        <h1>{t('calendar.title')}</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setSchedulerFor(selectedDay ?? today)}
        >
          <IconPlus width={18} height={18} /> {t('calendar.schedule')}
        </button>
      </div>

      <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
        <button
          type="button"
          className="btn btn--icon"
          aria-label={t('calendar.prevMonth')}
          onClick={() => shiftMonth(-1)}
        >
          <IconChevronLeft />
        </button>
        <h2 style={{ margin: 0 }}>{formatMonthLabel(year, month)}</h2>
        <button
          type="button"
          className="btn btn--icon"
          aria-label={t('calendar.nextMonth')}
          onClick={() => shiftMonth(1)}
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label={t('calendar.grid')}>
        {weekdayLabels.map((label) => (
          <div key={label} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}
        {grid.map((key) => {
          const inMonth = parseDateKey(key).getMonth() === month
          const status = statusByDate.get(key)
          const plannedCount = plannedByDate.get(key)?.length ?? 0
          const aerobicCount = aerobicByDate.get(key)?.length ?? 0
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={`calendar-day ${inMonth ? '' : 'calendar-day--outside'} ${
                key === today ? 'calendar-day--today' : ''
              } ${status ? `calendar-day--${status}` : ''}`}
              aria-label={`${key}${
                status
                  ? `, ${
                      status === 'in-progress'
                        ? t('status.inProgress')
                        : status === 'planned'
                          ? t('status.planned')
                          : status === 'completed'
                            ? t('status.completed')
                            : t('status.skipped')
                    }`
                  : ''
              }${
                plannedCount > 0 ? `, ${t('calendar.plannedCount', { count: plannedCount })}` : ''
              }${
                aerobicCount > 0 ? `, ${t('calendar.aerobicCount', { count: aerobicCount })}` : ''
              }`}
              aria-current={key === today ? 'date' : undefined}
              onClick={() => setSelectedDay(key)}
            >
              <span className="calendar-day-num">{Number(key.slice(8))}</span>
              {status || aerobicCount > 0 ? (
                <span className="calendar-markers" aria-hidden="true">
                  {status ? <span className="calendar-dot" /> : null}
                  {aerobicCount > 0 ? <span className="calendar-dot calendar-dot--aerobic" /> : null}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="calendar-legend" aria-hidden="true">
        <span><i className="calendar-dot calendar-dot--planned" /> {t('status.planned')}</span>
        <span><i className="calendar-dot calendar-dot--in-progress" /> {t('status.inProgress')}</span>
        <span><i className="calendar-dot calendar-dot--completed" /> {t('status.completed')}</span>
        <span><i className="calendar-dot calendar-dot--skipped" /> {t('status.skipped')}</span>
        <span><i className="calendar-dot calendar-dot--aerobic" /> {t('calendar.aerobic')}</span>
      </div>

      {selectedDay ? (
        <Modal title={new Intl.DateTimeFormat(bcp47(), { weekday: 'long', month: 'long', day: 'numeric' }).format(parseDateKey(selectedDay))} onClose={() => setSelectedDay(null)}>
          <DayDetail
            dayKey={selectedDay}
            planned={(plannedByDate.get(selectedDay) ?? []).map((o) => ({
              scheduleId: o.scheduleId,
              template: o.templateId
                ? templateById.get(o.templateId)
                : o.planId
                  ? nextTemplateForPlan(o.planId, templates, sessions, planRoutines) ?? undefined
                  : undefined,
            }))}
            sessions={selectedSessions}
            aerobic={selectedAerobic}
            onStart={(templateId, scheduleId) => {
              setSelectedDay(null)
              void navigate('/workout', {
                state: { templateId, scheduleItemId: scheduleId, plannedDate: selectedDay },
              })
            }}
            onSchedule={() => {
              setSchedulerFor(selectedDay)
              setSelectedDay(null)
            }}
          />
        </Modal>
      ) : null}

      {schedulerFor ? (
        <ScheduleModal
          dayKey={schedulerFor}
          onClose={() => setSchedulerFor(null)}
        />
      ) : null}
    </div>
  )
}

function sessionBadge(status: string): 'in-progress' | 'completed' | 'skipped' {
  if (status === 'in_progress') return 'in-progress'
  if (status === 'skipped') return 'skipped'
  return 'completed'
}

function DayDetail({
  dayKey,
  planned,
  sessions,
  aerobic,
  onStart,
  onSchedule,
}: {
  dayKey: DateKey
  planned: { scheduleId: string; template: { id: string; name: string } | undefined }[]
  sessions: { id: string; name: string; status: string; schedule_item_id: string | null }[]
  aerobic: AerobicActivityRow[]
  onStart(templateId: string, scheduleId: string): void
  onSchedule(): void
}) {
  const { t } = useT()
  const { deleteSchedule, deleteSession, deleteAerobicActivity, skipOccurrence, unskipOccurrence, schedules, profile } =
    useStore()
  const light = isLightAccount(profile)
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  return (
    <div className="stack">
      {planned.length === 0 && sessions.length === 0 && aerobic.length === 0 ? (
        <EmptyState title={t('calendar.nothingTitle')} hint={t('calendar.nothingHint')} />
      ) : null}

      {planned.map((entry) => {
        const match = sessions.find((s) => s.schedule_item_id === entry.scheduleId)
        const skipped = match?.status === 'skipped'
        const completed = match?.status === 'completed'
        const label = completed
          ? t('status.completed')
          : skipped
            ? t('status.skipped')
            : dayKey < todayKey()
              ? t('status.skipped')
              : t('status.planned')
        return (
          <div key={entry.scheduleId} className="card row row--between">
            <span>
              <strong>{entry.template?.name ?? t('calendar.routine')}</strong>{' '}
              <small className="muted">· {label}</small>
            </span>
            <span className="row">
              {!completed && dayKey >= todayKey() ? (
                <button
                  type="button"
                  className="btn btn--small btn--primary"
                  onClick={() => entry.template && onStart(entry.template.id, entry.scheduleId)}
                >
                  {t('common.start')}
                </button>
              ) : null}
              {!completed && !skipped && !match ? (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void skipOccurrence(entry.scheduleId, dayKey)}
                >
                  {t('common.skip')}
                </button>
              ) : null}
              {skipped && match ? (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void unskipOccurrence(match.id)}
                >
                  {t('common.undoSkip')}
                </button>
              ) : null}
              {!(light && schedules.find((row) => row.id === entry.scheduleId)?.assigned_by) ? (
              <button
                type="button"
                className="btn btn--small btn--danger"
                aria-label={t('calendar.unschedule', { name: entry.template?.name ?? t('calendar.routine') })}
                onClick={() => void deleteSchedule(entry.scheduleId)}
              >
                {t('common.remove')}
              </button>
              ) : null}
            </span>
          </div>
        )
      })}

      {sessions.map((session) => {
        const canOpen = session.status !== 'skipped'
        const canDelete = session.status === 'completed' || session.status === 'skipped'
        return (
          <div key={session.id} className="card calendar-session">
            {canOpen ? (
              <button
                type="button"
                className="calendar-session-open"
                onClick={() => void navigate(`/history/${session.id}`)}
              >
                <span>{session.name}</span>
                <StatusBadge status={sessionBadge(session.status)} />
              </button>
            ) : (
              <div className="calendar-session-open calendar-session-open--static">
                <span>{session.name}</span>
                <StatusBadge status={sessionBadge(session.status)} />
              </div>
            )}
            {canDelete ? (
              <button
                type="button"
                className="btn btn--icon btn--small btn--danger"
                aria-label={t('calendar.deleteWorkout', { name: session.name })}
                onClick={() => setPendingDelete(session.id)}
              >
                <IconTrash width={16} height={16} />
              </button>
            ) : null}
          </div>
        )
      })}

      {aerobic.length > 0 ? (
        <>
          <div className="section-title">{t('calendar.aerobic')}</div>
          {aerobic.map((row) => {
            const activity = aerobicActivityLabel(row.activity_type)
            const minutes = Math.round(row.duration_s / 60)
            return (
              <div key={row.id} className="card calendar-aerobic">
                <div className="calendar-session-open calendar-session-open--static">
                  <span>
                    <strong>{activity}</strong>{' '}
                    <small className="muted">
                      · {t('calendar.aerobicMinutes', { minutes })}
                    </small>
                  </span>
                  <span className="badge badge--neutral">{t('calendar.aerobic')}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--icon btn--small btn--danger"
                  aria-label={t('aerobic.deleteActivity', { activity, date: dayKey })}
                  onClick={() => void deleteAerobicActivity(row.id)}
                >
                  <IconTrash width={16} height={16} />
                </button>
              </div>
            )
          })}
        </>
      ) : null}

      <button type="button" className="btn btn--block" onClick={onSchedule}>
        <IconPlus width={18} height={18} /> {t('calendar.scheduleOnDay')}
      </button>

      {pendingDelete ? (
        <Modal title={t('calendar.deleteTitle')} onClose={() => setPendingDelete(null)}>
          <p>{t('calendar.deleteBody')}</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void deleteSession(pendingDelete)
                setPendingDelete(null)
              }}
            >
              {t('calendar.deleteConfirm')}
            </button>
            <button type="button" className="btn btn--block" onClick={() => setPendingDelete(null)}>
              {t('calendar.keep')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function ScheduleModal({ dayKey, onClose }: { dayKey: DateKey; onClose(): void }) {
  const { t } = useT()
  const { plans, templates, planRoutines, scheduleSingleDate, scheduleWeekly, profile } = useStore()
  const visiblePlans = useMemo(() => programmingForAccount(plans, profile), [plans, profile])
  const visibleTemplates = useMemo(
    () => programmingForAccount(templates, profile),
    [templates, profile],
  )
  const routineGroups = useMemo(
    () => templatesGroupedByPlan(visiblePlans, visibleTemplates, planRoutines),
    [visiblePlans, visibleTemplates, planRoutines],
  )
  const [templateId, setTemplateId] = useState(
    () => routineGroups[0]?.templates[0]?.id ?? templates[0]?.id ?? '',
  )
  const [mode, setMode] = useState<'once' | 'weekly'>('once')
  const initialWeekday = isoWeekday(dayKey)
  const [weekdays, setWeekdays] = useState<number[]>([initialWeekday])
  const [startDate, setStartDate] = useState(dayKey)
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const WEEKDAYS = [
    { value: 1, label: t('weekdays.mon') },
    { value: 2, label: t('weekdays.tue') },
    { value: 3, label: t('weekdays.wed') },
    { value: 4, label: t('weekdays.thu') },
    { value: 5, label: t('weekdays.fri') },
    { value: 6, label: t('weekdays.sat') },
    { value: 7, label: t('weekdays.sun') },
  ]

  if (visibleTemplates.length === 0) {
    return (
      <Modal title={t('calendar.scheduleTitle')} onClose={onClose}>
        <EmptyState title={t('calendar.noRoutinesTitle')} hint={t('calendar.noRoutinesHint')} />
      </Modal>
    )
  }

  async function submit() {
    if (!templateId) {
      setError(t('calendar.chooseRoutine'))
      return
    }
    if (mode === 'weekly' && weekdays.length === 0) {
      setError(t('rotation.needWeekday'))
      return
    }
    if (endDate !== '' && endDate < startDate) {
      setError(t('calendar.endAfterStart'))
      return
    }
    try {
      if (mode === 'once') {
        await scheduleSingleDate(templateId, dayKey)
      } else {
        await scheduleWeekly(templateId, [...weekdays].sort((a, b) => a - b), startDate, endDate === '' ? null : endDate)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.schedule'))
      return
    }
    onClose()
  }

  return (
    <Modal title={t('calendar.scheduleTitle')} onClose={onClose}>
      <div className="field">
        <label htmlFor="schedule-routine">{t('calendar.routineLabel')}</label>
        <select
          id="schedule-routine"
          className="input"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {routineGroups.map((group) => {
            const options = group.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))
            if (routineGroups.length === 1) return options
            return (
              <optgroup
                key={group.plan?.id ?? 'unassigned'}
                label={group.plan?.name ?? t('routines.unassigned')}
              >
                {options}
              </optgroup>
            )
          })}
        </select>
      </div>

      <div className="row" role="group" aria-label={t('calendar.repeatMode')} style={{ marginBottom: '0.9rem' }}>
        {(['once', 'weekly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn--small ${mode === value ? 'btn--primary' : ''}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'once' ? t('calendar.once') : t('calendar.weekly')}
          </button>
        ))}
      </div>

      {mode === 'once' ? (
        <p className="muted">
          {t('calendar.onceHint', { when: `${formatDayShort(dayKey)}, ${dayKey}` })}
        </p>
      ) : (
        <>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{t('calendar.repeatOn')}</legend>
            <div className="row row--wrap">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`btn btn--small ${weekdays.includes(day.value) ? 'btn--primary' : ''}`}
                  aria-pressed={weekdays.includes(day.value)}
                  onClick={() =>
                    setWeekdays((prev) =>
                      prev.includes(day.value)
                        ? prev.filter((v) => v !== day.value)
                        : [...prev, day.value],
                    )
                  }
                >
                  {day.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="schedule-start">{t('calendar.startDate')}</label>
            <input
              id="schedule-start"
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value || dayKey)}
            />
          </div>
          <div className="field">
            <label htmlFor="schedule-end">{t('calendar.endDate')}</label>
            <input
              id="schedule-end"
              className="input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <p className="muted">
            {t('calendar.ruleEdits')}
          </p>
        </>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className="btn btn--primary btn--block" onClick={() => void submit()}>
        {t('calendar.save')}
      </button>
    </Modal>
  )
}
