// Progress: totals, streak, adherence, weekly volume, sets per muscle group,
// personal records and per-exercise trend charts.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { TendonCheckinRow } from '../types/db'
import { addDays, startOfWeek, todayKey } from '../lib/dates'
import { occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import {
  adherence,
  exerciseProgress,
  personalRecords,
  sessionTotals,
  setsPerMuscleGroup,
  weeklyVolume,
} from '../lib/metrics'
import { formatWeight, formatDistance, formatDuration } from '../lib/units'
import { BarChart, LineChart } from '../components/Chart'
import { EmptyState, Loader } from '../components/ui'
import { IconTrophy } from '../components/Icons'
import { displayExerciseName, displaySnapshotName, displayTag, displayTendonSite, useT } from '../lib/i18n'
import './progress.css'

const WEEKS_SHOWN = 12

export function Progress() {
  const { t } = useT()
  const navigate = useNavigate()
  const { sessions, exercises, schedules, rules, profile, ready, bodyWeights, checkins } = useStore()
  const [exerciseId, setExerciseId] = useState<string>('')
  const [tendonSite, setTendonSite] = useState<string>('')

  const today = todayKey()
  const weekStartDay = profile?.week_start ?? 'monday'
  const units = profile?.unit_system ?? 'metric'

  const stats = useMemo(() => {
    const totals = sessionTotals(sessions)

    // adherence window: last 4 complete weeks + current week
    const windowStart = addDays(startOfWeek(today, weekStartDay), -7 * 4)
    const refs: ScheduleRef[] = schedules.map((schedule) => ({
      schedule,
      rule: schedule.recurrence_rule_id
        ? rules.find((r) => r.id === schedule.recurrence_rule_id) ?? null
        : null,
    }))
    const planned = occurrencesInRange(refs, windowStart, today).length
    const plan = adherence(planned, sessions, windowStart, today)

    const volumeByWeek = weeklyVolume(sessions, WEEKS_SHOWN, weekStartDay, today)
    const muscleSets = setsPerMuscleGroup(sessions, exercises, addDays(today, -30))
    const records = personalRecords(sessions)

    return { totals, plan, volumeByWeek, muscleSets, records }
  }, [sessions, exercises, schedules, rules, today, weekStartDay])

  const trackedExercises = useMemo(() => {
    const used = new Set(
      sessions.flatMap((s) => s.session_exercises.map((se) => se.exercise_id ?? se.name_snapshot)),
    )
    return exercises
      .filter((e) => used.has(e.id))
      .sort((a, b) => displayExerciseName(a).localeCompare(displayExerciseName(b)))
  }, [exercises, sessions])

  const selected = trackedExercises.find((e) => e.id === exerciseId) ?? trackedExercises[0]
  const selectedProgress = selected ? exerciseProgress(sessions, selected) : []

  if (!ready) return <Loader />

  if (sessions.length === 0) {
    return (
      <div>
        <h1>{t('progress.title')}</h1>
        <EmptyState
          title={t('progress.emptyTitle')}
          hint={t('progress.emptyHint')}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('progress.title')}</h1>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => void navigate('/history')}
        >
          {t('progress.allWorkouts')}
        </button>
      </div>

      <div className="stat-grid">
        <div className="card stat-card">
          <strong>{stats.totals.workouts}</strong>
          <span>{t('progress.workouts')}</span>
        </div>
        <div className="card stat-card">
          <strong>{stats.plan.percent}%</strong>
          <span>{t('progress.planFollowed')}</span>
        </div>
        <div className="card stat-card">
          <strong>{formatDuration(stats.totals.avgMinutes * 60)}</strong>
          <span>{t('progress.avgDuration')}</span>
        </div>
        <div className="card stat-card">
          <strong>{formatWeight(stats.totals.volume, units)}</strong>
          <span>{t('progress.totalVolume')}</span>
        </div>
      </div>

      {bodyWeights.length > 0 ? (
        <>
          <div className="section-title">{t('progress.bodyWeight')}</div>
          <div className="card">
            <LineChart
              points={[...bodyWeights]
                .sort((a, b) => (a.recorded_on < b.recorded_on ? -1 : 1))
                .map((row) => ({
                  label: row.recorded_on.slice(5),
                  value: row.weight_kg,
                }))}
              formatValue={(value) => formatWeight(value, units)}
              ariaLabel={t('progress.bodyWeightAria')}
            />
          </div>
        </>
      ) : null}

      <div className="section-title">{t('progress.weeklyVolume')}</div>
      <div className="card">
        <LineChart
          points={stats.volumeByWeek.map((week) => ({
            label: week.weekStart.slice(5),
            value: Math.round(week.volume),
          }))}
          formatValue={(value) => t('progress.volumeFmt', { value: formatWeight(value, units) })}
          ariaLabel={t('progress.weeklyVolumeAria')}
        />
      </div>

      <div className="section-title">{t('progress.muscleSets')}</div>
      <div className="card">
        <BarChart
          bars={stats.muscleSets.slice(0, 10).map((entry) => ({
            label: displayTag(entry.group),
            value: entry.sets,
          }))}
          formatValue={(value) => t('progress.setsFmt', { value })}
          ariaLabel={t('progress.muscleSetsAria')}
        />
      </div>

      <div className="section-title">{t('progress.trend')}</div>
      <div className="field">
        <label htmlFor="progress-exercise">{t('progress.exercise')}</label>
        <select
          id="progress-exercise"
          className="input"
          value={selected?.id ?? ''}
          onChange={(e) => setExerciseId(e.target.value)}
        >
          {trackedExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {displayExerciseName(exercise)}
            </option>
          ))}
        </select>
      </div>
      {selected ? (
        <div className="card">
          {selected.measurement === 'weight_reps' ? (
            <LineChart
              points={selectedProgress.map((row) => ({
                label: row.date.slice(5),
                value: Math.round(row.bestE1RM ?? 0),
              }))}
              formatValue={(value) => t('progress.e1rm', { value: formatWeight(value, units) })}
              ariaLabel={t('progress.e1rmAria', { name: displayExerciseName(selected) })}
            />
          ) : selectedProgress[0] ? (
            <p className="muted">
              {t('progress.sessionsWith', {
                count: selectedProgress.length,
                name: displayExerciseName(selected),
                latest: selected.measurement === 'distance_duration'
                  ? formatDistance(selectedProgress[0]?.topSet?.distance_m ?? 0, units)
                  : formatDuration(selectedProgress[0]?.topSet?.duration_s ?? 0),
              })}
            </p>
          ) : (
            <p className="muted">{t('progress.noSets')}</p>
          )}
          <ul className="history-list">
            {selectedProgress.slice(0, 5).map((row) => (
              <li key={row.sessionId} className="row row--between">
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  onClick={() => void navigate(`/history/${row.sessionId}`)}
                >
                  {row.date}
                </button>
                <small className="muted">
                  {t('progress.setsBest', { count: row.completedSets })}
                  {row.topSet
                    ? t('progress.best', {
                        value:
                          selected.measurement === 'weight_reps'
                            ? formatWeight(row.topSet.weight_kg ?? 0, units)
                            : selected.measurement === 'distance_duration'
                              ? formatDistance(row.topSet.distance_m ?? 0, units)
                              : formatDuration(row.topSet.duration_s ?? 0),
                      })
                    : ''}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">{t('progress.willAppear')}</p>
      )}

      <div className="section-title">
        <IconTrophy width={16} height={16} /> {t('progress.prs')}
      </div>
      {stats.records.length === 0 ? (
        <p className="muted">{t('progress.prEmpty')}</p>
      ) : (
        <ul className="history-list">
          {stats.records.map((record) => (
            <li key={`${record.exerciseName}-${record.kind}`} className="card">
              <div className="row row--between">
                <strong>{displaySnapshotName(record.exerciseName, null)}</strong>
                <span className="badge badge--planned">{prLabel(record.kind)}</span>
              </div>
              <span className="mono">{formatPrValue(record, units)}</span>
              <small className="muted"> · {record.date}</small>
            </li>
          ))}
        </ul>
      )}

      {checkins.length > 0 ? (
        <>
          <div className="section-title">{t('progress.tendon')}</div>
          <TendonTrend checkins={checkins} site={tendonSite} onSelectSite={setTendonSite} />
        </>
      ) : null}
    </div>
  )
}

function TendonTrend({
  checkins,
  site,
  onSelectSite,
}: {
  checkins: TendonCheckinRow[]
  site: string
  onSelectSite(site: string): void
}) {
  const { t } = useT()
  const sites = useMemo(
    () => [...new Set(checkins.map((row) => row.site))].sort((a, b) => a.localeCompare(b)),
    [checkins],
  )
  const selected = site === '' ? (sites[0] ?? '') : site
  const rows = useMemo(
    () =>
      checkins
        .filter((row) => row.site === selected)
        .sort((a, b) => (a.recorded_on < b.recorded_on ? -1 : 1))
        .map((row) => ({ ...row, label: row.recorded_on.slice(5) })),
    [checkins, selected],
  )

  return (
    <div className="card stack">
      <label className="field">
        <span>{t('progress.bodySite')}</span>
        <select className="input" value={selected} onChange={(e) => onSelectSite(e.target.value)}>
          {sites.map((name) => (
            <option key={name} value={name}>
              {displayTendonSite(name)}
            </option>
          ))}
        </select>
      </label>
      {rows.length > 1 ? (
        <>
          <LineChart
            points={rows.map((row) => ({ label: row.label, value: row.pain }))}
            formatValue={(value) => `pain ${value}`}
            ariaLabel={`Pain for ${selected} over time`}
          />
          <LineChart
            points={rows.map((row) => ({ label: row.label, value: row.stiffness }))}
            formatValue={(value) => `stiffness ${value}`}
            ariaLabel={`Morning stiffness for ${selected} over time`}
          />
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          One entry so far — log a few more days and the trend appears.
        </p>
      )}
      <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
        {rows.slice(-5).reverse().map((row) => (
          <li key={row.id}>
            {row.recorded_on} — stiffness {row.stiffness}, pain {row.pain}
            {row.notes ? ` (${row.notes})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

function prLabel(kind: string): string {
  switch (kind) {
    case 'e1rm':
      return 'Best e1RM'
    case 'weight':
      return 'Heaviest'
    case 'reps':
      return 'Most reps'
    case 'distance':
      return 'Longest distance'
    case 'duration':
      return 'Longest time'
    default:
      return kind
  }
}

function formatPrValue(
  record: { kind: string; value: number },
  units: 'metric' | 'imperial',
): string {
  switch (record.kind) {
    case 'e1rm':
    case 'weight':
      return formatWeight(record.value, units)
    case 'reps':
      return `${record.value} reps`
    case 'distance':
      return formatDistance(record.value, units)
    case 'duration':
      return formatDuration(record.value)
    default:
      return String(record.value)
  }
}
