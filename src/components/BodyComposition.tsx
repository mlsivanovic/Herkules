// Progress body-composition section: four summary cards stay visible;
// details (daily table, strength, tape form) start collapsed.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import {
  compositionLog,
  latestComposition,
  type FatMethod,
  type MuscleMethod,
} from '../lib/bodyComposition'
import { strengthFromHistory, type LiftId, type StrengthLevel } from '../lib/strengthLevel'
import { formatWeight } from '../lib/units'
import { useT } from '../lib/i18n'
import { IconChevronDown } from './Icons'
import { BodyMeasureFields } from './BodyMeasureFields'
import { useBodyMeasureForm } from './bodyMeasureForm'
import './bodyComposition.css'

function fatMethodKey(method: FatMethod): 'body.methodNavy' | 'body.methodRfm' | 'body.methodCunBae' {
  if (method === 'navy') return 'body.methodNavy'
  if (method === 'rfm') return 'body.methodRfm'
  return 'body.methodCunBae'
}

function muscleMethodKey(method: MuscleMethod): 'body.methodLeeGirth' | 'body.methodLeeBmi' {
  return method === 'leeGirth' ? 'body.methodLeeGirth' : 'body.methodLeeBmi'
}

function liftKey(
  lift: LiftId,
): 'body.liftSquat' | 'body.liftBench' | 'body.liftDeadlift' | 'body.liftPress' | 'body.liftPullUp' {
  switch (lift) {
    case 'squat':
      return 'body.liftSquat'
    case 'bench':
      return 'body.liftBench'
    case 'deadlift':
      return 'body.liftDeadlift'
    case 'press':
      return 'body.liftPress'
    default:
      return 'body.liftPullUp'
  }
}

function levelKey(
  level: StrengthLevel,
):
  | 'body.levelUntrained'
  | 'body.levelNovice'
  | 'body.levelIntermediate'
  | 'body.levelAdvanced'
  | 'body.levelElite' {
  switch (level) {
    case 'untrained':
      return 'body.levelUntrained'
    case 'novice':
      return 'body.levelNovice'
    case 'intermediate':
      return 'body.levelIntermediate'
    case 'advanced':
      return 'body.levelAdvanced'
    default:
      return 'body.levelElite'
  }
}

function dash(value: string | null | undefined): string {
  return value && value !== '' ? value : '—'
}

