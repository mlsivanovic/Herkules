import { describe, expect, it } from 'vitest'
import type { SessionDoc } from '../types/db'
import { parseCsv, parseWorkoutCsv, serializeWorkoutCsv } from './csv'

export function session(overrides: Partial<SessionDoc> = {}): SessionDoc {
  return {
    id: '11111111-1111-4111-8111-111111111001',
    owner_id: 'u1',
    template_id: null,
    schedule_item_id: null,
    name: 'Push',
    status: 'completed',
    planned_date: '2026-08-17',
    started_at: '2026-08-17T10:00:00.000Z',
    ended_at: '2026-08-17T11:00:00.000Z',
    notes: 'Solid session',
    rpe: 7,
    created_at: '2026-08-17T10:00:00.000Z',
    updated_at: '2026-08-17T11:00:00.000Z',
    session_exercises: [
      {
        id: 'se-1',
        session_id: '11111111-1111-4111-8111-111111111001',
        exercise_id: 'ex-1',
        name_snapshot: 'Barbell Bench Press',
        measurement_snapshot: 'weight_reps',
        position: 0,
        planned_sets: 2,
        rest_seconds: 90,
        tempo: null,
        notes: null,
        superset_group: null,
        block_role: 'gym',
        created_at: '2026-08-17T10:00:00.000Z',
        updated_at: '2026-08-17T10:00:00.000Z',
        sets: [
          {
            id: 'set-1',
            session_exercise_id: 'se-1',
            position: 1,
            weight_kg: 80,
            reps: 5,
            duration_s: null,
            distance_m: null,
            rpe: 8,
            notes: 'paused',
            is_warmup: false,
            completed_at: '2026-08-17T10:10:00.000Z',
            created_at: '2026-08-17T10:10:00.000Z',
            updated_at: '2026-08-17T10:10:00.000Z',
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('csv parser', () => {
  it('keeps commas inside quotes', () => {
    expect(parseCsv('a,"b,c",d\n')).toEqual([['a', 'b,c', 'd']])
  })
})

describe('workout csv', () => {
  it('round-trips a completed session', () => {
    const csv = serializeWorkoutCsv([session()])
    const parsed = parseWorkoutCsv(csv)
    expect(parsed).toHaveLength(1)
    const first = parsed[0]
    expect(first?.name).toBe('Push')
    expect(first?.status).toBe('completed')
    expect(first?.rpe).toBe(7)
    expect(first?.exercises[0]?.name).toBe('Barbell Bench Press')
    expect(first?.exercises[0]?.sets[0]?.weight_kg).toBe(80)
    expect(first?.exercises[0]?.sets[0]?.reps).toBe(5)
    expect(first?.exercises[0]?.sets[0]?.notes).toBe('paused')
  })

  it('round-trips a weight_duration (isometric hold) session', () => {
    const doc = session({
      session_exercises: [
        {
          ...(session().session_exercises[0] as NonNullable<
            ReturnType<typeof session>['session_exercises'][number]
          >),
          name_snapshot: 'Split Squat Iso Hold',
          measurement_snapshot: 'weight_duration',
          sets: [
            {
              id: 'set-iso',
              session_exercise_id: 'se-1',
              position: 1,
              weight_kg: 24,
              reps: null,
              duration_s: 45,
              distance_m: null,
              rpe: 6,
              notes: null,
              is_warmup: false,
              completed_at: '2026-08-19T10:00:00.000Z',
              created_at: '2026-08-19T10:00:00.000Z',
              updated_at: '2026-08-19T10:00:00.000Z',
            },
          ],
        },
      ],
    })
    const parsed = parseWorkoutCsv(serializeWorkoutCsv([doc]))
    const exercise = parsed[0]?.exercises[0]
    expect(exercise?.measurement).toBe('weight_duration')
    expect(exercise?.sets[0]?.weight_kg).toBe(24)
    expect(exercise?.sets[0]?.duration_s).toBe(45)
  })

  it('exports a skipped session as a single row', () => {
    const csv = serializeWorkoutCsv([
      session({
        status: 'skipped',
        session_exercises: [],
        notes: 'Travel day',
      }),
    ])
    const parsed = parseWorkoutCsv(csv)
    expect(parsed[0]?.status).toBe('skipped')
    expect(parsed[0]?.notes).toBe('Travel day')
    expect(parsed[0]?.exercises).toHaveLength(0)
  })

  it('rejects a file that is not a workout export', () => {
    expect(() => parseWorkoutCsv('foo,bar\n1,2\n')).toThrow(/not a Herkules workout CSV/)
  })
})
