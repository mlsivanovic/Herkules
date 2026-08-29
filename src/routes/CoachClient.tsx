// Client room: assigned plan, full logs (workouts, weight, aerobic), comments, push update.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { assignedFromTrainer } from '../lib/coachAssign'
import { addDays, formatDateLong, formatDateShort, startOfWeek, todayKey } from '../lib/dates'
import { EmptyState, Loader, Modal, StatusBadge } from '../components/ui'
import { LineChart } from '../components/Chart'
import {
  aerobicActivityLabel,
  displaySnapshotName,
  displayTendonSite,
  useT,
  type MessageKey,
} from '../lib/i18n'
import { DEFAULT_WEEKDAYS, type TrainingFrequency } from '../lib/programs/rotate'
import { aerobicGoalSeconds, resolveAerobicGoalMinutes } from '../lib/aerobicGoal'
import { aerobicSecondsInWeek } from '../lib/prescription'
import { formatLoggedSet } from '../lib/setDisplay'
import { sessionVolume } from '../lib/metrics'
import { formatDuration, formatGirth, formatWeight } from '../lib/units'
import { isBodyweightLoadExercise } from '../lib/bodyweightLoad'
import type {
  AerobicActivityRow,
  BodyMeasureRow,
  BodyWeightRow,
  SessionDoc,
  TendonCheckinRow,
} from '../types/db'
import './coach.css'

function durationOf(session: SessionDoc): number | null {
  if (!session.ended_at) return null
  return Math.max(
    0,
    Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000),
  )
}

const GIRTH_FIELDS: { key: MessageKey; read: (row: BodyMeasureRow) => number | null }[] = [
  { key: 'coach.measureNeck', read: (row) => row.neck_cm },
  { key: 'coach.measureWaist', read: (row) => row.waist_cm },
  { key: 'coach.measureHips', read: (row) => row.hip_cm },
  { key: 'coach.measureArm', read: (row) => row.arm_cm },
  { key: 'coach.measureThigh', read: (row) => row.thigh_cm },
  { key: 'coach.measureCalf', read: (row) => row.calf_cm },
]

