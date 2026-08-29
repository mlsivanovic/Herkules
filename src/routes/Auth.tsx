// Email/password auth screens: login, signup, password reset request and
// the post-recovery password update.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { backendConfigured } from '../lib/supabase'
import { isJoinPath, rememberPendingJoinToken, tokenFromJoinPath } from '../lib/coachInvite'
import { validateEmail, validatePassword } from '../lib/validation'
import { useTheme } from '../lib/theme'
import { BrandLogo } from '../components/BrandLogo'
import { useT } from '../lib/i18n'
import './auth.css'

function AuthCard({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <BrandLogo theme={theme} size="auth" />
      </div>
      <div className="card auth-card">{children}</div>
    </div>
  )
}

function BackendWarning() {
  const { t } = useT()
  if (backendConfigured) return null
  return <p className="auth-notice">{t('auth.backendMissing')}</p>
}

function nextPath(raw: string | null): string {
  if (isJoinPath(raw)) return raw
  return '/'
}

function rememberJoinNext(path: string): void {
  const token = tokenFromJoinPath(path)
  if (token) rememberPendingJoinToken(token)
}

export function Login() {
  const { t } = useT()
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = nextPath(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    rememberJoinNext(next)
  }, [next])

  if (session) {
    void navigate(next, { replace: true })
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateEmail(email) ?? validatePassword(password)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(await signIn(email, password))
    setBusy(false)
  }

  return (
    <AuthCard>
      <h1>{t('auth.signIn')}</h1>
      <BackendWarning />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="login-email">{t('auth.email')}</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">{t('auth.password')}</label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: '1rem' }}>
        <Link to={next === '/' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`}>
          {t('auth.createLink')}
        </Link>
        <Link to="/reset-password">{t('auth.forgot')}</Link>
      </div>
    </AuthCard>
  )
}

export function Signup() {
  const { t } = useT()
  const { signUp, session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = nextPath(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const loginHref = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`

  useEffect(() => {
    rememberJoinNext(next)
  }, [next])

  if (session) {
    void navigate(next, { replace: true })
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateEmail(email) ?? validatePassword(password)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    const result = await signUp(email, password)
    setBusy(false)
    if (result) {
      setError(result)
      return
    }
    setError(null)
    setNeedsConfirmation(true)
  }

  if (needsConfirmation) {
    return (
      <AuthCard>
        <h1>{t('auth.checkEmail')}</h1>
        <p>{t('auth.sentConfirm', { email })}</p>
        <Link to={loginHref} className="btn btn--primary btn--block">
          {t('auth.backToSignIn')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1>{t('auth.createAccount')}</h1>
      <BackendWarning />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="signup-email">{t('auth.email')}</label>
          <input
            id="signup-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">{t('auth.passwordMin')}</label>
          <input
            id="signup-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? t('auth.creating') : t('auth.createAccount')}
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: '1rem' }}>
        <span>
          {t('auth.alreadyHave')} <Link to={loginHref}>{t('auth.signIn')}</Link>
        </span>
      </div>
    </AuthCard>
  )
}

export function ResetPassword() {
  const { t } = useT()
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateEmail(email)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    const result = await requestPasswordReset(email)
    setBusy(false)
    if (result) {
      setError(result)
      return
    }
    setError(null)
    setSent(true)
  }

  return (
    <AuthCard>
      <h1>{t('auth.reset')}</h1>
      {sent ? (
        <>
          <p>{t('auth.sentReset', { email })}</p>
          <Link to="/login" className="btn btn--primary btn--block">
            {t('auth.backToSignIn')}
          </Link>
        </>
      ) : (
        <>
          <BackendWarning />
          <form onSubmit={(e) => void submit(e)} noValidate>
            <div className="field">
              <label htmlFor="reset-email">{t('auth.email')}</label>
              <input
                id="reset-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? t('auth.sending') : t('auth.sendReset')}
            </button>
          </form>
          <div className="auth-links" style={{ marginTop: '1rem' }}>
            <Link to="/login">{t('auth.backToSignIn')}</Link>
          </div>
        </>
      )}
    </AuthCard>
  )
}

export function UpdatePassword() {
  const { t } = useT()
  const { updatePassword, session, passwordRecovery, clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!session) {
    void navigate('/login', { replace: true })
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validatePassword(password)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    const result = await updatePassword(password)
    setBusy(false)
    if (result) {
      setError(result)
      return
    }
    clearPasswordRecovery()
    void navigate('/', { replace: true })
  }

  return (
    <AuthCard>
      <h1>{passwordRecovery ? t('auth.chooseNew') : t('auth.changePassword')}</h1>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="new-password">{t('auth.newPasswordMin')}</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? t('common.saving') : t('auth.savePassword')}
        </button>
      </form>
    </AuthCard>
  )
}
