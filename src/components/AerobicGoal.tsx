import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, startOfWeek, todayKey } from '../lib/dates'
import { aerobicSecondsInWeek } from '../lib/prescription'

const TARGET_SECONDS = 150 * 60

export function AerobicGoal() {
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
          <strong>Aerobic goal</strong>
          <small className="muted" style={{ display: 'block' }}>
            {Math.round(seconds / 60)} / 150 moderate minutes this week
          </small>
        </span>
        <span className="badge badge--neutral">{percent}%</span>
      </div>
      <progress max={100} value={percent} aria-label={`${percent}% of weekly aerobic goal`} />
      {open ? (
        <div className="stack">
          <div className="field-pair">
            <label className="field">
              <span>Activity</span>
              <select className="input" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
                <option value="rowing">Rowing</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span>Minutes</span>
              <input className="input" type="number" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Date</span>
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
              Save activity
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--small" onClick={() => setOpen(true)}>
          Log walking, cycling or other activity
        </button>
      )}
    </section>
  )
}
