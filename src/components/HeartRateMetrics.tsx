import './heartRateMetrics.css'
import { useEffect, useMemo, useState } from 'react'
import { readHeartRate } from '../lib/db'
import { addDays, toDateKey, todayKey } from '../lib/dates'
import { summarizeHeartRate, type HeartRateSample } from '../lib/heartRate'
import { useT } from '../lib/i18n'
import { formatDuration } from '../lib/units'
import type { SessionDoc } from '../types/db'

function useHeartRate(sessionIds: string[]) {
  const key = JSON.stringify(sessionIds)
  const [result, setResult] = useState<{ key: string; rows: HeartRateSample[][] | null }>()
  useEffect(() => {
    let current = true
    const ids: string[] = JSON.parse(key)
    void Promise.all(ids.map(readHeartRate)).then(
      (rows) => { if (current) setResult({ key, rows }) },
      () => { if (current) setResult({ key, rows: null }) },
    )
    return () => { current = false }
  }, [key])
  return result?.key === key ? result.rows : undefined
}

export function SessionHeartRate({ session }: { session: SessionDoc }) {
  const { t } = useT()
  const rows = useHeartRate([session.id])
  const samples = useMemo(() => [...(rows?.[0] ?? [])].sort((a, b) => a.at - b.at), [rows])
  const stats = summarizeHeartRate(samples)
  if (rows === null) return <p role="status">{t('heartRate.readFailed')}</p>
  if (!stats) return null

  const start = Math.min(Date.parse(session.started_at), samples[0].at)
  const end = Math.max(Date.parse(session.ended_at ?? session.started_at), samples[samples.length - 1].at)
  const low = samples.reduce((min, sample) => Math.min(min, sample.bpm), stats.peak)
  const path = samples.map((sample, index) => {
    const x = 12 + 296 * (sample.at - start) / Math.max(1, end - start)
    const y = 106 - 92 * (sample.bpm - low) / Math.max(1, stats.peak - low)
    const gap = index === 0 || sample.at - samples[index - 1].at > 5000
    return `${gap ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}${gap ? 'h0.1' : ''}`
  }).join(' ')

  return (
    <section className="card stack heart-rate-metrics">
      <h2>{t('heartRate.timeline')}</h2>
      <p>{t('heartRate.summary', stats)}</p>
      <svg viewBox="0 0 320 130" className="chart" role="img" aria-label={t('heartRate.timeline')}>
        <path d={path} fill="none" stroke="var(--c-danger)" strokeWidth="2" strokeLinecap="round" />
        <text x="12" y="125" className="chart-label">{formatDuration(0)}</text>
        <text x="308" y="125" textAnchor="end" className="chart-label">
          {formatDuration(Math.round((end - start) / 1000))}
        </text>
      </svg>
    </section>
  )
}

const PERIODS = [7, 30, 91] as const

export function HeartRateProgress({ sessions }: { sessions: SessionDoc[] }) {
  const { t } = useT()
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const today = todayKey()
  const from = addDays(today, 1 - days)
  const ids = sessions.filter((session) => {
    if (session.status !== 'completed' || !session.ended_at) return false
    const date = toDateKey(new Date(session.ended_at))
    return date >= from && date <= today
  }).map((session) => session.id).sort()
  const rows = useHeartRate(ids)
  const stats = rows ? summarizeHeartRate(rows.flat()) : null

  return (
    <section className="card stack heart-rate-metrics">
      <h2>{t('heartRate.progress')}</h2>
      <div className="row heart-rate-metrics__periods">
        {PERIODS.map((period) => (
          <button type="button" className="btn" key={period} aria-pressed={days === period} onClick={() => setDays(period)}>
            {t(`heartRate.period${period}`)}
          </button>
        ))}
      </div>
      {stats && (
        <div>
          <p>{t('heartRate.summary', stats)}</p>
          <p className="muted">{t('heartRate.workoutCount', { count: rows?.filter((samples) => samples.length > 0).length ?? 0 })}</p>
        </div>
      )}
      {rows === null && <p role="status">{t('heartRate.readFailed')}</p>}
      {rows && !stats && <p className="muted">{t('heartRate.noReadings')}</p>}
    </section>
  )
}
