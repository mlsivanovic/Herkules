import { describe, expect, it } from 'vitest'
import {
  cunBaeBodyFatPct,
  estimateBodyComposition,
  ffmiBand,
  ffmiValue,
  compositionLog,
  compositionTrend,
  firstInvalidBodyGirth,
  formulaFromProfile,
  latestBodyFatPercent,
  latestComposition,
  leeBmiSkeletalMuscleKg,
  leeGirthSkeletalMuscleKg,
  navyBodyFatPct,
  relativeFatMassPct,
  weightOnDate,
} from './bodyComposition'

describe('body girth validation', () => {
  it('matches the database bounds and accepts empty optional fields', () => {
    expect(firstInvalidBodyGirth({ neckCm: 15, waistCm: 220, hipCm: null })).toBeNull()
    expect(firstInvalidBodyGirth({ neckCm: 14.9, waistCm: 85 })).toBe('neckCm')
    expect(firstInvalidBodyGirth({ waistCm: 220.1 })).toBe('waistCm')
    expect(firstInvalidBodyGirth({ thighCm: Number.NaN })).toBe('thighCm')
  })
})

describe('navyBodyFatPct', () => {
  it('estimates a typical male from neck and waist', () => {
    // 70 in / 32 in waist / 16 in neck → ~11.1%
    const pct = navyBodyFatPct('male', 177.8, 40.64, 81.28, null)
    expect(pct).toBeCloseTo(11.1, 0)
  })

  it('estimates a typical female from neck, waist and hip', () => {
    // 65 in / 28 in waist / 38 in hip / 13 in neck → ~25.9%
    const pct = navyBodyFatPct('female', 165.1, 33.02, 71.12, 96.52)
    expect(pct).toBeCloseTo(25.9, 0)
  })

  it('rejects waist ≤ neck and missing female hip', () => {
    expect(navyBodyFatPct('male', 180, 40, 40, null)).toBeNull()
    expect(navyBodyFatPct('female', 165, 33, 71, null)).toBeNull()
  })
})

describe('relativeFatMassPct', () => {
  it('uses height / waist', () => {
    expect(relativeFatMassPct('male', 180, 85)).toBeCloseTo(21.6, 0)
    expect(relativeFatMassPct('female', 165, 75)).toBeCloseTo(32, 0)
  })
})

describe('cunBaeBodyFatPct', () => {
  it('estimates from BMI, age and sex', () => {
    // BMI 24.7, age 36, male → ~22.4%
    expect(cunBaeBodyFatPct('male', 24.7, 36)).toBeCloseTo(22.4, 0)
  })
})

describe('lee skeletal muscle', () => {
  it('BMI model for an 80 kg, 180 cm, 36-year-old man', () => {
    expect(leeBmiSkeletalMuscleKg('male', 80, 180, 36)).toBeCloseTo(33.3, 0)
  })

  it('girth model when arm, thigh and calf are present', () => {
    const sm = leeGirthSkeletalMuscleKg('male', 180, 36, 33, 55, 38)
    expect(sm).toBeGreaterThan(30)
    expect(sm).toBeLessThan(50)
  })
})

describe('ffmi', () => {
  it('indexes lean mass by height', () => {
    expect(ffmiValue(70, 180)).toBeCloseTo(21.6, 0)
  })

  it('bands male and female FFMI', () => {
    expect(ffmiBand(19, 'male')).toBe('average')
    expect(ffmiBand(22.4, 'male')).toBe('excellent')
    expect(ffmiBand(26, 'male')).toBe('veryHigh')
    expect(ffmiBand(17, 'female')).toBe('athletic')
  })
})

describe('estimateBodyComposition', () => {
  const base = {
    sex: 'male' as const,
    ageYears: 36,
    heightCm: 180,
    weightKg: 80,
    neckCm: null as number | null,
    waistCm: null as number | null,
    hipCm: null as number | null,
    armCm: null as number | null,
    thighCm: null as number | null,
    calfCm: null as number | null,
  }

  it('uses Navy when neck and waist are present', () => {
    const result = estimateBodyComposition({
      ...base,
      neckCm: 38,
      waistCm: 85,
    })
    expect(result.fatMethod).toBe('navy')
    expect(result.bodyFatPct).not.toBeNull()
    expect(result.fatMassKg).not.toBeNull()
    expect(result.leanMassKg).not.toBeNull()
    expect(result.muscleMethod).toBe('leeBmi')
  })

  it('falls back to RFM when waist is in but neck is not', () => {
    const result = estimateBodyComposition({ ...base, waistCm: 85 })
    expect(result.fatMethod).toBe('rfm')
  })

  it('falls back to CUN-BAE with no tape', () => {
    const result = estimateBodyComposition(base)
    expect(result.fatMethod).toBe('cunbae')
    expect(result.bodyFatPct).toBeGreaterThan(10)
  })

  it('prefers Lee girth muscle when limb girths are filled', () => {
    const result = estimateBodyComposition({
      ...base,
      armCm: 33,
      thighCm: 55,
      calfCm: 38,
    })
    expect(result.muscleMethod).toBe('leeGirth')
  })

  it('records waist ≤ neck and still falls back', () => {
    const result = estimateBodyComposition({
      ...base,
      neckCm: 40,
      waistCm: 38,
    })
    expect(result.error).toBe('waist_neck')
    expect(result.fatMethod).toBe('rfm')
  })

  it('computes waist-to-hip when hips are present', () => {
    const result = estimateBodyComposition({
      ...base,
      waistCm: 85,
      hipCm: 100,
    })
    expect(result.waistToHip).toBe(0.85)
    expect(result.waistToHeight).toBeCloseTo(0.47, 2)
  })

  it('requires female hips for Navy', () => {
    const withoutHip = estimateBodyComposition({
      ...base,
      sex: 'female',
      neckCm: 33,
      waistCm: 75,
    })
    expect(withoutHip.fatMethod).toBe('rfm')
    const withHip = estimateBodyComposition({
      ...base,
      sex: 'female',
      neckCm: 33,
      waistCm: 75,
      hipCm: 98,
    })
    expect(withHip.fatMethod).toBe('navy')
  })
})

