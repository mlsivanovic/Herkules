// Daily tendon check-in card: morning stiffness and pain (0–10) per body
// site, logged on the Today dashboard. Trends live on the Progress page.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import { displayTendonSite, tendonSiteValue, useT } from '../lib/i18n'
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
  const { t } = useT()
  const store = useStore()
  const [date, setDate] = useState(todayKey())
  const [site, setSite] = useState('')
  const [stiffness, setStiffness] = useState('0')
  const [pain, setPain] = useState('0')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const [open, setOpen] = useState(false)

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
    const trimmed = tendonSiteValue(site.trim())
    if (trimmed === '') {
      setError(t('checkin.pickSite'))
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
      setError(caught instanceof Error ? caught.message : t('errors.saveCheckin'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`card stack checkin-card${open ? '' : ' checkin-card--collapsed'}`}>
      <button
        type="button"
        className="checkin-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <strong>{t('checkin.tendonTitle')}</strong>
        <span className="row">
          {existingForDate.length > 0 ? (
            <small className="muted">{t('checkin.todayCount', { count: existingForDate.length })}</small>
          ) : (
            <small className="muted">{t('common.optional')}</small>
          )}
          <span className="checkin-card__chevron" aria-hidden>
            {open ? '▴' : '▾'}
          </span>
        </span>
      </button>
      {open ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            {t('checkin.tendonHint')}
          </p>

          <div className="checkin-card__grid">
            <label className="field">
              <span>{t('common.date')}</span>
              <input
                className="input"
                type="date"
                max={todayKey()}
                value={date}
                onChange={(e) => setDate(e.target.value || todayKey())}
              />
            </label>
            <label className="field">
              <span>{t('checkin.site')}</span>
              <input
                className="input"
                type="text"
                list="tendon-sites"
                placeholder={t('checkin.sitePh')}
                maxLength={60}
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
              <datalist id="tendon-sites">
                {SITE_SUGGESTIONS.map((s) => (
                  <option key={s} value={displayTendonSite(s)} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>{t('checkin.stiffness')}</span>
              <select className="input" value={stiffness} onChange={(e) => setStiffness(e.target.value)}>
                {SCALE.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('checkin.pain')}</span>
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
            <span>{t('common.notes')}</span>
            <input
              className="input"
              type="text"
              placeholder={t('checkin.tendonNotesPh')}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="row row--between">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
              {busy ? t('common.saving') : t('checkin.saveCheckin')}
            </button>
            {savedAt > 0 ? (
              <small className="badge badge--completed" key={savedAt}>
                {t('common.saved')}
              </small>
            ) : null}
          </div>
          {error ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}

          {recent.length > 0 ? (
            <ul className="stack checkin-card__recent" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recent.map((row) => (
                <li key={row.id} className="row row--between">
                  <span>
                    <strong>{displayTendonSite(row.site)}</strong>{' '}
                    <small className="muted">
                      {row.recorded_on} · S {row.stiffness} / P {row.pain}
                      {row.notes ? ` · ${row.notes}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    aria-label={t('checkin.deleteCheckin', {
                      site: displayTendonSite(row.site),
                      date: row.recorded_on,
                    })}
                    onClick={() => void store.deleteCheckin(row.id)}
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
