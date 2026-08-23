// Daily body-composition check-in on the Today dashboard. One tape log per
// date; Progress keeps the four summary cards, table and charts.
import { useMemo, useState } from 'react'
import { todayKey } from '../lib/dates'
import { latestBodyFatPercent } from '../lib/bodyComposition'
import { useT } from '../lib/i18n'
import { BodyMeasureFields } from './BodyMeasureFields'
import { useBodyMeasureForm } from './bodyMeasureForm'
import './tendonCheckin.css'
import './bodyComposition.css'

export function BodyCompositionCheckin() {
  const { t } = useT()
  const form = useBodyMeasureForm()
  const today = todayKey()
  const [open, setOpen] = useState(false)

  const todayRow = form.measures.find((row) => row.recorded_on === today) ?? null
  const lastPct = useMemo(
    () =>
      latestBodyFatPercent({
        sex: form.sex ?? form.store.profile?.sex ?? null,
        birthDate: form.store.profile?.birth_date ?? null,
        heightCm: form.store.profile?.height_cm ?? null,
        today,
        weights: form.store.bodyWeights,
        measures: form.store.bodyMeasures,
      }),
    [
      form.sex,
      form.store.profile?.sex,
      form.store.profile?.birth_date,
      form.store.profile?.height_cm,
      form.store.bodyWeights,
      form.store.bodyMeasures,
      today,
    ],
  )

  const headerHint = todayRow
    ? lastPct !== null
      ? t('body.percent', { n: lastPct.toFixed(1) })
      : t('common.saved')
    : lastPct !== null
      ? t('checkin.last', { value: t('body.percent', { n: lastPct.toFixed(1) }) })
      : t('common.optional')

  return (
    <div className={`card stack checkin-card${open ? '' : ' checkin-card--collapsed'}`}>
      <button
        type="button"
        className="checkin-card__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <strong>{t('checkin.bodyTitle')}</strong>
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
            {t('checkin.bodyHint')}
          </p>
          <BodyMeasureFields form={form} idPrefix="body-checkin" />
        </>
      ) : null}
    </div>
  )
}
