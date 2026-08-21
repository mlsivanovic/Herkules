// Calendar: month view with per-day statuses (planned / in-progress /
// completed / skipped), scheduling single dates or weekly recurrences.
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
import { nextTemplateForPlan } from '../lib/programs/plans'
import './calendar.css'

const WEEKDAY_LABELS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LABELS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Calendar() {
  const navigate = useNavigate()
  const { schedules, rules, templates, sessions, profile, ready } = useStore()
  const weekStart = profile?.week_start ?? 'monday'
  const today = todayKey()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<DateKey | null>(null)
  const [schedulerFor, setSchedulerFor] = useState<DateKey | null>(null)

  const grid = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart])
  const weekdayLabels = weekStart === 'monday' ? WEEKDAY_LABELS_MON : WEEKDAY_LABELS_SUN

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

  return (
    <div>
      <div className="page-head">
        <h1>Calendar</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setSchedulerFor(selectedDay ?? today)}
        >
          <IconPlus width={18} height={18} /> Schedule
        </button>
      </div>

      <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
        <button
          type="button"
          className="btn btn--icon"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <IconChevronLeft />
        </button>
        <h2 style={{ margin: 0 }}>{formatMonthLabel(year, month)}</h2>
        <button
          type="button"
          className="btn btn--icon"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label="Workout calendar">
        {weekdayLabels.map((label) => (
          <div key={label} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}
        {grid.map((key) => {
          const inMonth = parseDateKey(key).getMonth() === month
          const status = statusByDate.get(key)
          const plannedCount = plannedByDate.get(key)?.length ?? 0
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={`calendar-day ${inMonth ? '' : 'calendar-day--outside'} ${
                key === today ? 'calendar-day--today' : ''
              } ${status ? `calendar-day--${status}` : ''}`}
              aria-label={`${key}${status ? `, ${status.replace('-', ' ')}` : ''}${
                plannedCount > 0 ? `, ${plannedCount} planned` : ''
              }`}
              aria-current={key === today ? 'date' : undefined}
              onClick={() => setSelectedDay(key)}
            >
              <span className="calendar-day-num">{Number(key.slice(8))}</span>
              {status ? <span className="calendar-dot" aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>

      <div className="calendar-legend" aria-hidden="true">
        <span><i className="calendar-dot calendar-dot--planned" /> Planned</span>
        <span><i className="calendar-dot calendar-dot--in-progress" /> In progress</span>
        <span><i className="calendar-dot calendar-dot--completed" /> Completed</span>
        <span><i className="calendar-dot calendar-dot--skipped" /> Skipped</span>
      </div>

      {selectedDay ? (
        <Modal title={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(parseDateKey(selectedDay))} onClose={() => setSelectedDay(null)}>
          <DayDetail
            dayKey={selectedDay}
            planned={(plannedByDate.get(selectedDay) ?? []).map((o) => ({
              scheduleId: o.scheduleId,
              template: o.templateId
                ? templateById.get(o.templateId)
                : o.planId
                  ? nextTemplateForPlan(o.planId, templates, sessions) ?? undefined
                  : undefined,
            }))}
            sessions={selectedSessions}
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
  onStart,
  onSchedule,
}: {
  dayKey: DateKey
  planned: { scheduleId: string; template: { id: string; name: string } | undefined }[]
  sessions: { id: string; name: string; status: string; schedule_item_id: string | null }[]
  onStart(templateId: string, scheduleId: string): void
  onSchedule(): void
}) {
  const { deleteSchedule, deleteSession, skipOccurrence, unskipOccurrence } = useStore()
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  return (
    <div className="stack">
      {planned.length === 0 && sessions.length === 0 ? (
        <EmptyState title="Nothing planned" hint="Schedule a routine for this day." />
      ) : null}

      {planned.map((entry) => {
        const match = sessions.find((s) => s.schedule_item_id === entry.scheduleId)
        const skipped = match?.status === 'skipped'
        const completed = match?.status === 'completed'
        const label = completed ? 'completed' : skipped ? 'skipped' : dayKey < todayKey() ? 'skipped' : 'planned'
        return (
          <div key={entry.scheduleId} className="card row row--between">
            <span>
              <strong>{entry.template?.name ?? 'Routine'}</strong>{' '}
              <small className="muted">· {label}</small>
            </span>
            <span className="row">
              {!completed && dayKey >= todayKey() ? (
                <button
                  type="button"
                  className="btn btn--small btn--primary"
                  onClick={() => entry.template && onStart(entry.template.id, entry.scheduleId)}
                >
                  Start
                </button>
              ) : null}
              {!completed && !skipped && !match ? (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void skipOccurrence(entry.scheduleId, dayKey)}
                >
                  Skip
                </button>
              ) : null}
              {skipped && match ? (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => void unskipOccurrence(match.id)}
                >
                  Undo skip
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--small btn--danger"
                aria-label={`Unschedule ${entry.template?.name ?? 'routine'}`}
                onClick={() => void deleteSchedule(entry.scheduleId)}
              >
                Remove
              </button>
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
                aria-label={`Delete ${session.name}`}
                onClick={() => setPendingDelete(session.id)}
              >
                <IconTrash width={16} height={16} />
              </button>
            ) : null}
          </div>
        )
      })}

      <button type="button" className="btn btn--block" onClick={onSchedule}>
        <IconPlus width={18} height={18} /> Schedule a routine on this day
      </button>

      {pendingDelete ? (
        <Modal title="Delete this workout?" onClose={() => setPendingDelete(null)}>
          <p>This removes the logged workout from history. The routine itself stays in your library.</p>
          <div className="stack">
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                void deleteSession(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete workout
            </button>
            <button type="button" className="btn btn--block" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function ScheduleModal({ dayKey, onClose }: { dayKey: DateKey; onClose(): void }) {
  const { templates, scheduleSingleDate, scheduleWeekly } = useStore()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [mode, setMode] = useState<'once' | 'weekly'>('once')
  const initialWeekday = isoWeekday(dayKey)
  const [weekdays, setWeekdays] = useState<number[]>([initialWeekday])
  const [startDate, setStartDate] = useState(dayKey)
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const WEEKDAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
  ]

  if (templates.length === 0) {
    return (
      <Modal title="Schedule workout" onClose={onClose}>
        <EmptyState title="No routines yet" hint="Create a routine first, then schedule it here." />
      </Modal>
    )
  }

  async function submit() {
    if (!templateId) {
      setError('Choose a routine.')
      return
    }
    if (mode === 'weekly' && weekdays.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    if (endDate !== '' && endDate < startDate) {
      setError('End date must be after the start date.')
      return
    }
    try {
      if (mode === 'once') {
        await scheduleSingleDate(templateId, dayKey)
      } else {
        await scheduleWeekly(templateId, [...weekdays].sort((a, b) => a - b), startDate, endDate === '' ? null : endDate)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not schedule the workout.')
      return
    }
    onClose()
  }

  return (
    <Modal title="Schedule workout" onClose={onClose}>
      <div className="field">
        <label htmlFor="schedule-routine">Routine</label>
        <select
          id="schedule-routine"
          className="input"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row" role="group" aria-label="Repeat mode" style={{ marginBottom: '0.9rem' }}>
        {(['once', 'weekly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn--small ${mode === value ? 'btn--primary' : ''}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'once' ? 'Once' : 'Weekly'}
          </button>
        ))}
      </div>

      {mode === 'once' ? (
        <p className="muted">
          Schedules <strong>{formatDayShort(dayKey)}, {dayKey}</strong> only.
        </p>
      ) : (
        <>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Repeat on</legend>
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
            <label htmlFor="schedule-start">Start date</label>
            <input
              id="schedule-start"
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value || dayKey)}
            />
          </div>
          <div className="field">
            <label htmlFor="schedule-end">End date (optional)</label>
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
            Rule edits affect only future workouts — completed history stays untouched.
          </p>
        </>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="button" className="btn btn--primary btn--block" onClick={() => void submit()}>
        Schedule
      </button>
    </Modal>
  )
}
