import { describe, expect, it } from 'vitest'
import { detectDelimiter, deterministicUuid, parseExternalCsv } from './importExternal'

const STRONG_CSV = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Distance,Seconds,Notes',
  '2018-08-08 06:28:31,Push A,1h 9m,Bench Press,1,60,kg,5,8,,,',
  '2018-08-08 06:28:31,Push A,1h 9m,Bench Press,2,60,kg,5,8,,,',
  '2018-08-08 06:28:31,Push A,1h 9m,Bench Press,3,62.5,kg,4,9,,,',
  '2018-08-08 06:28:31,Push A,1h 9m,Plank,1,,,9,,,,"keep hips high"',
  '2018-08-09 07:00:00,Legs,55m,Squat,1,135,lb,5,7,,,',
].join('\n')

describe('detectDelimiter', () => {
  it('prefers semicolons when they dominate the header', () => {
    expect(detectDelimiter('Date;Workout Name;Exercise Name')).toBe(';')
    expect(detectDelimiter('Date,Workout Name,Exercise Name')).toBe(',')
  })
})

describe('deterministicUuid', () => {
  it('is stable and UUID-shaped', () => {
    const a = deterministicUuid('strong', '2018-08-08', 'Push A', 1)
    expect(a).toBe(deterministicUuid('strong', '2018-08-08', 'Push A', 1))
    expect(a).not.toBe(deterministicUuid('strong', '2018-08-08', 'Push A', 2))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

describe('parseExternalCsv', () => {
  it('parses a Strong export into sessions, exercises and sets', () => {
    const parsed = parseExternalCsv(STRONG_CSV)
    expect(parsed).toHaveLength(2)

    const push = parsed[0]
    expect(push.name).toBe('Push A')
    expect(push.date).toBe('2018-08-08')
    expect(push.exercises).toHaveLength(2)

    const bench = push.exercises[0]
    expect(bench.measurement).toBe('weight_reps')
    expect(bench.sets).toHaveLength(3)
    expect(bench.sets[2]?.weight_kg).toBe(62.5)
    expect(bench.sets[2]?.reps).toBe(4)
    expect(bench.sets[2]?.rpe).toBe(9)

    const plank = push.exercises[1]
    expect(plank.measurement).toBe('reps')
    expect(plank.sets[0]?.notes).toBe('keep hips high')
  })

  it('converts pounds to kilograms', () => {
    const parsed = parseExternalCsv(STRONG_CSV)
    const squat = parsed[1]?.exercises[0]
    expect(squat?.measurement).toBe('weight_reps')
    expect(squat?.sets[0]?.weight_kg).toBeCloseTo(135 * 0.45359237, 2)
  })

  it('handles semicolon-separated exports', () => {
    const semis = STRONG_CSV.split('\n').map((line) =>
      line.replaceAll(',', (match, offset: number, whole: string) =>
        isInsideQuotes(whole, offset) ? match : ';',
      ),
    ).join('\n')
    const parsed = parseExternalCsv(semis)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.exercises[0]?.sets).toHaveLength(3)
    expect(parsed[0]?.exercises[1]?.sets[0]?.notes).toBe('keep hips high')
  })

  it('derives distance_duration from distance columns', () => {
    const csv = [
      '# Date,# Workout Name,# Exercise Name,# Set Order,# Weight (kg),# Reps,# Distance (km),# Time,Weight Unit,Distance Unit,Seconds',
      '2020-01-01 18:00:00,Run,EZ Run,1,, ,5.0,30:00,kg,km,1800',
    ].join('\n')
    const parsed = parseExternalCsv(csv, 'hevy')
    const run = parsed[0]?.exercises[0]
    expect(run?.measurement).toBe('distance_duration')
    expect(run?.sets[0]?.distance_m).toBe(5000)
    expect(run?.sets[0]?.duration_s).toBe(1800)
  })

  it('produces the same ids on re-parse (idempotent re-import)', () => {
    expect(parseExternalCsv(STRONG_CSV).map((s) => s.sessionId)).toEqual(
      parseExternalCsv(STRONG_CSV).map((s) => s.sessionId),
    )
  })

  it('rejects files without the expected headers', () => {
    expect(() => parseExternalCsv('a,b\n1,2\n')).toThrow(/Strong or Hevy/)
  })
})

function isInsideQuotes(line: string, offset: number): boolean {
  let quotes = 0
  for (let i = 0; i < offset; i++) if (line[i] === '"') quotes += 1
  return quotes % 2 === 1
}