describe('weightOnDate', () => {
  const entries = [
    { recorded_on: '2026-08-01', weight_kg: 82 },
    { recorded_on: '2026-08-10', weight_kg: 81 },
  ]

  it('prefers the exact date, else the latest on or before, without using future data', () => {
    expect(weightOnDate(entries, '2026-08-10')).toBe(81)
    expect(weightOnDate(entries, '2026-08-05')).toBe(82)
    expect(weightOnDate(entries, '2026-07-01')).toBeNull()
  })

  it('returns null when empty', () => {
    expect(weightOnDate([], '2026-08-10')).toBeNull()
  })
})

describe('formulaFromProfile / latestBodyFatPercent', () => {
  it('only maps male and female profile sex', () => {
    expect(formulaFromProfile('male')).toBe('male')
    expect(formulaFromProfile('other')).toBeNull()
    expect(formulaFromProfile(null)).toBeNull()
  })

  it('returns a CUN-BAE estimate from profile + weight when tape is missing', () => {
    const pct = latestBodyFatPercent({
      sex: 'male',
      birthDate: '1990-01-01',
      heightCm: 180,
      today: '2026-08-23',
      weights: [{ recorded_on: '2026-08-20', weight_kg: 80 }],
      measures: [],
    })
    expect(pct).toBeGreaterThan(10)
    expect(pct).toBeLessThan(40)
  })

  it('charts composition from weigh-ins even without tape logs', () => {
    const points = compositionTrend({
      sex: 'male',
      birthDate: '1990-01-01',
      heightCm: 180,
      weights: [
        { recorded_on: '2026-07-01', weight_kg: 84 },
        { recorded_on: '2026-08-20', weight_kg: 80 },
      ],
      measures: [],
    })
    expect(points).toHaveLength(2)
    expect(points[0]?.date).toBe('2026-07-01')
    expect(points[0]?.bodyFatPct).toBeGreaterThan(10)
    expect(points[1]?.leanMassKg).toBeGreaterThan(50)
  })

  it('needs sex and height before it can chart composition', () => {
    expect(
      compositionTrend({
        sex: null,
        birthDate: '1990-01-01',
        heightCm: 180,
        weights: [{ recorded_on: '2026-08-20', weight_kg: 80 }],
        measures: [],
      }),
    ).toEqual([])
  })

  it('keeps saved tape rows visible when profile data and weight are missing', () => {
    const rows = compositionLog({
      sex: null,
      birthDate: null,
      heightCm: null,
      weights: [],
      measures: [
        {
          id: 'm1',
          owner_id: 'u1',
          recorded_on: '2026-08-01',
          neck_cm: 38,
          waist_cm: 88,
          hip_cm: null,
          arm_cm: null,
          thigh_cm: null,
          calf_cm: null,
          notes: null,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2026-08-01',
      measureId: 'm1',
      weightKg: null,
      bodyFatPct: null,
      leanMassKg: null,
    })
  })

  it('builds a newest-first daily log from saved tape rows', () => {
    const rows = compositionLog({
      sex: 'male',
      birthDate: '1990-01-01',
      heightCm: 180,
      weights: [
        { recorded_on: '2026-08-01', weight_kg: 82 },
        { recorded_on: '2026-08-10', weight_kg: 80 },
      ],
      measures: [
        {
          id: 'm1',
          owner_id: 'u1',
          recorded_on: '2026-08-01',
          neck_cm: 38,
          waist_cm: 88,
          hip_cm: null,
          arm_cm: null,
          thigh_cm: null,
          calf_cm: null,
          notes: null,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        },
        {
          id: 'm2',
          owner_id: 'u1',
          recorded_on: '2026-08-10',
          neck_cm: 38,
          waist_cm: 84,
          hip_cm: null,
          arm_cm: 33,
          thigh_cm: 55,
          calf_cm: 38,
          notes: null,
          created_at: '2026-08-10T00:00:00Z',
          updated_at: '2026-08-10T00:00:00Z',
        },
      ],
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]?.date).toBe('2026-08-10')
    expect(rows[0]?.fatMethod).toBe('navy')
    expect(rows[0]?.muscleMethod).toBe('leeGirth')
    expect(rows[1]?.date).toBe('2026-08-01')
    expect(rows[0]?.bodyFatPct).not.toBeNull()
  })

  it('uses the latest saved day for the summary cards', () => {
    const result = latestComposition({
      sex: 'male',
      birthDate: '1990-01-01',
      heightCm: 180,
      today: '2026-08-23',
      weights: [{ recorded_on: '2026-08-10', weight_kg: 80 }],
      measures: [
        {
          id: 'm2',
          owner_id: 'u1',
          recorded_on: '2026-08-10',
          neck_cm: 38,
          waist_cm: 84,
          hip_cm: null,
          arm_cm: null,
          thigh_cm: null,
          calf_cm: null,
          notes: null,
          created_at: '2026-08-10T00:00:00Z',
          updated_at: '2026-08-10T00:00:00Z',
        },
      ],
    })
    expect(result?.fatMethod).toBe('navy')
    expect(result?.bodyFatPct).not.toBeNull()
  })
})
