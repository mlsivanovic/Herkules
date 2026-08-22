// Approximate body-fat and muscle estimates from anthropometry.
// Tape methods are typically ±3–4 percentage points vs lab (DEXA / hydrostatic).
// Canonical storage is kg / cm; Navy math is defined in inches.
import type { BodyMeasureRow, Sex } from '../types/db'
import { ageYears, bodyMassIndex, cmToIn } from './units'

export type SexFormula = 'male' | 'female'
export type FatMethod = 'navy' | 'rfm' | 'cunbae'
export type MuscleMethod = 'leeGirth' | 'leeBmi'
export type FfmiBand =
  | 'belowAverage'
  | 'average'
  | 'athletic'
  | 'excellent'
  | 'superior'
  | 'veryHigh'

export interface BodyCompositionInput {
  sex: SexFormula
  /** Whole years; null skips age-dependent equations (CUN-BAE, Lee). */
  ageYears: number | null
  heightCm: number
  weightKg: number
  neckCm: number | null
  waistCm: number | null
  hipCm: number | null
  /** Mid-upper arm, relaxed. */
  armCm: number | null
  /** Mid-thigh. */
  thighCm: number | null
  /** Widest calf. */
  calfCm: number | null
}

export interface BodyCompositionResult {
  bodyFatPct: number | null
  fatMethod: FatMethod | null
  fatMassKg: number | null
  leanMassKg: number | null
  ffmi: number | null
  ffmiNormalized: number | null
  ffmiBand: FfmiBand | null
  naturalFfmiCeiling: number
  skeletalMuscleKg: number | null
  muscleMethod: MuscleMethod | null
  waistToHip: number | null
  waistToHeight: number | null
  /** Set when Navy inputs are present but physically invalid. */
  error: 'waist_neck' | null
}

const BF_MIN = 2
const BF_MAX = 60

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clampBf(pct: number): number {
  return Math.min(BF_MAX, Math.max(BF_MIN, round1(pct)))
}

function log10(value: number): number {
  return Math.log(value) / Math.LN10
}

/**
 * US Navy / DoD Hodgdon–Beckett (OPNAVINST). Girths and height in inches.
 * Men: 86.010 × log10(waist − neck) − 70.041 × log10(height) + 36.76
 * Women: 163.205 × log10(waist + hip − neck) − 97.684 × log10(height) − 78.387
 */
export function navyBodyFatPct(
  sex: SexFormula,
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm: number | null,
): number | null {
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null
  if (waistCm <= neckCm) return null
  const heightIn = cmToIn(heightCm)
  const neckIn = cmToIn(neckCm)
  const waistIn = cmToIn(waistCm)
  if (sex === 'male') {
    const diff = waistIn - neckIn
    if (diff <= 0) return null
    return clampBf(86.01 * log10(diff) - 70.041 * log10(heightIn) + 36.76)
  }
  if (hipCm === null || hipCm <= 0) return null
  const hipIn = cmToIn(hipCm)
  const sum = waistIn + hipIn - neckIn
  if (sum <= 0) return null
  return clampBf(163.205 * log10(sum) - 97.684 * log10(heightIn) - 78.387)
}

/**
 * Relative Fat Mass (Woolcott & Bergman 2018). Height and waist in the same unit.
 * RFM = 64 − 20 × (height / waist) + 12 × sex  (sex 1 = female).
 */
export function relativeFatMassPct(
  sex: SexFormula,
  heightCm: number,
  waistCm: number,
): number | null {
  if (heightCm <= 0 || waistCm <= 0) return null
  const sexTerm = sex === 'female' ? 12 : 0
  return clampBf(64 - 20 * (heightCm / waistCm) + sexTerm)
}

/**
 * CUN-BAE (Gómez-Ambrosi et al. 2012). sex 1 = female.
 * Used when no useful tape is available.
 */
export function cunBaeBodyFatPct(
  sex: SexFormula,
  bmi: number,
  ageYears: number,
): number | null {
  if (bmi <= 0 || ageYears < 0) return null
  const s = sex === 'female' ? 1 : 0
  const bmi2 = bmi * bmi
  const pct =
    -44.988 +
    0.503 * ageYears +
    10.689 * s +
    3.172 * bmi -
    0.026 * bmi2 +
    0.181 * bmi * s -
    0.02 * bmi * ageYears -
    0.005 * bmi2 * s +
    0.00021 * bmi2 * ageYears
  return clampBf(pct)
}

