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
      sessions: [makeSession()],
      checkins: [],
    })
    const restored = parseBackup(json)
    expect(restored.format).toBe(BACKUP_FORMAT)
    expect(restored.version).toBe(1)
    expect(restored.sessions).toHaveLength(1)
    expect(restored.sessions[0]?.name).toBe('Push')
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
      sessions: [],
      checkins: [],
    }).replace('"version": 1', '"version": 99')
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
      sessions: [],
      checkins: [],
    }).replace('"checkins": []', '"checkins": null')
    expect(() => parseBackup(json)).toThrow(/missing the "checkins"/)
  })
})
