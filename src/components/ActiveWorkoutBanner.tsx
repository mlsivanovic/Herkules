// Persistent bottom bar showing the active in-progress workout and rest countdown across tabs.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { formatDuration } from '../lib/units'
import { useRestTimer } from '../lib/restTimer'
import { IconPlay, IconTimer } from './Icons'
import { useT } from '../lib/i18n'
import './activeWorkoutBanner.css'

export function ActiveWorkoutBanner() {
  const { t } = useT()
  const { sessions } = useStore()
  const navigate = useNavigate()
  const { remaining: restRemaining } = useRestTimer()

  const active = sessions.find((s) => s.status === 'in_progress')
  const [elapsed, setElapsed] = useState(() =>
    active ? Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)) : 0,
  )

  useEffect(() => {
    if (!active) return
    const update = () => {
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)),
      )
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearTimeout(timer)
  }, [active])

  if (!active) return null

  return (
    <aside
      className="active-workout-banner"
      role="region"
      aria-label={t('activeBanner.title', { name: active.name })}
      onClick={() => void navigate('/workout')}
    >
      <div className="active-workout-banner__content">
        <span className="active-workout-banner__dot" aria-hidden="true" />
        <div className="active-workout-banner__info">
          <strong className="active-workout-banner__name">{active.name}</strong>
          <span className="active-workout-banner__meta">
            <span className="mono">{formatDuration(elapsed)}</span>
            {restRemaining !== null && restRemaining > 0 ? (
              <span className="active-workout-banner__rest">
                <IconTimer width={14} height={14} />
                <span className="mono">{formatDuration(restRemaining)}</span>
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="btn btn--small btn--primary active-workout-banner__btn"
        onClick={(e) => {
          e.stopPropagation()
          void navigate('/workout')
        }}
      >
        <IconPlay width={14} height={14} /> {t('activeBanner.resume')}
      </button>
    </aside>
  )
}
