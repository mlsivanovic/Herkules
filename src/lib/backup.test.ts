import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, parseBackup, serializeBackup } from './backup'
import { session as makeSession } from './csv.test'

describe('backup', () => {
  it('round-trips a full backup', () => {
    const json = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      templates: [],
      templateItems: [],
      rules: [],
      schedules: [],
      plans: [],
      sessions: [makeSession()],
      checkins: [],
    })
    const restored = parseBackup(json)
    expect(restored.format).toBe(BACKUP_FORMAT)
    expect(restored.version).toBe(5)
    expect(restored.sessions).toHaveLength(1)
    expect(restored.sessions[0]?.name).toBe('Push')
    expect(restored.plans).toEqual([])
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('not json {')).toThrow(/not valid JSON/)
  })

  it('rejects files that are not Herkules backups', () => {
    expect(() => parseBackup('{"format":"something-else"}')).toThrow(/not a Herkules backup/)
  })

  it('rejects a newer backup version', () => {
    const json = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      templates: [],
      templateItems: [],
      rules: [],
      schedules: [],
      plans: [],
      sessions: [],
      checkins: [],
    }).replace('"version": 5', '"version": 99')
    expect(() => parseBackup(json)).toThrow(/newer version/)
  })

  it('rejects backups with a missing list', () => {
    const json = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      templates: [],
      templateItems: [],
      rules: [],
      schedules: [],
      plans: [],
      sessions: [],
      checkins: [],
    }).replace('"checkins": []', '"checkins": null')
    expect(() => parseBackup(json)).toThrow(/missing the "checkins"/)
  })

  it('accepts a v1 backup that has no plans list', () => {
    const json = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      plans: [],
      templates: [
        {
          id: '11111111-1111-4111-8111-111111111101',
          owner_id: 'u1',
          name: 'Push',
          notes: null,
          plan_id: null,
          plan_position: 0,
          created_at: '2026-08-19T12:00:00.000Z',
          updated_at: '2026-08-19T12:00:00.000Z',
        },
      ],
      templateItems: [],
      rules: [],
      schedules: [],
      sessions: [],
      checkins: [],
    })
      .replace('"version": 5', '"version": 1')
      .replace(/\n {2}"plans": \[\],\n/u, '\n')
    const restored = parseBackup(json)
    expect(restored.plans).toEqual([])
    expect(restored.templates[0]?.plan_id).toBeNull()
    expect(restored.templates[0]?.plan_position).toBe(0)
    expect(restored.bodyMeasures).toEqual([])
  })

  it('accepts a v3 backup that has no bodyMeasures list', () => {
    const json = serializeBackup({
      profile: null,
      bodyWeights: [],
      exercises: [],
      plans: [],
      templates: [],
      templateItems: [],
      rules: [],
      schedules: [],
      sessions: [],
      checkins: [],
    })
      .replace('"version": 5', '"version": 3')
      .replace(/,\n {2}"bodyMeasures": \[\]/u, '')
    const restored = parseBackup(json)
    expect(restored.bodyMeasures).toEqual([])
  })
})
