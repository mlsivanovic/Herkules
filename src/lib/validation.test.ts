import { describe, expect, it } from 'vitest'
import {
  confirmSetDraft,
  parseDecimalDraft,
  parseDurationInput,
  parseNonNegative,
  parseRepsDraft,
  validateEmail,
  validateHttpsUrl,
  validatePassword,
  validateRpe,
  type SetDraftInput,
} from './validation'

describe('auth field validation', () => {
  it('accepts valid emails and rejects malformed ones', () => {
    expect(validateEmail('user@example.com')).toBeNull()
    expect(validateEmail('  user@example.com  ')).toBeNull()
    expect(validateEmail('')).toBeTruthy()
    expect(validateEmail('nope')).toBeTruthy()
    expect(validateEmail('a@b')).toBeTruthy()
  })

  it('requires 8+ character passwords', () => {
    expect(validatePassword('short')).toBeTruthy()
    expect(validatePassword('12345678')).toBeNull()
  })
})

describe('numeric parsing', () => {
  it('parses non-negative numbers', () => {
    expect(parseNonNegative('82.5')).toBe(82.5)
    expect(parseNonNegative(' 100 ')).toBe(100)
    expect(parseNonNegative('')).toBeNull()
    expect(parseNonNegative('-5')).toBeNull()
    expect(parseNonNegative('abc')).toBeNull()
  })

  it('validates RPE 1–10', () => {
    expect(validateRpe(null)).toBeNull()
    expect(validateRpe(7)).toBeNull()
    expect(validateRpe(0)).toBeTruthy()
    expect(validateRpe(11)).toBeTruthy()
    expect(validateRpe(7.5)).toBeTruthy()
  })
})

describe('optional https link', () => {
  it('accepts empty, rejects non-https and garbage', () => {
    expect(validateHttpsUrl('')).toBeNull()
    expect(validateHttpsUrl('https://example.com/how-to')).toBeNull()
    expect(validateHttpsUrl('http://example.com')).toBeTruthy()
    expect(validateHttpsUrl('example.com')).toBeTruthy()
  })
})

const draft = (patch: Partial<SetDraftInput> = {}): SetDraftInput => ({
  weight: '',
  bodyweight: false,
  reps: '',
  duration: '',
  distance: '',
  rpe: '',
  ...patch,
})

describe('decimal and rep drafts', () => {
  it('keeps a trailing separator partial and accepts comma or dot', () => {
    expect(parseDecimalDraft('')).toEqual({ kind: 'empty' })
    expect(parseDecimalDraft('82.')).toEqual({ kind: 'partial' })
    expect(parseDecimalDraft('82,')).toEqual({ kind: 'partial' })
    expect(parseDecimalDraft('82.5')).toEqual({ kind: 'ok', value: 82.5 })
    expect(parseDecimalDraft('82,5')).toEqual({ kind: 'ok', value: 82.5 })
    expect(parseDecimalDraft('0')).toEqual({ kind: 'ok', value: 0 })
    expect(parseDecimalDraft('-2')).toEqual({ kind: 'ok', value: -2 })
    expect(parseDecimalDraft('abc')).toEqual({ kind: 'invalid' })
    expect(parseDecimalDraft('1e2')).toEqual({ kind: 'invalid' })
  })

  it('does not round a decimal repetition', () => {
    expect(parseRepsDraft('8')).toEqual({ kind: 'ok', value: 8 })
    expect(parseRepsDraft('8.')).toEqual({ kind: 'partial' })
    expect(parseRepsDraft('8.5')).toEqual({ kind: 'invalid' })
    expect(parseRepsDraft('8,5')).toEqual({ kind: 'invalid' })
    expect(parseRepsDraft('')).toEqual({ kind: 'empty' })
  })
})

describe('confirmSetDraft', () => {
  it('rejects an empty weight-reps set and accepts explicit zero or bodyweight', () => {
    expect(confirmSetDraft('weight_reps', draft(), 'metric').ok).toBe(false)
    const zero = confirmSetDraft('weight_reps', draft({ weight: '0', reps: '5' }), 'metric')
    expect(zero).toMatchObject({ ok: true, metrics: { weight_kg: 0, reps: 5 } })
    const bw = confirmSetDraft('weight_reps', draft({ bodyweight: true, reps: '8' }), 'metric')
    expect(bw).toMatchObject({ ok: true, metrics: { weight_kg: 0, reps: 8 } })
    const emptyLoad = confirmSetDraft('weight_reps', draft({ reps: '8' }), 'metric', { bodyweightLoad: true })
    expect(emptyLoad).toMatchObject({ ok: true, metrics: { weight_kg: 0, reps: 8 } })
  })

  it('rejects zero reps and decimal reps without rounding', () => {
    expect(confirmSetDraft('reps', draft({ reps: '0' }), 'metric')).toMatchObject({ ok: false, field: 'reps' })
    expect(confirmSetDraft('reps', draft({ reps: '8.5' }), 'metric')).toMatchObject({ ok: false, field: 'reps' })
    expect(confirmSetDraft('weight_reps', draft({ weight: '82,', reps: '8' }), 'metric')).toMatchObject({
      ok: false,
      field: 'weight',
    })
  })

  it('requires duration and distance for those measurements and converts imperial', () => {
    expect(confirmSetDraft('duration', draft({ duration: '0' }), 'metric').ok).toBe(false)
    expect(confirmSetDraft('duration', draft({ duration: '1:30' }), 'metric')).toMatchObject({
      ok: true,
      metrics: { duration_s: 90 },
    })
    expect(confirmSetDraft('distance_duration', draft({ duration: '20:00', distance: '5,2' }), 'metric')).toMatchObject({
      ok: true,
      metrics: { duration_s: 1200, distance_m: 5200 },
    })
    const imperial = confirmSetDraft('weight_reps', draft({ weight: '10', reps: '5' }), 'imperial')
    expect(imperial.ok).toBe(true)
    if (imperial.ok) expect(imperial.metrics.weight_kg).toBeCloseTo(4.54, 1)
    expect(confirmSetDraft('weight_distance', draft({ weight: '20', distance: '0' }), 'metric').ok).toBe(false)
  })
})

describe('duration input parsing', () => {
  it('accepts plain seconds, m:ss and h:mm:ss', () => {
    expect(parseDurationInput('90')).toBe(90)
    expect(parseDurationInput('1:30')).toBe(90)
    expect(parseDurationInput('1:01:05')).toBe(3665)
  })

  it('rejects malformed input', () => {
    expect(parseDurationInput('')).toBeNull()
    expect(parseDurationInput('1:2:3:4')).toBeNull()
    expect(parseDurationInput('a:b')).toBeNull()
    expect(parseDurationInput('-1:30')).toBeNull()
  })
})
