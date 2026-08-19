// Daily tendon check-in card: morning stiffness and pain (0–10) per body
// site, logged on the Today dashboard. Trends live on the Progress page.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import { IconTrash } from './Icons'
import './tendonCheckin.css'

const SITE_SUGGESTIONS = [
  'Knee L',
  'Knee R',
  'Shoulder L',
  'Shoulder R',
  'Elbow L',
  'Elbow R',
  'Achilles L',
  'Achilles R',
  'Wrist L',
  'Wrist R',
  'Hip',
  'Lower back',
]

const SCALE = Array.from({ length: 11 }, (_, i) => i)

export function TendonCheckin() {
  const store = useStore()
  const [date, setDate] = useState(todayKey())
  const [site, setSite] = useState('')
  const [stiffness, setStiffness] = useState('0')
  const [pain, setPain] = useState('0')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(0)

  const recent = useMemo(
    () =>
      [...store.checkins]
        .sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : a.recorded_on > b.recorded_on ? -1 : 0))
        .slice(0, 5),
    [store.checkins],
  )

  const existingForDate = useMemo(
    () => store.checkins.filter((row) => row.recorded_on === date),
    [store.checkins, date],
  )

  async function save() {
    const trimmed = site.trim()
    if (trimmed === '') {
      setError('Pick a body site first (e.g. Knee L).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await store.logCheckin({
        date,
        site: trimmed,
        stiffness: Math.max(0, Math.min(10, Number(stiffness) || 0)),
        pain: Math.max(0, Math.min(10, Number(pain) || 0)),
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      setSite('')
      setNotes('')
      setSavedAt(Date.now())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the check-in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack tendon-checkin">
      <div className="row row--between">
        <strong>Tendon check-in</strong>
        {existingForDate.length > 0 ? (
          <small className="muted">{existingForDate.length} today</small>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Morning stiffness and pain per site, 0 (none) – 10 (worst). Helps you see load tolerance
        trends next to your training.
      </p>

      <div className="tendon-checkin__grid">
        <label className="field">
          <span>Date</span>
          <input
            className="input"
            type="date"
            max={todayKey()}
            value={date}
            onChange={(e) => setDate(e.target.value || todayKey())}
          />
        </label>
        <label className="field">
          <span>Site</span>
          <input
            className="input"
            type="text"
            list="tendon-sites"
            placeholder="e.g. Knee L"
            maxLength={60}
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
          <datalist id="tendon-sites">
            {SITE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Stiffness</span>
          <select className="input" value={stiffness} onChange={(e) => setStiffness(e.target.value)}>
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Pain</span>
          <select className="input" value={pain} onChange={(e) => setPain(e.target.value)}>
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Notes (optional)</span>
        <input
          className="input"
          type="text"
          placeholder="e.g. stiff after yesterday's squats"
          maxLength={200}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="row row--between">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save check-in'}
        </button>
        {savedAt > 0 ? (
          <small className="badge badge--completed" key={savedAt}>
            Saved
          </small>
        ) : null}
      </div>
      {error ? (
        <p className="field-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="stack tendon-checkin__recent" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recent.map((row) => (
            <li key={row.id} className="row row--between">
              <span>
                <strong>{row.site}</strong>{' '}
                <small className="muted">
                  {row.recorded_on} · S {row.stiffness} / P {row.pain}
                  {row.notes ? ` · ${row.notes}` : ''}
                </small>
              </span>
              <button
                type="button"
                className="btn btn--small btn--danger"
                aria-label={`Delete check-in for ${row.site} on ${row.recorded_on}`}
                onClick={() => void store.deleteCheckin(row.id)}
              >
                <IconTrash width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
