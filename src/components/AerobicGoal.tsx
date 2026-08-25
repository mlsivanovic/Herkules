import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, formatDateShort, startOfWeek, todayKey } from '../lib/dates'
import { aerobicSecondsInWeek } from '../lib/prescription'
import { aerobicActivityLabel, aerobicActivityTypes, useT } from '../lib/i18n'
import { isAerobicActivityType, type AerobicActivityType } from '../types/db'
import { IconTrash } from './Icons'
import './tendonCheckin.css'

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
  const logged = useMemo(
    () =>
      [...store.aerobicActivities].sort((a, b) => {
        const byDate = b.recorded_on.localeCompare(a.recorded_on)
        return byDate !== 0 ? byDate : b.created_at.localeCompare(a.created_at)
      }),
    [store.aerobicActivities],
  )
  const [open, setOpen] = useState(false)
  const [logging, setLogging] = useState(false)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<AerobicActivityType>('walking')
  const [minutes, setMinutes] = useState('30')
  const percent = Math.min(100, Math.round((seconds / TARGET_SECONDS) * 100))
  const weekHint = t('aerobic.minutes', { done: Math.round(seconds / 60) })

  return (
    <section className={`card stack checkin-card${open ? '' : ' checkin-card--collapsed'}`}>
      <button
        type="button"
        className="checkin-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <strong>{t('aerobic.title')}</strong>
          <small className="muted" style={{ display: 'block' }}>
            {weekHint}
          </small>
        </span>
        <span className="row">
          <span className="badge badge--neutral">{percent}%</span>
          <span className="checkin-card__chevron" aria-hidden>
            {open ? '▴' : '▾'}
          </span>
        </span>
      </button>
      {open ? (
        <>
          <progress max={100} value={percent} aria-label={t('aerobic.percentAria', { percent })} />
          {logging ? (
            <div className="stack">
              <div className="field-pair">
                <label className="field">
                  <span>{t('aerobic.activity')}</span>
                  <select
                    className="input"
                    value={type}
                    onChange={(event) => {
                      const next = event.target.value
                      if (isAerobicActivityType(next)) setType(next)
                    }}
                  >
                    {aerobicActivityTypes().map((value) => (
                      <option key={value} value={value}>
                        {aerobicActivityLabel(value)}
                      </option>
                    ))}
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
                    setLogging(false)
                  }}
                >
                  {t('aerobic.save')}
                </button>
                <button type="button" className="btn" onClick={() => setLogging(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn--small" onClick={() => setLogging(true)}>
              {t('aerobic.log')}
            </button>
          )}
          {logged.length > 0 ? (
            <div className="stack">
              <small className="muted">{t('aerobic.logged')}</small>
              <ul className="stack checkin-card__recent" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {logged.map((row) => {
                  const activity = aerobicActivityLabel(row.activity_type)
                  const when = formatDateShort(row.recorded_on)
                  return (
                    <li key={row.id} className="row row--between">
                      <span>
                        <strong>{activity}</strong>{' '}
                        <small className="muted">
                          {when} · {t('aerobic.entryMinutes', { minutes: Math.round(row.duration_s / 60) })}
                        </small>
                      </span>
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        aria-label={t('aerobic.deleteActivity', { activity, date: when })}
                        onClick={() => void store.deleteAerobicActivity(row.id)}
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
