import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { StoreProvider } from './lib/store'
import { AppLayout } from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loader } from './components/ui'
import { useT } from './lib/i18n'

function CheckingSession() {
  const { t } = useT()
  return <Loader label={t('common.checkingSession')} />
}
import { Login, ResetPassword, Signup, UpdatePassword } from './routes/Auth'
import { Today } from './routes/Today'
import { Calendar } from './routes/Calendar'
import { Routines } from './routes/Routines'
import { Exercises } from './routes/Exercises'
import { Progress } from './routes/Progress'
import { NotFound } from './routes/NotFound'

const History = lazy(() => import('./routes/History').then((m) => ({ default: m.History })))
const RoutineEditor = lazy(() => import('./routes/RoutineEditor').then((m) => ({ default: m.RoutineEditor })))
const PlanEditor = lazy(() => import('./routes/PlanEditor').then((m) => ({ default: m.PlanEditor })))
const StarterPreview = lazy(() =>
  import('./routes/StarterPreview').then((m) => ({ default: m.StarterPreview })),
)
const ExerciseEditor = lazy(() => import('./routes/ExerciseEditor').then((m) => ({ default: m.ExerciseEditor })))
const Workout = lazy(() => import('./routes/Workout').then((m) => ({ default: m.Workout })))
const HistoryDetail = lazy(() => import('./routes/HistoryDetail').then((m) => ({ default: m.HistoryDetail })))
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })))

/** Gate for everything behind a signed-in session. */
function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <CheckingSession />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <StoreProvider>
          <ErrorBoundary>
            <Suspense fallback={<Loader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/update-password" element={<UpdatePassword />} />

                <Route element={<RequireAuth />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Today />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/routines" element={<Routines />} />
                    <Route path="/routines/:id" element={<RoutineEditor />} />
                    <Route path="/starters/:sourceKey/:slot" element={<StarterPreview />} />
                    <Route path="/starters/:sourceKey" element={<StarterPreview />} />
                    <Route path="/plans/:id" element={<PlanEditor />} />
                    <Route path="/exercises" element={<Exercises />} />
                    <Route path="/exercises/:id" element={<ExerciseEditor />} />
                        <Route path="/progress" element={<Progress />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/history/:id" element={<HistoryDetail />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                  <Route path="/workout" element={<Workout />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </StoreProvider>
      </AuthProvider>
    </HashRouter>
  )
}
