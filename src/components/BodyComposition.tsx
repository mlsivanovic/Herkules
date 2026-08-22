// Approximate body-fat and muscle calculator. Prefills profile, latest weigh-in
// and last tape log; optional limb girths refine the muscle estimate.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import {
  estimateBodyComposition,
  formulaFromProfile,
  weightOnDate,
  type FatMethod,
  type FfmiBand,
  type MuscleMethod,
  type SexFormula,
} from '../lib/bodyComposition'
import { strengthFromHistory, type LiftId, type StrengthLevel } from '../lib/strengthLevel'
import {
  ageYears,
  formatWeight,
  heightForInput,
  heightToCm,
  heightUnitLabel,
  weightForInput,
  weightToKg,
  weightUnitLabel,
} from '../lib/units'
import { parseNonNegative } from '../lib/validation'
import { useT } from '../lib/i18n'
import type { BodyMeasureRow } from '../types/db'
import { LineChart } from './Chart'
import './bodyComposition.css'

function parseGirthCm(text: string, units: 'metric' | 'imperial'): number | null {
  const parsed = parseNonNegative(text)
  if (parsed === null || parsed === 0) return null
  return heightToCm(parsed, units)
}

function fatMethodKey(method: FatMethod): 'body.methodNavy' | 'body.methodRfm' | 'body.methodCunBae' {
  if (method === 'navy') return 'body.methodNavy'
  if (method === 'rfm') return 'body.methodRfm'
  return 'body.methodCunBae'
}

function muscleMethodKey(method: MuscleMethod): 'body.methodLeeGirth' | 'body.methodLeeBmi' {
  return method === 'leeGirth' ? 'body.methodLeeGirth' : 'body.methodLeeBmi'
}

