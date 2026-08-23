// Shared tape-measure form state for the Progress calculator and Today check-in.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/dates'
import {
  BODY_GIRTH_RANGES_CM,
  estimateBodyComposition,
  firstInvalidBodyGirth,
  formulaFromProfile,
  weightOnDate,
  type BodyGirthField,
  type SexFormula,
} from '../lib/bodyComposition'
import {
  ageYears,
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

export function parseGirthCm(text: string, units: 'metric' | 'imperial'): number | null {
  const parsed = parseNonNegative(text)
  if (parsed === null || parsed === 0) return null
  return heightToCm(parsed, units)
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

export function useBodyMeasureForm() {
  const { t } = useT()
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

  const liveResult = useMemo(() => {
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

  const missingProfile = !profileFormula || heightCm === null || age === null
  const missingWeight = weightKg === null
  const hasGirth =
    neckCm !== null ||
    waistCm !== null ||
    hipCm !== null ||
    armCm !== null ||
    thighCm !== null ||
    calfCm !== null

  const girthInputs: { field: BodyGirthField; text: string; value: number | null }[] = [
    { field: 'neckCm', text: neck, value: neckCm },
    { field: 'waistCm', text: waist, value: waistCm },
    { field: 'hipCm', text: hip, value: hipCm },
    { field: 'armCm', text: arm, value: armCm },
    { field: 'thighCm', text: thigh, value: thighCm },
    { field: 'calfCm', text: calf, value: calfCm },
  ]

  function setGirthValidationError(field: BodyGirthField) {
    const labels: Record<BodyGirthField, string> = {
      neckCm: t('body.neck', { unit: girthUnit }),
      waistCm: t('body.waist', { unit: girthUnit }),
      hipCm: t('body.hips', { unit: girthUnit }),
      armCm: t('body.arm', { unit: girthUnit }),
      thighCm: t('body.thigh', { unit: girthUnit }),
      calfCm: t('body.calf', { unit: girthUnit }),
    }
    const range = BODY_GIRTH_RANGES_CM[field]
    setSaveError(
      t('body.girthRange', {
        field: labels[field],
        min: heightForInput(range.min, units),
        max: heightForInput(range.max, units),
        unit: girthUnit,
      }),
    )
  }

  function applyDate(next: string) {
    setDate(next || today)
    setSaveError(null)
  }

  async function save() {
    const invalidText = girthInputs.find(({ text, value }) => text.trim() !== '' && value === null)
    const invalidRange = firstInvalidBodyGirth({ neckCm, waistCm, hipCm, armCm, thighCm, calfCm })
    const invalidField = invalidText?.field ?? invalidRange
    if (invalidField) {
      setGirthValidationError(invalidField)
      return
    }
    if (!hasGirth) {
      setSaveError(t('body.needGirth'))
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      const parsedWeight = parseNonNegative(weightInput)
      if (parsedWeight !== null && parsedWeight > 0) {
        await store.logWeight(date, weightToKg(parsedWeight, units))
      }
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

  async function remove() {
    if (!rowForDate) return
    setBusy(true)
    setSaveError(null)
    try {
      await store.deleteBodyMeasures(rowForDate.id)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : t('errors.saveMeasures'))
    } finally {
      setBusy(false)
    }
  }

  return {
    t,
    store,
    units,
    girthUnit,
    today,
    date,
    applyDate,
    weightInput,
    setWeightInput,
    formulaSex,
    setFormulaSex,
    neck,
    setNeck,
    waist,
    setWaist,
    hip,
    setHip,
    arm,
    setArm,
    thigh,
    setThigh,
    calf,
    setCalf,
    busy,
    saveError,
    saved,
    moreOpen,
    setMoreOpen,
    measures,
    rowForDate,
    lastRow,
    profileFormula,
    sex,
    heightCm,
    weightKg,
    liveResult,
    missingProfile,
    missingWeight,
    weightUnit: weightUnitLabel(units),
    save,
    remove,
  }
}

export type BodyMeasureFormState = ReturnType<typeof useBodyMeasureForm>
