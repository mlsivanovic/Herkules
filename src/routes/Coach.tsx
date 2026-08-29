// Coach roster: pending invites + active clients (online-only).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { invitePath } from '../lib/coachInvite'
import { EmptyState, Loader, Modal } from '../components/ui'
import { IconPlus } from '../components/Icons'
import { validateEmail } from '../lib/validation'
import { useT } from '../lib/i18n'
import { todayKey } from '../lib/dates'

export function Coach() {
  const { t } = useT()
  const store = useStore()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void store.refreshCoachRoster().catch(() => undefined)
  }, [store.refreshCoachRoster])

  if (!store.ready) return <Loader />
  if (!store.online) {
    return <EmptyState title={t('coach.needsConnection')} hint={t('errors.coachOffline')} />
  }

  const clients = store.coachRoster ?? []
  const invites = store.coachInvites
  const empty = clients.length === 0 && invites.length === 0

  async function createInvite() {
    const invalid = validateEmail(email)
    if (invalid) {
      setInviteError(invalid)
      return
    }
    setBusy(true)
    setInviteError(null)
    try {
      const result = await store.createClientInvite({ email, displayName: name })
      const url = `${window.location.origin}${import.meta.env.BASE_URL}#${result.path}`
      await navigator.clipboard.writeText(url)
      setCopiedId('new')
      setEmail('')
      setName('')
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : t('errors.coachInvite'))
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite(tokenPath: string, id: string) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}#${tokenPath}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('coach.title')}</h1>
        <button type="button" className="btn btn--primary" onClick={() => setInviteOpen(true)}>
          <IconPlus width={18} height={18} /> {t('coach.newClient')}
        </button>
      </div>

      {store.coachError ? (
        <p className="field-error" role="alert">
          {store.coachError}
        </p>
      ) : null}
      {store.coachBusy && empty ? <Loader /> : null}

      {empty && !store.coachBusy ? (
        <EmptyState title={t('coach.emptyTitle')} hint={t('coach.emptyHint')} />
      ) : null}

      {invites.length > 0 ? (
        <div className="stack">
          <div className="section-title">{t('coach.pending')}</div>
          {invites.map((invite) => {
            const path = store.lastInviteToken && copiedId === 'new' ? invitePath(store.lastInviteToken) : null
            return (
              <div key={invite.id} className="card stack">
                <strong>{invite.display_name || invite.email}</strong>
                <small className="muted">{invite.email}</small>
                <div className="row">
                  {path ? (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => void copyInvite(path, invite.id)}
                    >
                      {copiedId === invite.id ? t('coach.copied') : t('coach.copyLink')}
                    </button>
                  ) : (
                    <small className="muted">{t('coach.inviteHint')}</small>
                  )}
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={() => void store.revokeInvite(invite.id)}
                  >
                    {t('coach.revoke')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {clients.length > 0 ? (
        <div className="stack" style={{ marginTop: '1rem' }}>
          <div className="section-title">{t('coach.active')}</div>
          {clients.map((entry) => {
            const stale =
              !entry.lastSessionAt ||
              entry.lastSessionAt.slice(0, 10) <
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            const dueToday = entry.plannedThisWeek > 0
            return (
              <Link key={entry.relationship.id} to={`/coach/${entry.profile.id}`} className="card">
                <span className="row row--between">
                  <span>
                    <strong>{entry.profile.display_name || t('coach.title')}</strong>{' '}
                    <span className="badge badge--neutral">
                      {entry.profile.account_kind === 'light'
                        ? t('coach.lightAccount')
                        : t('coach.fullAccount')}
                    </span>
                    {entry.finishedSinceViewed ? (
                      <span className="badge badge--completed"> {t('coach.finished')}</span>
                    ) : null}
                    {stale ? <span className="badge badge--skipped"> {t('coach.stale')}</span> : null}
                    <small className="muted" style={{ display: 'block' }}>
                      {t('coach.lastWorkout')}:{' '}
                      {entry.lastSessionAt ? entry.lastSessionAt.slice(0, 10) : t('coach.never')}
                      {' · '}
                      {t('coach.week', { done: entry.completedThisWeek, planned: entry.plannedThisWeek })}
                    </small>
                  </span>
                </span>
                {dueToday && todayKey() ? null : null}
              </Link>
            )
          })}
        </div>
      ) : null}

      {inviteOpen ? (
        <Modal title={t('coach.newClient')} onClose={() => setInviteOpen(false)}>
          <p className="muted">{t('coach.inviteHint')}</p>
          <div className="field">
            <label htmlFor="invite-name">{t('coach.displayName')}</label>
            <input
              id="invite-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="invite-email">{t('coach.email')}</label>
            <input
              id="invite-email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {inviteError ? (
            <p className="field-error" role="alert">
              {inviteError}
            </p>
          ) : null}
          {store.lastInviteToken ? (
            <p className="badge badge--completed">
              {t('coach.inviteReady', { email })}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void createInvite()}
          >
            {t('coach.sendInvite')}
          </button>
        </Modal>
      ) : null}
    </div>
  )
}
