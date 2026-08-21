import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, startOfWeek, todayKey } from '../lib/dates'
import { aerobicSecondsInWeek } from '../lib/prescription'
import { useT } from '../lib/i18n'

const TARGET_SECONDS = 150 * 60

export function AerobicGoal() {
  const { t } = useT()
  const store = useStore()
  const today = todayKey()
  const from = startOfWeek(today, store.profile?.week_start ?? 'monday')
  const to = addDays(from, 6)
  const seconds = useMemo(
    () => aerobicSecondsInWeek({ sessions: store.sessions, external: store.aerobicActivities, from, to }),
    [store.sessions, store.aerobicActivities, from, to],
  )
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<'walking' | 'cycling' | 'rowing' | 'other'>('walking')
  const [minutes, setMinutes] = useState('30')
  const percent = Math.min(100, Math.round((seconds / TARGET_SECONDS) * 100))

  return (
    <section className="card stack">
      <div className="row row--between">
        <span>
          <strong>{t('aerobic.title')}</strong>
          <small className="muted" style={{ display: 'block' }}>
            {t('aerobic.minutes', { done: Math.round(seconds / 60) })}
          </small>
        </span>
        <span className="badge badge--neutral">{percent}%</span>
      </div>
      <progress max={100} value={percent} aria-label={t('aerobic.percentAria', { percent })} />
      {open ? (
        <div className="stack">
          <div className="field-pair">
            <label className="field">
              <span>{t('aerobic.activity')}</span>
              <select className="input" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="walking">{t('aerobic.walking')}</option>
                <option value="cycling">{t('aerobic.cycling')}</option>
                <option value="rowing">{t('aerobic.rowing')}</option>
                <option value="other">{t('aerobic.other')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('aerobic.minutesLabel')}</span>
              <input className="input" type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>{t('common.date')}</span>
            <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                const value = Number(minutes)
                if (!Number.isFinite(value) || value <= 0) return
                void store.logAerobicActivity({ date, activityType: type, durationS: Math.round(value * 60) })
                setOpen(false)
              }}
            >
              {t('aerobic.save')}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--small" onClick={() => setOpen(true)}>
          {t('aerobic.log')}
        </button>
      )}
    </section>
  )
}