function ffmiBandKey(
  band: FfmiBand,
):
  | 'body.ffmiBelowAverage'
  | 'body.ffmiAverage'
  | 'body.ffmiAthletic'
  | 'body.ffmiExcellent'
  | 'body.ffmiSuperior'
  | 'body.ffmiVeryHigh' {
  switch (band) {
    case 'belowAverage':
      return 'body.ffmiBelowAverage'
    case 'average':
      return 'body.ffmiAverage'
    case 'athletic':
      return 'body.ffmiAthletic'
    case 'excellent':
      return 'body.ffmiExcellent'
    case 'superior':
      return 'body.ffmiSuperior'
    default:
      return 'body.ffmiVeryHigh'
  }
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

function fillFromRow(
  row: BodyMeasureRow,
  units: 'metric' | 'imperial',
  setters: {
    neck: (v: string) => void
    waist: (v: string) => void
    hip: (v: string) => void
    arm: (v: string) => void
    thigh: (v: string) => void
    calf: (v: string) => void
  },
) {
  setters.neck(heightForInput(row.neck_cm, units))
  setters.waist(heightForInput(row.waist_cm, units))
  setters.hip(heightForInput(row.hip_cm, units))
  setters.arm(heightForInput(row.arm_cm, units))
  setters.thigh(heightForInput(row.thigh_cm, units))
  setters.calf(heightForInput(row.calf_cm, units))
}

export function BodyComposition() {
  const { t } = useT()
  const navigate = useNavigate()
  const store = useStore()
  const profile = store.profile
  const units = profile?.unit_system ?? 'metric'
  const girthUnit = heightUnitLabel(units)
  const today = todayKey()

  const [date, setDate] = useState(today)
  const [weightInput, setWeightInput] = useState('')
  const [formulaSex, setFormulaSex] = useState<SexFormula | ''>('')
  const [neck, setNeck] = useState('')
  const [waist, setWaist] = useState('')
  const [hip, setHip] = useState('')
  const [arm, setArm] = useState('')
  const [thigh, setThigh] = useState('')
  const [calf, setCalf] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const prefilled = useRef(false)

  const measures = useMemo(
    () => [...store.bodyMeasures].sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1)),
    [store.bodyMeasures],
  )
  const rowForDate = measures.find((row) => row.recorded_on === date) ?? null
  const lastRow = measures[0] ?? null
  const profileFormula = formulaFromProfile(profile?.sex ?? null)
  const sex: SexFormula | null = profileFormula ?? (formulaSex === '' ? null : formulaSex)
  const age = profile?.birth_date ? ageYears(profile.birth_date, date) : null
  const heightCm = profile?.height_cm ?? null

  useEffect(() => {
    const kg = weightOnDate(store.bodyWeights, date)
    setWeightInput(weightForInput(kg, units))
  }, [date, units, store.bodyWeights])

  useEffect(() => {
    const source = rowForDate ?? (prefilled.current ? null : lastRow)
    prefilled.current = true
    if (!source) return
    fillFromRow(source, units, {
      neck: setNeck,
      waist: setWaist,
      hip: setHip,
      arm: setArm,
      thigh: setThigh,
      calf: setCalf,
    })
  }, [date, units, rowForDate, lastRow])

  const weightKg = useMemo(() => {
    const parsed = parseNonNegative(weightInput)
    if (parsed === null || parsed === 0) return weightOnDate(store.bodyWeights, date)
    return weightToKg(parsed, units)
  }, [weightInput, units, date, store.bodyWeights])

  const neckCm = parseGirthCm(neck, units)
  const waistCm = parseGirthCm(waist, units)
  const hipCm = parseGirthCm(hip, units)
  const armCm = parseGirthCm(arm, units)
  const thighCm = parseGirthCm(thigh, units)
  const calfCm = parseGirthCm(calf, units)

  const result = useMemo(() => {
    if (sex === null || heightCm === null || heightCm <= 0 || weightKg === null) return null
    return estimateBodyComposition({
      sex,
      ageYears: age !== null && age >= 0 ? age : null,
      heightCm,
      weightKg,
      neckCm,
      waistCm,
      hipCm,
      armCm,
      thighCm,
      calfCm,
    })
  }, [sex, age, heightCm, weightKg, neckCm, waistCm, hipCm, armCm, thighCm, calfCm])

  const history = useMemo(() => {
    if (sex === null || heightCm === null || heightCm <= 0) return []
    const oldestFirst = [...measures].sort((a, b) => (a.recorded_on < b.recorded_on ? -1 : 1))
    return oldestFirst.flatMap((row) => {
      const kg = weightOnDate(store.bodyWeights, row.recorded_on)
      if (kg === null) return []
      const point = estimateBodyComposition({
        sex,
        ageYears: profile?.birth_date ? ageYears(profile.birth_date, row.recorded_on) : null,
        heightCm,
        weightKg: kg,
        neckCm: row.neck_cm,
        waistCm: row.waist_cm,
        hipCm: row.hip_cm,
        armCm: row.arm_cm,
        thighCm: row.thigh_cm,
        calfCm: row.calf_cm,
      })
      if (point.bodyFatPct === null || point.leanMassKg === null) return []
      return [{ date: row.recorded_on, bodyFatPct: point.bodyFatPct, leanMassKg: point.leanMassKg }]
    })
  }, [measures, sex, heightCm, store.bodyWeights, profile?.birth_date])

  const strength = useMemo(() => {
    if (sex === null) return { lifts: [], overall: null }
    return strengthFromHistory(store.sessions, weightKg, sex)
  }, [store.sessions, weightKg, sex])

  const missingProfile = !profileFormula || heightCm === null || age === null
  const missingWeight = weightKg === null
  const extraDefault = Boolean(
    lastRow &&
      (lastRow.arm_cm !== null ||
        lastRow.thigh_cm !== null ||
        lastRow.calf_cm !== null ||
        (profileFormula !== 'female' && lastRow.hip_cm !== null)),
  )

  useEffect(() => {
    if (extraDefault) setMoreOpen(true)
  }, [extraDefault])

  async function save() {
    if (neckCm === null && waistCm === null && hipCm === null && armCm === null && thighCm === null && calfCm === null) {
      setSaveError(t('body.needGirth'))
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      await store.logBodyMeasures({
        date,
        neckCm,
        waistCm,
        hipCm,
        armCm,
        thighCm,
        calfCm,
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : t('errors.saveMeasures'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="body-comp">
      {result?.bodyFatPct !== null && result ? (
        <>
          <div className="stat-grid">
            <div className="card stat-card">
              <strong>{t('body.percent', { n: result.bodyFatPct.toFixed(1) })}</strong>
              <span>{t('body.bodyFat')}</span>
            </div>
            {result.fatMassKg !== null ? (
              <div className="card stat-card">
                <strong>{formatWeight(result.fatMassKg, units)}</strong>
                <span>{t('body.fatMass')}</span>
              </div>
            ) : null}
            {result.leanMassKg !== null ? (
              <div className="card stat-card">
                <strong>{formatWeight(result.leanMassKg, units)}</strong>
                <span>{t('body.leanMass')}</span>
              </div>
            ) : null}
            {result.skeletalMuscleKg !== null ? (
              <div className="card stat-card">
                <strong>{formatWeight(result.skeletalMuscleKg, units)}</strong>
                <span>{t('body.skeletalMuscle')}</span>
              </div>
            ) : null}
          </div>
          <div className="body-comp__methods">
            {result.fatMethod ? <span className="badge badge--planned">{t(fatMethodKey(result.fatMethod))}</span> : null}
            {result.muscleMethod ? (
              <span className="badge badge--completed">{t(muscleMethodKey(result.muscleMethod))}</span>
            ) : null}
            {result.ffmi !== null && result.ffmiBand ? (
              <span className="badge">
                {t('body.ffmi', { n: result.ffmi.toFixed(1) })} · {t(ffmiBandKey(result.ffmiBand))}
              </span>
            ) : null}
            {result.waistToHip !== null ? (
              <span className="badge">{t('body.whr', { n: result.waistToHip.toFixed(2) })}</span>
            ) : null}
            {result.waistToHeight !== null ? (
              <span className="badge">{t('body.whtr', { n: result.waistToHeight.toFixed(2) })}</span>
            ) : null}
          </div>
          {result.ffmi !== null ? (
            <small className="muted">{t('body.ceilingNote', { n: result.naturalFfmiCeiling })}</small>
          ) : null}
        </>
      ) : null}

      {result?.error === 'waist_neck' ? (
        <p className="field-error" role="alert">
          {t('body.invalidWaistNeck')}
        </p>
      ) : null}

      <p className="body-comp__disclaimer">{t('body.disclaimer')}</p>

      <div className="card stack">
      <p className="body-comp__hint">{t('body.hint')}</p>

      {missingProfile || missingWeight ? (
        <p className="muted" style={{ margin: 0 }}>
          {missingProfile ? t('body.needProfile') : t('body.needWeight')}{' '}
          <button type="button" className="btn btn--small btn--ghost" onClick={() => void navigate('/settings')}>
            {t('body.openSettings')}
          </button>
        </p>
      ) : null}

      {profileFormula === null ? (
        <div className="field">
          <label htmlFor="body-formula-sex">{t('body.needFormulaSex')}</label>
          <select
            id="body-formula-sex"
            className="input"
            value={formulaSex}
            onChange={(e) => setFormulaSex(e.target.value as SexFormula | '')}
          >
            <option value="">{t('settings.preferNot')}</option>
            <option value="male">{t('body.formulaMale')}</option>
            <option value="female">{t('body.formulaFemale')}</option>
          </select>
        </div>
      ) : null}

      <div className="body-comp__fields">
        <div className="field">
          <label htmlFor="body-date">{t('common.date')}</label>
          <input
            id="body-date"
            className="input"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value || today)}
          />
        </div>
        <div className="field">
          <label htmlFor="body-weight">{t('checkin.weight', { unit: weightUnitLabel(units) })}</label>
          <input
            id="body-weight"
            className="input"
            type="text"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="body-neck">{t('body.neck', { unit: girthUnit })}</label>
          <input
            id="body-neck"
            className="input"
            type="text"
            inputMode="decimal"
            value={neck}
            onChange={(e) => setNeck(e.target.value)}
          />
          <small className="muted">{t('body.neckHow')}</small>
        </div>
        <div className="field">
          <label htmlFor="body-waist">{t('body.waist', { unit: girthUnit })}</label>
          <input
            id="body-waist"
            className="input"
            type="text"
            inputMode="decimal"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
          />
          <small className="muted">{t('body.waistHow')}</small>
        </div>
        {sex === 'female' ? (
          <div className="field">
            <label htmlFor="body-hips">{t('body.hips', { unit: girthUnit })}</label>
            <input
              id="body-hips"
              className="input"
              type="text"
              inputMode="decimal"
              value={hip}
              onChange={(e) => setHip(e.target.value)}
            />
            <small className="muted">{t('body.hipsHow')}</small>
          </div>
        ) : null}
      </div>

      <details
        className="body-comp__extras"
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
      >
        <summary>{t('body.more')}</summary>
        <div className="body-comp__extras-body">
          <small className="muted">{t('body.moreHint')}</small>
          {sex !== 'female' ? (
            <div className="field">
              <label htmlFor="body-hips-extra">{t('body.hipsOptional', { unit: girthUnit })}</label>
              <input
                id="body-hips-extra"
                className="input"
                type="text"
                inputMode="decimal"
                value={hip}
                onChange={(e) => setHip(e.target.value)}
              />
              <small className="muted">{t('body.hipsHow')}</small>
            </div>
          ) : null}
          <div className="body-comp__fields">
            <div className="field">
              <label htmlFor="body-arm">{t('body.arm', { unit: girthUnit })}</label>
              <input
                id="body-arm"
                className="input"
                type="text"
                inputMode="decimal"
                value={arm}
                onChange={(e) => setArm(e.target.value)}
              />
              <small className="muted">{t('body.armHow')}</small>
            </div>
            <div className="field">
              <label htmlFor="body-thigh">{t('body.thigh', { unit: girthUnit })}</label>
              <input
                id="body-thigh"
                className="input"
                type="text"
                inputMode="decimal"
                value={thigh}
                onChange={(e) => setThigh(e.target.value)}
              />
              <small className="muted">{t('body.thighHow')}</small>
            </div>
            <div className="field">
              <label htmlFor="body-calf">{t('body.calf', { unit: girthUnit })}</label>
              <input
                id="body-calf"
                className="input"
                type="text"
                inputMode="decimal"
                value={calf}
                onChange={(e) => setCalf(e.target.value)}
              />
              <small className="muted">{t('body.calfHow')}</small>
            </div>
          </div>
        </div>
      </details>

      <div className="body-comp__actions">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {busy ? t('common.saving') : t('body.save')}
        </button>
        {rowForDate ? (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            aria-label={t('body.delete', { date })}
            onClick={() => void store.deleteBodyMeasures(rowForDate.id)}
          >
            {t('common.delete')}
          </button>
        ) : null}
        {saved ? <small className="badge badge--completed">{t('common.saved')}</small> : null}
      </div>
      {saveError ? (
        <p className="field-error" role="alert">
          {saveError}
        </p>
      ) : null}
      </div>

      {history.length > 1 ? (
        <>
          <div className="section-title">{t('body.chartsFat')}</div>
          <div className="card">
            <LineChart
              points={history.map((point) => ({
                label: point.date.slice(5),
                value: point.bodyFatPct,
              }))}
              formatValue={(value) => t('body.percent', { n: value.toFixed(1) })}
              ariaLabel={t('body.chartsFatAria')}
              emptyText={t('progress.chartEmpty')}
            />
          </div>
          <div className="section-title">{t('body.chartsLean')}</div>
          <div className="card">
            <LineChart
              points={history.map((point) => ({
                label: point.date.slice(5),
                value: point.leanMassKg,
              }))}
              formatValue={(value) => formatWeight(value, units)}
              ariaLabel={t('body.chartsLeanAria')}
              emptyText={t('progress.chartEmpty')}
            />
          </div>
        </>
      ) : null}

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
    </div>
  )
}