export function BodyComposition() {
  const { t } = useT()
  const store = useStore()
  const form = useBodyMeasureForm()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const units = form.units
  const today = todayKey()

  const logArgs = {
    sex: form.sex ?? store.profile?.sex ?? null,
    birthDate: store.profile?.birth_date ?? null,
    heightCm: store.profile?.height_cm ?? null,
    weights: store.bodyWeights,
    measures: store.bodyMeasures,
  }
  const log = compositionLog(logArgs)
  const latest = latestComposition({ ...logArgs, today })

  const strength = useMemo(() => {
    if (form.sex === null) return { lifts: [], overall: null }
    return strengthFromHistory(store.sessions, form.weightKg, form.sex)
  }, [store.sessions, form.weightKg, form.sex])

  return (
    <div className="body-comp">
      <div className="body-comp__head">
        <div className="section-title" style={{ margin: 0 }}>
          {t('body.title')}
        </div>
        <button
          type="button"
          className="btn btn--small"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {t('body.details')}
          <IconChevronDown
            className={`body-comp__chevron${detailsOpen ? ' body-comp__chevron--open' : ''}`}
            width={16}
            height={16}
          />
        </button>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <strong>
            {latest?.bodyFatPct != null ? t('body.percent', { n: latest.bodyFatPct.toFixed(1) }) : '—'}
          </strong>
          <span>{t('body.bodyFat')}</span>
        </div>
        <div className="card stat-card">
          <strong>{latest?.fatMassKg != null ? formatWeight(latest.fatMassKg, units) : '—'}</strong>
          <span>{t('body.fatMass')}</span>
        </div>
        <div className="card stat-card">
          <strong>{latest?.leanMassKg != null ? formatWeight(latest.leanMassKg, units) : '—'}</strong>
          <span>{t('body.leanMass')}</span>
        </div>
        <div className="card stat-card">
          <strong>
            {latest?.skeletalMuscleKg != null ? formatWeight(latest.skeletalMuscleKg, units) : '—'}
          </strong>
          <span>{t('body.skeletalMuscle')}</span>
        </div>
      </div>

      {detailsOpen ? (
        <>
          {latest ? (
            <div className="body-comp__methods">
              {latest.fatMethod ? (
                <span className="badge badge--planned">{t(fatMethodKey(latest.fatMethod))}</span>
              ) : null}
              {latest.muscleMethod ? (
                <span className="badge badge--completed">{t(muscleMethodKey(latest.muscleMethod))}</span>
              ) : null}
              {latest.error === 'waist_neck' ? (
                <span className="badge badge--error">{t('body.invalidWaistNeck')}</span>
              ) : null}
            </div>
          ) : null}
          <p className="body-comp__disclaimer">{t('body.disclaimer')}</p>

          <div className="section-title">{t('body.table')}</div>
          {log.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t('body.tableEmpty')}
            </p>
          ) : (
            <div className="card body-comp__table-wrap">
              <table className="body-comp__table">
                <caption className="sr-only">{t('body.tableAria')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('common.date')}</th>
                    <th scope="col">{t('body.colWeight')}</th>
                    <th scope="col">{t('body.bodyFat')}</th>
                    <th scope="col">{t('body.fatMass')}</th>
                    <th scope="col">{t('body.leanMass')}</th>
                    <th scope="col">{t('body.skeletalMuscle')}</th>
                    <th scope="col">
                      <span className="sr-only">{t('common.delete')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((row) => (
                    <tr key={row.measureId}>
                      <td>{row.date}</td>
                      <td>{row.weightKg !== null ? formatWeight(row.weightKg, units) : '—'}</td>
                      <td>
                        {dash(row.bodyFatPct != null ? t('body.percent', { n: row.bodyFatPct.toFixed(1) }) : null)}
                      </td>
                      <td>{dash(row.fatMassKg != null ? formatWeight(row.fatMassKg, units) : null)}</td>
                      <td>{dash(row.leanMassKg != null ? formatWeight(row.leanMassKg, units) : null)}</td>
                      <td>
                        {dash(
                          row.skeletalMuscleKg != null ? formatWeight(row.skeletalMuscleKg, units) : null,
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--small btn--danger"
                          aria-label={t('body.delete', { date: row.date })}
                          onClick={() => void store.deleteBodyMeasures(row.measureId)}
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="section-title">{t('body.strength')}</div>
          <div className="card stack">
            <p className="muted" style={{ margin: 0 }}>
              {t('body.strengthHint')}
            </p>
            {strength.lifts.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t('body.strengthEmpty')}
              </p>
            ) : (
              <>
                {strength.overall ? (
                  <p style={{ margin: 0 }}>
                    {t('body.strengthOverall')}{' '}
                    <span className="badge badge--planned">{t(levelKey(strength.overall))}</span>
                  </p>
                ) : null}
                <ul className="body-comp__strength">
                  {strength.lifts.map((row) => (
                    <li key={row.lift} className="body-comp__strength-row">
                      <span>{t(liftKey(row.lift))}</span>
                      <small className="muted">
                        {row.lift === 'pullUp' && row.reps !== null
                          ? t('body.reps', { n: row.reps })
                          : row.e1rmKg !== null
                            ? formatWeight(row.e1rmKg, units)
                            : ''}
                        {row.ratio !== null ? ` · ${t('body.ratio', { ratio: row.ratio.toFixed(2) })}` : ''}
                        {row.level ? ` · ${t(levelKey(row.level))}` : ''}
                      </small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="section-title">{t('body.logTitle')}</div>
          <div className="card stack">
            <p className="body-comp__hint">{t('body.hint')}</p>
            <BodyMeasureFields form={form} idPrefix="body-progress" />
          </div>
        </>
      ) : null}
    </div>
  )
}
