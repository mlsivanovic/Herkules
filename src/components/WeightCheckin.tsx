// Daily body-weight check-in on the Today dashboard. One entry per date;
// picking another date loads or updates that day's weigh-in. Trends stay
// on Progress; Settings still has the fuller list and BMI.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import { parseNonNegative } from '../lib/validation'
import {
  formatWeight,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { useT } from '../lib/i18n'
import { IconTrash } from './Icons'
import './tendonCheckin.css'

export function WeightCheckin() {
  const { t } = useT()
  const store = useStore()
  const units = store.profile?.unit_system ?? 'metric'
  const today = todayKey()
  const [date, setDate] = useState(today)
  const [weightInput, setWeightInput] = useState(() => {
    const existing = store.bodyWeights.find((row) => row.recorded_on === today)
    return existing ? weightForInput(existing.weight_kg, units) : ''
  })
  const [notes, setNotes] = useState(() => {
    const existing = store.bodyWeights.find((row) => row.recorded_on === today)
    return existing?.notes ?? ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const [open, setOpen] = useState(false)

  const sorted = useMemo(
    () =>
      [...store.bodyWeights].sort((a, b) =>
        a.recorded_on < b.recorded_on ? 1 : a.recorded_on > b.recorded_on ? -1 : 0,
      ),
    [store.bodyWeights],
  )
  const existing = sorted.find((row) => row.recorded_on === date) ?? null
  const todayEntry = sorted.find((row) => row.recorded_on === today) ?? null
  const latest = sorted[0] ?? null

  function applyDate(next: string) {
    const key = next || today
    setDate(key)
    const row = store.bodyWeights.find((entry) => entry.recorded_on === key)
    setWeightInput(row ? weightForInput(row.weight_kg, units) : '')
    setNotes(row?.notes ?? '')
    setError(null)
  }

  async function save() {
    const parsed = parseNonNegative(weightInput)
    if (parsed === null || parsed === 0) {
      setError(t('checkin.enterWeight', { unit: weightUnitLabel(units) }))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await store.logWeight(
        date,
        weightToKg(parsed, units),
        notes.trim() === '' ? null : notes.trim(),
      )
      setSavedAt(Date.now())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errors.saveWeighIn'))
    } finally {
      setBusy(false)
    }
  }

  const headerHint = todayEntry
    ? formatWeight(todayEntry.weight_kg, units)
    : latest
      ? t('checkin.last', { value: formatWeight(latest.weight_kg, units) })
      : t('common.optional')

  return (
    <div className={`card stack checkin-card${open ? '' : ' checkin-card--collapsed'}`}>
      <button
        type="button"
        className="checkin-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <strong>{t('checkin.weightTitle')}</strong>
        <span className="row">
          <small className="muted">{headerHint}</small>
          <span className="checkin-card__chevron" aria-hidden>
            {open ? '▴' : '▾'}
          </span>
        </span>
      </button>
      {open ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            {t('checkin.weightHint')}
          </p>

          <div className="checkin-card__grid">
            <label className="field" htmlFor="weight-checkin-date">
              <span>{t('common.date')}</span>
              <input
                id="weight-checkin-date"
                className="input"
                type="date"
                max={today}
                value={date}
                onChange={(e) => applyDate(e.target.value)}
              />
            </label>
            <label className="field" htmlFor="weight-checkin-weight">
              <span>{t('checkin.weight', { unit: weightUnitLabel(units) })}</span>
              <input
                id="weight-checkin-weight"
                className="input"
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span>{t('common.notes')}</span>
            <input
              className="input"
              type="text"
              placeholder={t('checkin.notesPh')}
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="row row--between">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
              {busy ? t('common.saving') : existing ? t('checkin.updateWeighIn') : t('checkin.saveWeighIn')}
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

          {sorted.length > 0 ? (
            <ul className="stack checkin-card__recent" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sorted.slice(0, 5).map((row) => (
                <li key={row.id} className="row row--between">
                  <span>
                    <strong>{formatWeight(row.weight_kg, units)}</strong>{' '}
                    <small className="muted">
                      {row.recorded_on}
                      {row.notes ? ` · ${row.notes}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    aria-label={t('checkin.deleteWeighIn', { date: row.recorded_on })}
                    onClick={() => void store.deleteWeight(row.id)}
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
