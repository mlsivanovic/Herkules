import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { StoreProvider } from './lib/store'
import { AppLayout } from './components/AppLayout'
import { Loader } from './components/ui'
import { Login, ResetPassword, Signup, UpdatePassword } from './routes/Auth'
import { Today } from './routes/Today'
import { Calendar } from './routes/Calendar'
import { Routines } from './routes/Routines'
import { Exercises } from './routes/Exercises'
import { Progress } from './routes/Progress'
import { NotFound } from './routes/NotFound'

const RoutineEditor = lazy(() => import('./routes/RoutineEditor').then((m) => ({ default: m.RoutineEditor })))
const ExerciseEditor = lazy(() => import('./routes/ExerciseEditor').then((m) => ({ default: m.ExerciseEditor })))
const Workout = lazy(() => import('./routes/Workout').then((m) => ({ default: m.Workout })))
const HistoryDetail = lazy(() => import('./routes/HistoryDetail').then((m) => ({ default: m.HistoryDetail })))
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })))

/** Gate for everything behind a signed-in session. */
function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Loader label="Checking your session…" />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <StoreProvider>
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
                  <Route path="/exercises" element={<Exercises />} />
                  <Route path="/exercises/:id" element={<ExerciseEditor />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/history/:id" element={<HistoryDetail />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="/workout" element={<Workout />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </StoreProvider>
      </AuthProvider>
    </HashRouter>
  )
}
