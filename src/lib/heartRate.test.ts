import { describe, expect, it } from 'vitest'
import { heartRateRow, planHeartRateSync, samplesFromRow, summarizeHeartRate } from './heartRate'

describe('heartRateRow / samplesFromRow', () => {
  it('builds sorted parallel arrays without invalid readings and reads them back', () => {
    const row = heartRateRow('s1', 'u1', [
      { at: 2000, bpm: 101.4 },
      { at: 1000, bpm: 99 },
      { at: 3000, bpm: 0 },
      { at: 4000, bpm: 300 },
    ])
    expect(row).toEqual({ id: 's1', owner_id: 'u1', sample_at: [1000, 2000], sample_bpm: [99, 101] })
    expect(samplesFromRow(row)).toEqual([
      { at: 1000, bpm: 99 },
      { at: 2000, bpm: 101 },
    ])
  })

  it('keeps the summary unchanged after a round trip', () => {
    const samples = [{ at: 1, bpm: 100 }, { at: 2, bpm: 110 }]
    expect(summarizeHeartRate(samplesFromRow(heartRateRow('s', 'u', samples)))).toEqual({ average: 105, peak: 110 })
  })
})

describe('planHeartRateSync', () => {
  const sessions = new Map([
    ['same', 'completed'],
    ['changed', 'completed'],
    ['server-only', 'completed'],
    ['local-only', 'completed'],
    ['local-unsynced', 'completed'],
    ['recording', 'in_progress'],
    ['pending', 'completed'],
  ])
  const plan = planHeartRateSync({
    local: new Map([
      ['same', 10],
      ['changed', 5],
      ['local-only', 7],
      ['local-unsynced', 3],
      ['recording', 4],
      ['pending', 9],
      ['orphan', 2],
    ]),
    server: new Map([
      ['same', 10],
      ['changed', 8],
      ['server-only', 6],
      ['recording', 1],
      ['pending', 1],
      ['gone', 3],
    ]),
    pending: new Set(['pending']),
    sessions,
    serverSessions: new Set(['same', 'changed', 'server-only', 'local-only', 'recording', 'pending']),
  })

  it('downloads differing server copies except for busy or unknown sessions', () => {
    expect(plan.download).toEqual(['changed', 'server-only'])
  })

  it('uploads local-only heart rate of sessions the server already has', () => {
    expect(plan.upload).toEqual(['local-only'])
  })

  it('drops samples of sessions that no longer exist', () => {
    expect(plan.dropLocal).toEqual(['orphan'])
  })
})
