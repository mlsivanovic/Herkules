import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, backendConfigured } from './supabase'

export interface AuthState {
  session: Session | null
  loading: boolean
  /** True right after a recovery link opens the app, until the new password is saved. */
  passwordRecovery: boolean
  clearPasswordRecovery(): void
  signUp(email: string, password: string): Promise<string | null>
  signIn(email: string, password: string): Promise<string | null>
  requestPasswordReset(email: string): Promise<string | null>
  updatePassword(password: string): Promise<string | null>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function describeError(error: { message: string } | null): string | null {
  if (!error) return null
  if (error.message.includes('Failed to fetch')) {
    return 'No connection to the server — check your internet and try again.'
  }
  return error.message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(backendConfigured)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!backendConfigured) return
    const auth = supabase().auth

    void auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setPasswordRecovery(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    session,
    loading,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    async signUp(email, password) {
      const redirect = window.location.origin + import.meta.env.BASE_URL
      const { error } = await supabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirect },
      })
      return describeError(error)
    },
    async signIn(email, password) {
      const { error } = await supabase().auth.signInWithPassword({ email, password })
      return describeError(error)
    },
    async requestPasswordReset(email) {
      const redirect = window.location.origin + import.meta.env.BASE_URL
      const { error } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: redirect,
      })
      return describeError(error)
    },
    async updatePassword(password) {
      const { error } = await supabase().auth.updateUser({ password })
      return describeError(error)
    },
    async signOut() {
      await supabase().auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