export function CoachClient() {
  const { t } = useT()
  const { clientId = '' } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const snapshot = store.coachClient
  const trainerId = store.profile?.id ?? ''
  const units = store.profile?.unit_system ?? 'metric'
  const [assignOpen, setAssignOpen] = useState(false)
  const [planId, setPlanId] = useState(store.plans[0]?.id ?? '')
  const [withSchedule, setWithSchedule] = useState(false)
  const [weeks, setWeeks] = useState(4)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [commentSession, setCommentSession] = useState<string | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [openSessions, setOpenSessions] = useState<Record<string, boolean>>({})
  const [goalMinutes, setGoalMinutes] = useState('')

  useEffect(() => {
    void store.openCoachClient(clientId).catch(() => undefined)
    return () => store.clearCoachClient()
  }, [clientId, store.openCoachClient, store.clearCoachClient])

  useEffect(() => {
    if (!snapshot || snapshot.profile.id !== clientId) return
    setGoalMinutes(String(resolveAerobicGoalMinutes(snapshot.profile.aerobic_goal_minutes)))
  }, [clientId, snapshot])

  const assignedPlans = useMemo(
    () => (snapshot ? assignedFromTrainer(snapshot.plans, trainerId) : []),
    [snapshot, trainerId],
  )
  const assigned = assignedPlans[0] ?? null
  const masterBehind = Boolean(
    assigned?.source_plan_id &&
      store.plans.some(
        (plan) => plan.id === assigned.source_plan_id && plan.updated_at > (assigned.updated_at ?? ''),
      ),
  )

  const recent = useMemo(
    () => (snapshot ? snapshot.sessions.filter((row) => row.status !== 'in_progress') : []),
    [snapshot],
  )
  const weekStart = startOfWeek(todayKey(), snapshot?.profile.week_start ?? 'monday')
  const weekEnd = addDays(weekStart, 6)
  const weekAerobicSeconds = useMemo(
    () =>
      snapshot
        ? aerobicSecondsInWeek({
            sessions: snapshot.sessions,
            external: snapshot.aerobicActivities,
            from: weekStart,
            to: weekEnd,
          })
        : 0,
    [snapshot, weekEnd, weekStart],
  )
  const aerobicGoal = resolveAerobicGoalMinutes(snapshot?.profile.aerobic_goal_minutes)
  const aerobicPercent = Math.min(
    100,
    Math.round((weekAerobicSeconds / aerobicGoalSeconds(aerobicGoal)) * 100),
  )
  const weightPoints = useMemo(
    () =>
      [...(snapshot?.bodyWeights ?? [])]
        .slice()
        .reverse()
        .map((row) => ({ label: formatDateShort(row.recorded_on), value: row.weight_kg })),
    [snapshot],
  )

  if (!store.online) {
    return <EmptyState title={t('coach.needsConnection')} hint={t('errors.coachOffline')} />
  }
  if (store.coachBusy && !snapshot) return <Loader />
  if (!snapshot || snapshot.profile.id !== clientId) {
    return <EmptyState title={t('errors.coachLoad')} />
  }

  async function assign() {
    if (!planId) return
    setBusy(true)
    setError(null)
    try {
      await store.assignPlan(
        clientId,
        planId,
        withSchedule
          ? {
              frequency: 3 as TrainingFrequency,
              weekdays: DEFAULT_WEEKDAYS[3],
              startDate: new Date().toISOString().slice(0, 10),
              weeks,
            }
          : undefined,
      )
      setAssignOpen(false)
      setMessage(t('coach.updated'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.coachAssign'))
    } finally {
      setBusy(false)
    }
  }

  async function push() {
    if (!assigned?.source_plan_id) return
    setBusy(true)
    setError(null)
    try {
      const result = await store.pushAssignedPlan(clientId, assigned.source_plan_id)
      setMessage(result === 'replace' ? t('coach.replaceNeeded') : t('coach.updated'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.coachAssign'))
    } finally {
      setBusy(false)
    }
  }

  async function saveAerobicGoal() {
    const minutes = resolveAerobicGoalMinutes(Number(goalMinutes))
    setBusy(true)
    setError(null)
    try {
      await store.setClientAerobicGoal(clientId, minutes)
      setGoalMinutes(String(minutes))
      setMessage(t('coach.aerobicGoalSaved'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.coachAerobicGoal'))
    } finally {
      setBusy(false)
    }
  }

  function sessionOpen(id: string): boolean {
    if (id in openSessions) return openSessions[id]
    return recent[0]?.id === id
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <button type="button" className="btn btn--small" onClick={() => void navigate('/coach')}>
            {t('coach.back')}
          </button>
          <h1>{snapshot.profile.display_name || snapshot.profile.id.slice(0, 8)}</h1>
          <small className="muted">
            {snapshot.profile.account_kind === 'light' ? t('coach.athleteAccount') : t('coach.fullAccount')}
          </small>
        </div>
        <button type="button" className="btn btn--danger" onClick={() => setEndOpen(true)}>
          {t('coach.end')}
        </button>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="badge badge--completed">{message}</p> : null}

      <div className="section-title">{t('coach.assigned')}</div>
      {assigned ? (
        <div className="card stack">
          <strong>{assigned.name}</strong>
          {masterBehind ? <span className="badge badge--planned">{t('coach.behind')}</span> : null}
          <div className="row">
            <button type="button" className="btn btn--small" onClick={() => setAssignOpen(true)}>
              {t('coach.replace')}
            </button>
            <button type="button" className="btn btn--small btn--primary" disabled={busy} onClick={() => void push()}>
              {t('coach.pushUpdate')}
            </button>
          </div>
        </div>
      ) : (
        <EmptyState title={t('coach.noneAssigned')} />
      )}
      <button type="button" className="btn" style={{ marginTop: '0.75rem' }} onClick={() => setAssignOpen(true)}>
        {t('coach.assign')}
      </button>

      <div className="section-title">{t('coach.aerobicGoal')}</div>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          {t('coach.aerobicGoalHint')}
        </p>
        <progress
          className="coach-goal-progress"
          max={100}
          value={aerobicPercent}
          aria-label={t('aerobic.percentAria', { percent: aerobicPercent })}
        />
        <small className="muted">
          {t('coach.weekAerobic', { done: Math.round(weekAerobicSeconds / 60), goal: aerobicGoal })}
        </small>
        <div className="field">
          <label htmlFor="aerobic-goal-minutes">{t('coach.aerobicGoalMinutes')}</label>
          <input
            id="aerobic-goal-minutes"
            className="input"
            type="number"
            min={1}
            max={2000}
            inputMode="numeric"
            value={goalMinutes}
            onChange={(event) => setGoalMinutes(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !goalMinutes.trim()}
          onClick={() => void saveAerobicGoal()}
        >
          {t('coach.saveAerobicGoal')}
        </button>
      </div>

      <div className="section-title">{t('coach.sessions')}</div>
      {recent.length === 0 ? (
        <EmptyState title={t('history.emptyTitle')} />
      ) : (
        <div className="stack">
          {recent.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              comments={snapshot.comments.filter((row) => row.session_id === session.id)}
              units={units}
              open={sessionOpen(session.id)}
              commentOpen={commentSession === session.id}
              comment={comment}
              busy={busy}
              onToggle={() =>
                setOpenSessions((prev) => ({ ...prev, [session.id]: !sessionOpen(session.id) }))
              }
              onCommentChange={setComment}
              onOpenComment={() => setCommentSession(session.id)}
              onSendComment={() => {
                setBusy(true)
                void store
                  .commentOnSession(session.id, comment)
                  .then(() => {
                    setComment('')
                    setCommentSession(null)
                  })
                  .catch((caught: unknown) => {
                    setError(caught instanceof Error ? caught.message : t('errors.coachComment'))
                  })
                  .finally(() => setBusy(false))
              }}
            />
          ))}
        </div>
      )}

      <WeightsCard weights={snapshot.bodyWeights} points={weightPoints} units={units} />
      <AerobicCard activities={snapshot.aerobicActivities} />
      <MeasuresCard measures={snapshot.bodyMeasures} units={units} />
      <TendonCard checkins={snapshot.checkins} />

      {assignOpen ? (
        <Modal title={t('coach.pickPlan')} onClose={() => setAssignOpen(false)}>
          {store.plans.length === 0 ? (
            <EmptyState title={t('routines.noPlansTitle')} hint={t('routines.noPlansHint')} />
          ) : (
            <div className="stack">
              <div className="field">
                <label htmlFor="assign-plan">{t('coach.pickPlan')}</label>
                <select
                  id="assign-plan"
                  className="input"
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  {store.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="row">
                <input
                  type="checkbox"
                  checked={withSchedule}
                  onChange={(event) => setWithSchedule(event.target.checked)}
                />
                {t('coach.assignWithSchedule')}
              </label>
              {withSchedule ? (
                <div className="field">
                  <label htmlFor="assign-weeks">{t('coach.weeks')}</label>
                  <input
                    id="assign-weeks"
                    className="input"
                    type="number"
                    min={1}
                    max={16}
                    value={weeks}
                    onChange={(event) => setWeeks(Number(event.target.value) || 4)}
                  />
                </div>
              ) : null}
              <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => void assign()}>
                {t('coach.assign')}
              </button>
            </div>
          )}
        </Modal>
      ) : null}

      {endOpen ? (
        <Modal title={t('coach.end')} onClose={() => setEndOpen(false)}>
          <p>{t('coach.endConfirm')}</p>
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => {
              void store.endCoaching(snapshot.relationship.id).then(() => navigate('/coach'))
            }}
          >
            {t('coach.end')}
          </button>
        </Modal>
      ) : null}
    </div>
  )
}

function SessionCard({
  session,
  comments,
  units,
  open,
  commentOpen,
  comment,
  busy,
  onToggle,
  onCommentChange,
  onOpenComment,
  onSendComment,
}: {
  session: SessionDoc
  comments: { id: string; body: string }[]
  units: 'metric' | 'imperial'
  open: boolean
  commentOpen: boolean
  comment: string
  busy: boolean
  onToggle(): void
  onCommentChange(value: string): void
  onOpenComment(): void
  onSendComment(): void
}) {
  const { t } = useT()
  const duration = durationOf(session)
  const completedSets = session.session_exercises.reduce(
    (sum, se) => sum + se.sets.filter((set) => set.completed_at !== null).length,
    0,
  )
  const summary = [
    t('history.setsCount', { count: completedSets }),
    duration !== null ? formatDuration(duration) : null,
    session.session_exercises.length > 0 ? formatWeight(sessionVolume(session), units) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="card stack">
      <span className="row row--between">
        <strong>{session.name}</strong>
        <StatusBadge
          status={session.status === 'completed' ? 'completed' : session.status === 'skipped' ? 'skipped' : 'planned'}
        />
      </span>
      <small className="muted coach-session__meta">
        {formatDateLong(session.planned_date ?? session.started_at.slice(0, 10))}
        {summary ? ` · ${summary}` : ''}
      </small>
      {session.notes ? <p>{session.notes}</p> : null}
      {session.session_exercises.length > 0 ? (
        <button type="button" className="btn btn--small" onClick={onToggle} aria-expanded={open}>
          {open ? t('coach.hideSets') : t('coach.showSets')}
        </button>
      ) : null}
      {open ? (
        <div className="stack">
          {session.session_exercises.map((exercise) => {
            const bodyweightLoad = isBodyweightLoadExercise({
              id: exercise.exercise_id,
              name: exercise.name_snapshot,
            })
            return (
              <div key={exercise.id}>
                <strong>{displaySnapshotName(exercise.name_snapshot, exercise.exercise_id)}</strong>
                {exercise.sets.length === 0 ? (
                  <small className="muted" style={{ display: 'block' }}>
                    {t('history.noSets')}
                  </small>
                ) : (
                  <ol className="coach-sets">
                    {exercise.sets.map((set) => (
                      <li key={set.id}>
                        {set.is_warmup ? `${t('set.warmupTitle')}: ` : ''}
                        {formatLoggedSet(set, exercise.measurement_snapshot, units, bodyweightLoad)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
      {comments.length ? (
        <div>
          <div className="section-title">{t('coach.comments')}</div>
          {comments.map((row) => (
            <p key={row.id}>{row.body}</p>
          ))}
        </div>
      ) : null}
      {commentOpen ? (
        <div className="stack">
          <textarea
            className="input"
            rows={3}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder={t('coach.commentPlaceholder')}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!comment.trim() || busy}
            onClick={onSendComment}
          >
            {t('coach.sendComment')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--small" onClick={onOpenComment}>
          {t('coach.sendComment')}
        </button>
      )}
    </div>
  )
}

function WeightsCard({
  weights,
  points,
  units,
}: {
  weights: BodyWeightRow[]
  points: { label: string; value: number }[]
  units: 'metric' | 'imperial'
}) {
  const { t } = useT()
  return (
    <>
      <div className="section-title">{t('coach.weights')}</div>
      {weights.length === 0 ? (
        <EmptyState title={t('coach.noWeights')} />
      ) : (
        <div className="card stack">
          <LineChart
            points={points}
            formatValue={(value) => formatWeight(value, units)}
            ariaLabel={t('progress.bodyWeightAria')}
          />
          <ul className="coach-log">
            {weights.map((row) => (
              <li key={row.id} className="row row--between">
                <span>{formatDateShort(row.recorded_on)}</span>
                <strong>{formatWeight(row.weight_kg, units)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function AerobicCard({ activities }: { activities: AerobicActivityRow[] }) {
  const { t } = useT()
  return (
    <>
      <div className="section-title">{t('coach.aerobicLog')}</div>
      {activities.length === 0 ? (
        <EmptyState title={t('coach.noAerobic')} />
      ) : (
        <div className="card">
          <ul className="coach-log">
            {activities.map((row) => (
              <li key={row.id} className="row row--between">
                <span>
                  <strong>{aerobicActivityLabel(row.activity_type)}</strong>{' '}
                  <small className="muted">
                    {formatDateShort(row.recorded_on)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </small>
                </span>
                <span>{t('aerobic.entryMinutes', { minutes: Math.round(row.duration_s / 60) })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function MeasuresCard({
  measures,
  units,
}: {
  measures: BodyMeasureRow[]
  units: 'metric' | 'imperial'
}) {
  const { t } = useT()
  return (
    <>
      <div className="section-title">{t('coach.bodyMeasures')}</div>
      {measures.length === 0 ? (
        <EmptyState title={t('coach.noMeasures')} />
      ) : (
        <div className="card">
          <ul className="coach-log">
            {measures.map((row) => {
              const bits = GIRTH_FIELDS.flatMap((field) => {
                const value = field.read(row)
                if (value == null) return []
                return [`${t(field.key)} ${formatGirth(value, units)}`]
              })
              return (
                <li key={row.id}>
                  <strong>{formatDateShort(row.recorded_on)}</strong>
                  <small className="muted" style={{ display: 'block' }}>
                    {bits.join(' · ') || t('coach.noMeasures')}
                  </small>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}

function TendonCard({ checkins }: { checkins: TendonCheckinRow[] }) {
  const { t } = useT()
  return (
    <>
      <div className="section-title">{t('coach.tendonLog')}</div>
      {checkins.length === 0 ? (
        <EmptyState title={t('coach.noTendon')} />
      ) : (
        <div className="card">
          <ul className="coach-log">
            {checkins.map((row) => (
              <li key={row.id}>
                <strong>{displayTendonSite(row.site)}</strong>{' '}
                <small className="muted">
                  {t('progress.checkinLine', {
                    date: formatDateShort(row.recorded_on),
                    stiffness: row.stiffness,
                    pain: row.pain,
                  })}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
