// Email/password auth screens: login, signup, password reset request and
// the post-recovery password update.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { backendConfigured } from '../lib/supabase'
import { validateEmail, validatePassword } from '../lib/validation'
import { currentTheme } from '../lib/theme'
import { BrandLogo } from '../components/BrandLogo'
import './auth.css'

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <BrandLogo theme={currentTheme()} size="auth" />
      </div>
      <div className="card auth-card">{children}</div>
    </div>
  )
}

function BackendWarning() {
  if (backendConfigured) return null
  return (
    <p className="auth-notice">
      Supabase is not configured on this device. See SETUP.md to add your project URL and anon key.
    </p>
  )
}

export function Login() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    void navigate('/', { replace: true })
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
      <h1>Sign in</h1>
      <BackendWarning />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email</label>
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
          <label htmlFor="login-password">Password</label>
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: '1rem' }}>
        <Link to="/signup">Create an account</Link>
        <Link to="/reset-password">Forgot password?</Link>
      </div>
    </AuthCard>
  )
}

export function Signup() {
  const { signUp, session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)

  if (session) {
    void navigate('/', { replace: true })
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
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account,
          then sign in.
        </p>
        <Link to="/login" className="btn btn--primary btn--block">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1>Create account</h1>
      <BackendWarning />
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
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
          <label htmlFor="signup-password">Password (min 8 characters)</label>
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
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <div className="auth-links" style={{ marginTop: '1rem' }}>
        <span>
          Already have an account? <Link to="/login">Sign in</Link>
        </span>
      </div>
    </AuthCard>
  )
}

export function ResetPassword() {
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
      <h1>Reset password</h1>
      {sent ? (
        <>
          <p>
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Open it
            and choose a new password.
          </p>
          <Link to="/login" className="btn btn--primary btn--block">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <BackendWarning />
          <form onSubmit={(e) => void submit(e)} noValidate>
            <div className="field">
              <label htmlFor="reset-email">Email</label>
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
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <div className="auth-links" style={{ marginTop: '1rem' }}>
            <Link to="/login">Back to sign in</Link>
          </div>
        </>
      )}
    </AuthCard>
  )
}

export function UpdatePassword() {
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
      <h1>{passwordRecovery ? 'Choose a new password' : 'Change password'}</h1>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="new-password">New password (min 8 characters)</label>
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
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthCard>
  )
}
