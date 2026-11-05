// Daily body-composition check-in on the Today dashboard. One tape log per
// date; Progress keeps the four summary cards, table and charts. Every saved
// check-in stays listed here and opens a read-only detail sheet.
import { useMemo, useState, type ReactNode } from 'react'
import { formatDateCompact, formatDateLong, todayKey } from '../lib/dates'
import {
  compositionLog,
  latestBodyFatPercent,
  type CompositionLogRow,
} from '../lib/bodyComposition'
import { formatGirth, formatWeight } from '../lib/units'
import { useT } from '../lib/i18n'
import { BottomSheet } from './ui'
import { BodyMeasureFields } from './BodyMeasureFields'
import { useBodyMeasureForm } from './bodyMeasureForm'
import './tendonCheckin.css'
import './bodyComposition.css'

export function BodyCompositionCheckin() {
  const { t } = useT()
  const form = useBodyMeasureForm()
  const today = todayKey()
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

  const history = useMemo(
    () =>
      compositionLog({
        sex: form.sex ?? form.store.profile?.sex ?? null,
        birthDate: form.store.profile?.birth_date ?? null,
        heightCm: form.store.profile?.height_cm ?? null,
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
    ],
  )

  const selectedRow = selectedDate
    ? history.find((row) => row.date === selectedDate) ?? null
    : null
  const selectedMeasure = selectedDate
    ? form.store.bodyMeasures.find((row) => row.recorded_on === selectedDate) ?? null
    : null

  function summary(row: CompositionLogRow): string {
    const parts: string[] = []
    if (row.bodyFatPct !== null) parts.push(t('body.percent', { n: row.bodyFatPct.toFixed(1) }))
    if (row.weightKg !== null) parts.push(formatWeight(row.weightKg, form.units))
    return parts.length > 0 ? parts.join(' · ') : t('checkin.detailEmpty')
  }

  function girth(valueCm: number | null): string {
    return valueCm !== null ? formatGirth(valueCm, form.units) : '—'
  }

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

          <div className="stack body-comp__history">
            <small className="muted">{t('checkin.history')}</small>
            {history.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('checkin.historyEmpty')}
              </p>
            ) : (
              <ul className="checkin-card__recent body-comp__history-list">
                {history.map((row) => (
                  <li key={row.measureId}>
                    <button
                      type="button"
                      className="body-comp__history-item"
                      aria-label={t('checkin.historyAria', { date: formatDateLong(row.date) })}
                      onClick={() => setSelectedDate(row.date)}
                    >
                      <span className="stack" style={{ gap: '0.1rem' }}>
                        <strong>{formatDateCompact(row.date)}</strong>
                        <small className="muted">{summary(row)}</small>
                      </span>
                      <span className="checkin-card__chevron" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {selectedRow ? (
        <BottomSheet
          title={t('checkin.detailTitle')}
          description={formatDateLong(selectedRow.date)}
          onClose={() => setSelectedDate(null)}
        >
          <dl className="body-comp__detail">
            <DetailRow label={t('checkin.detailWeight')}>
              {selectedRow.weightKg !== null ? formatWeight(selectedRow.weightKg, form.units) : '—'}
            </DetailRow>
            <DetailRow label={t('body.bodyFat')}>
              {selectedRow.bodyFatPct !== null
                ? t('body.percent', { n: selectedRow.bodyFatPct.toFixed(1) })
                : '—'}
            </DetailRow>
            <DetailRow label={t('body.fatMass')}>
              {selectedRow.fatMassKg !== null ? formatWeight(selectedRow.fatMassKg, form.units) : '—'}
            </DetailRow>
            <DetailRow label={t('body.leanMass')}>
              {selectedRow.leanMassKg !== null ? formatWeight(selectedRow.leanMassKg, form.units) : '—'}
            </DetailRow>
            <DetailRow label={t('body.skeletalMuscle')}>
              {selectedRow.skeletalMuscleKg !== null
                ? formatWeight(selectedRow.skeletalMuscleKg, form.units)
                : '—'}
            </DetailRow>
            {selectedMeasure ? (
              <>
                <DetailRow label={t('body.neck', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.neck_cm)}
                </DetailRow>
                <DetailRow label={t('body.waist', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.waist_cm)}
                </DetailRow>
                <DetailRow label={t('body.hips', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.hip_cm)}
                </DetailRow>
                <DetailRow label={t('body.arm', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.arm_cm)}
                </DetailRow>
                <DetailRow label={t('body.thigh', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.thigh_cm)}
                </DetailRow>
                <DetailRow label={t('body.calf', { unit: form.girthUnit })}>
                  {girth(selectedMeasure.calf_cm)}
                </DetailRow>
                {selectedMeasure.notes ? (
                  <DetailRow label={t('common.notes')}>{selectedMeasure.notes}</DetailRow>
                ) : null}
              </>
            ) : null}
          </dl>
          <div className="row" style={{ marginTop: '0.9rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                if (!selectedDate) return
                form.applyDate(selectedDate)
                setOpen(true)
                setSelectedDate(null)
              }}
            >
              {t('checkin.editCheckin')}
            </button>
            <button type="button" className="btn" onClick={() => setSelectedDate(null)}>
              {t('common.close')}
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="body-comp__detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
