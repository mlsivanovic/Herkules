// Public join page: peek an invite token, then sign in / accept.

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useStore } from '../lib/store'
import { peekCoachInvite } from '../lib/coachApi'
import { rememberPendingJoinToken } from '../lib/coachInvite'
import { backendConfigured, supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { BrandLogo } from '../components/BrandLogo'
import { Loader } from '../components/ui'
import { useT } from '../lib/i18n'
import './auth.css'

export function JoinInvite() {
  const { t } = useT()
  const { token = '' } = useParams()
  const { session, loading } = useAuth()
  const store = useStore()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [peek, setPeek] = useState<{
    valid: boolean
    email?: string
    display_name?: string
    trainer_name?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const autoAccept = useRef(false)

  useEffect(() => {
    if (!backendConfigured || !token) {
      setPeek({ valid: false })
      return
    }
    rememberPendingJoinToken(token)
    void peekCoachInvite(supabase(), token)
      .then(setPeek)
      .catch(() => setPeek({ valid: false }))
  }, [token])

  const acceptInvite = store.acceptInvite
  const storeReady = store.ready

  useEffect(() => {
    if (!session || !storeReady || !peek?.valid || !token || accepted || autoAccept.current) return
    autoAccept.current = true
    setBusy(true)
    setError(null)
    void acceptInvite(token)
      .then(() => {
        setAccepted(true)
        void navigate('/', { replace: true })
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : t('errors.joinAccept'))
      })
      .finally(() => setBusy(false))
  }, [session, storeReady, acceptInvite, peek, token, accepted, navigate, t])

  if (loading || peek === null) return <Loader label={t('common.loading')} />

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <BrandLogo theme={theme} size="auth" />
      </div>
      <div className="card auth-card">
        <h1>{t('join.title')}</h1>
        {!peek.valid ? (
          <p>{t('join.expired')}</p>
        ) : accepted ? (
          <p>{t('join.accepted')}</p>
        ) : (
          <>
            <p>{t('join.body', { trainer: peek.trainer_name || t('coach.title') })}</p>
            {peek.email ? <p className="muted">{t('join.as', { email: peek.email })}</p> : null}
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            {session ? (
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setError(null)
                  void store
                    .acceptInvite(token)
                    .then(() => {
                      setAccepted(true)
                      void navigate('/', { replace: true })
                    })
                    .catch((caught: unknown) => {
                      setError(caught instanceof Error ? caught.message : t('errors.joinAccept'))
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? t('join.connecting') : t('join.accept')}
              </button>
            ) : (
              <div className="stack">
                <Link className="btn btn--primary btn--block" to={`/login?next=/join/${token}`}>
                  {t('join.signIn')}
                </Link>
                <Link className="btn btn--block" to={`/signup?next=/join/${token}`}>
                  {t('join.signUp')}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