/**
 * Lee et al. 2000 BMI model (Caucasian race coefficient 0).
 * SM (kg) = 0.244×BW + 7.8×Ht_m + 6.6×sex − 0.098×age − 3.3  (sex 1 = male).
 */
export function leeBmiSkeletalMuscleKg(
  sex: SexFormula,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number | null {
  if (weightKg <= 0 || heightCm <= 0 || ageYears < 0) return null
  const sexTerm = sex === 'male' ? 1 : 0
  const sm = 0.244 * weightKg + 7.8 * (heightCm / 100) + 6.6 * sexTerm - 0.098 * ageYears - 3.3
  return sm > 0 ? round1(sm) : null
}

/**
 * Lee et al. 2000 anthropometric model with *uncorrected* girths (no skinfolds).
 * Original paper subtracts π × skinfold; raw girths slightly overestimate SM.
 * SM = Ht_m × (0.00744×arm² + 0.00088×thigh² + 0.00441×calf²) + 2.4×sex − 0.048×age + 7.8
 */
export function leeGirthSkeletalMuscleKg(
  sex: SexFormula,
  heightCm: number,
  ageYears: number,
  armCm: number,
  thighCm: number,
  calfCm: number,
): number | null {
  if (heightCm <= 0 || ageYears < 0 || armCm <= 0 || thighCm <= 0 || calfCm <= 0) return null
  const sexTerm = sex === 'male' ? 1 : 0
  const girthTerm = 0.00744 * armCm * armCm + 0.00088 * thighCm * thighCm + 0.00441 * calfCm * calfCm
  const sm = (heightCm / 100) * girthTerm + 2.4 * sexTerm - 0.048 * ageYears + 7.8
  return sm > 0 ? round1(sm) : null
}

export function ffmiValue(leanMassKg: number, heightCm: number): number | null {
  if (leanMassKg <= 0 || heightCm <= 0) return null
  const meters = heightCm / 100
  return round1(leanMassKg / (meters * meters))
}

/** Kouri et al. 1995 height-normalized FFMI, referenced to 1.8 m. */
export function normalizedFfmi(ffmi: number, heightCm: number): number {
  return round1(ffmi + 6.1 * (1.8 - heightCm / 100))
}

export function naturalFfmiCeiling(sex: SexFormula): number {
  return sex === 'male' ? 25 : 20
}

export function ffmiBand(ffmi: number, sex: SexFormula): FfmiBand {
  if (sex === 'male') {
    if (ffmi < 18) return 'belowAverage'
    if (ffmi < 20) return 'average'
    if (ffmi < 22) return 'athletic'
    if (ffmi < 23) return 'excellent'
    if (ffmi < 25) return 'superior'
    return 'veryHigh'
  }
  if (ffmi < 15) return 'belowAverage'
  if (ffmi < 16.5) return 'average'
  if (ffmi < 18) return 'athletic'
  if (ffmi < 19) return 'excellent'
  if (ffmi < 21) return 'superior'
  return 'veryHigh'
}

function pickFatPct(input: BodyCompositionInput): {
  pct: number | null
  method: FatMethod | null
  error: 'waist_neck' | null
} {
  const { sex, ageYears, heightCm, weightKg, neckCm, waistCm, hipCm } = input
  let error: 'waist_neck' | null = null
  const navyReady =
    neckCm !== null &&
    waistCm !== null &&
    (sex === 'male' || hipCm !== null)
  if (navyReady && neckCm !== null && waistCm !== null) {
    if (waistCm <= neckCm) {
      error = 'waist_neck'
    } else {
      const navy = navyBodyFatPct(sex, heightCm, neckCm, waistCm, hipCm)
      if (navy !== null) return { pct: navy, method: 'navy', error }
    }
  }
  if (waistCm !== null) {
    const rfm = relativeFatMassPct(sex, heightCm, waistCm)
    if (rfm !== null) return { pct: rfm, method: 'rfm', error }
  }
  if (ageYears !== null) {
    const bmi = bodyMassIndex(weightKg, heightCm)
    if (bmi !== null) {
      const cun = cunBaeBodyFatPct(sex, bmi, ageYears)
      if (cun !== null) return { pct: cun, method: 'cunbae', error }
    }
  }
  return { pct: null, method: null, error }
}

export function estimateBodyComposition(input: BodyCompositionInput): BodyCompositionResult {
  const ceiling = naturalFfmiCeiling(input.sex)
  const empty: BodyCompositionResult = {
    bodyFatPct: null,
    fatMethod: null,
    fatMassKg: null,
    leanMassKg: null,
    ffmi: null,
    ffmiNormalized: null,
    ffmiBand: null,
    naturalFfmiCeiling: ceiling,
    skeletalMuscleKg: null,
    muscleMethod: null,
    waistToHip: null,
    waistToHeight: null,
    error: null,
  }
  if (input.heightCm <= 0 || input.weightKg <= 0) return empty

  const fat = pickFatPct(input)
  const fatMassKg =
    fat.pct !== null ? round1(input.weightKg * (fat.pct / 100)) : null
  const leanMassKg =
    fatMassKg !== null ? round1(Math.max(0, input.weightKg - fatMassKg)) : null
  const ffmi = leanMassKg !== null ? ffmiValue(leanMassKg, input.heightCm) : null

  let skeletalMuscleKg: number | null = null
  let muscleMethod: MuscleMethod | null = null
  if (
    input.ageYears !== null &&
    input.armCm !== null &&
    input.thighCm !== null &&
    input.calfCm !== null
  ) {
    skeletalMuscleKg = leeGirthSkeletalMuscleKg(
      input.sex,
      input.heightCm,
      input.ageYears,
      input.armCm,
      input.thighCm,
      input.calfCm,
    )
    if (skeletalMuscleKg !== null) muscleMethod = 'leeGirth'
  }
  if (skeletalMuscleKg === null && input.ageYears !== null) {
    skeletalMuscleKg = leeBmiSkeletalMuscleKg(
      input.sex,
      input.weightKg,
      input.heightCm,
      input.ageYears,
    )
    if (skeletalMuscleKg !== null) muscleMethod = 'leeBmi'
  }
  if (skeletalMuscleKg !== null && leanMassKg !== null && skeletalMuscleKg > leanMassKg) {
    skeletalMuscleKg = leanMassKg
  }

  const waistToHip =
    input.waistCm !== null && input.hipCm !== null && input.hipCm > 0
      ? Math.round((input.waistCm / input.hipCm) * 100) / 100
      : null
  const waistToHeight =
    input.waistCm !== null && input.heightCm > 0
      ? Math.round((input.waistCm / input.heightCm) * 100) / 100
      : null

  return {
    bodyFatPct: fat.pct,
    fatMethod: fat.method,
    fatMassKg,
    leanMassKg,
    ffmi,
    ffmiNormalized: ffmi !== null ? normalizedFfmi(ffmi, input.heightCm) : null,
    ffmiBand: ffmi !== null ? ffmiBand(ffmi, input.sex) : null,
    naturalFfmiCeiling: ceiling,
    skeletalMuscleKg,
    muscleMethod,
    waistToHip,
    waistToHeight,
    error: fat.error,
  }
}

export function formulaFromProfile(sex: Sex | null | undefined): SexFormula | null {
  if (sex === 'male' || sex === 'female') return sex
  return null
}

export function latestBodyFatPercent(args: {
  sex: Sex | null
  birthDate: string | null
  heightCm: number | null
  today: string
  weights: { recorded_on: string; weight_kg: number }[]
  measures: BodyMeasureRow[]
}): number | null {
  const sex = formulaFromProfile(args.sex)
  if (sex === null || args.heightCm === null || args.heightCm <= 0) return null
  const latestMeasure = [...args.measures].sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1))[0]
  const date = latestMeasure?.recorded_on ?? args.today
  const weightKg = weightOnDate(args.weights, date)
  if (weightKg === null) return null
  return estimateBodyComposition({
    sex,
    ageYears: args.birthDate ? ageYears(args.birthDate, date) : null,
    heightCm: args.heightCm,
    weightKg,
    neckCm: latestMeasure?.neck_cm ?? null,
    waistCm: latestMeasure?.waist_cm ?? null,
    hipCm: latestMeasure?.hip_cm ?? null,
    armCm: latestMeasure?.arm_cm ?? null,
    thighCm: latestMeasure?.thigh_cm ?? null,
    calfCm: latestMeasure?.calf_cm ?? null,
  }).bodyFatPct
}

/** Weigh-in on `date`, else the most recent one on or before that date, else latest overall. */
export function weightOnDate(
  entries: { recorded_on: string; weight_kg: number }[],
  date: string,
): number | null {
  if (entries.length === 0) return null
  const exact = entries.find((row) => row.recorded_on === date)
  if (exact) return exact.weight_kg
  const earlier = entries
    .filter((row) => row.recorded_on <= date)
    .sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1))
  if (earlier[0]) return earlier[0].weight_kg
  const latest = [...entries].sort((a, b) => (a.recorded_on < b.recorded_on ? 1 : -1))
  return latest[0]?.weight_kg ?? null
}
