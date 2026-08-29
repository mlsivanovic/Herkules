// Client room: assigned plan, history, measurements, comments, push update.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { assignedFromTrainer } from '../lib/coachAssign'
import { formatDateLong } from '../lib/dates'
import { EmptyState, Loader, Modal, StatusBadge } from '../components/ui'
import { useT } from '../lib/i18n'
import { DEFAULT_WEEKDAYS, type TrainingFrequency } from '../lib/programs/rotate'

export function CoachClient() {
  const { t } = useT()
  const { clientId = '' } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const snapshot = store.coachClient
  const trainerId = store.profile?.id ?? ''
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

  useEffect(() => {
    void store.openCoachClient(clientId).catch(() => undefined)
    return () => store.clearCoachClient()
  }, [clientId, store.openCoachClient, store.clearCoachClient])

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

  if (!store.online) {
    return <EmptyState title={t('coach.needsConnection')} hint={t('errors.coachOffline')} />
  }
  if (store.coachBusy && !snapshot) return <Loader />
  if (!snapshot || snapshot.profile.id !== clientId) {
    return <EmptyState title={t('errors.coachLoad')} />
  }

  const recent = snapshot.sessions.filter((row) => row.status !== 'in_progress').slice(0, 12)

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

      <div className="section-title">{t('coach.sessions')}</div>
      {recent.length === 0 ? (
        <EmptyState title={t('history.emptyTitle')} />
      ) : (
        <div className="stack">
          {recent.map((session) => {
            const notes = snapshot.comments.filter((row) => row.session_id === session.id)
            return (
              <div key={session.id} className="card stack">
                <span className="row row--between">
                  <strong>{session.name}</strong>
                  <StatusBadge
                    status={session.status === 'completed' ? 'completed' : session.status === 'skipped' ? 'skipped' : 'planned'}
                  />
                </span>
                <small className="muted">{formatDateLong(session.planned_date ?? session.started_at.slice(0, 10))}</small>
                {session.notes ? <p>{session.notes}</p> : null}
                {notes.length ? (
                  <div>
                    <div className="section-title">{t('coach.comments')}</div>
                    {notes.map((row) => (
                      <p key={row.id}>{row.body}</p>
                    ))}
                  </div>
                ) : null}
                {commentSession === session.id ? (
                  <div className="stack">
                    <textarea
                      className="input"
                      rows={3}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={t('coach.commentPlaceholder')}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!comment.trim() || busy}
                      onClick={() => {
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
                    >
                      {t('coach.sendComment')}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn--small" onClick={() => setCommentSession(session.id)}>
                    {t('coach.sendComment')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="section-title">{t('coach.measurements')}</div>
      <div className="card stack">
        <span>
          {t('coach.weight')}:{' '}
          {snapshot.bodyWeights[0] ? `${snapshot.bodyWeights[0].weight_kg} kg · ${snapshot.bodyWeights[0].recorded_on}` : t('coach.never')}
        </span>
        <span>
          {t('aerobic.title')}: {snapshot.aerobicActivities[0]?.recorded_on ?? t('coach.never')}
        </span>
      </div>

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
