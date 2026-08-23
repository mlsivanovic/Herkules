// Progress: totals, streak, adherence, weekly volume, sets per muscle group,
// personal records and per-exercise trend charts.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { TendonCheckinRow } from '../types/db'
import { addDays, formatDateCompact, startOfWeek, todayKey } from '../lib/dates'
import { occurrencesInRange, type ScheduleRef } from '../lib/recurrence'
import {
  adherence,
  exerciseProgress,
  groupPersonalRecords,
  personalRecords,
  sessionTotals,
  setsPerMuscleGroup,
  weeklyVolume,
  type PersonalRecord,
} from '../lib/metrics'
import { formatWeight, formatDistance, formatDuration } from '../lib/units'
import { BarChart, LineChart } from '../components/Chart'
import { EmptyState, Loader } from '../components/ui'
import { IconTrophy } from '../components/Icons'
import { BodyComposition } from '../components/BodyComposition'
import { displayExerciseName, displaySnapshotName, displayTag, displayTendonSite, t as translate, useT } from '../lib/i18n'
import './progress.css'

const WEEKS_SHOWN = 12
const PR_VISIBLE = 6
const PR_RECENT_DAYS = 30
const PR_NEW_DAYS = 7

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

  const composition = <BodyComposition />

  if (sessions.length === 0) {
    return (
      <div>
        <h1>{t('progress.title')}</h1>
        {composition}
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

      {composition}

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
              emptyText={t('progress.chartEmpty')}
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
          emptyText={t('progress.chartEmpty')}
        />
      </div>

      <div className="section-title">{t('progress.muscleSets')}</div>
      <div className="card">
        <BarChart
          bars={stats.muscleSets.map((entry) => ({
            label: displayTag(entry.group),
            value: entry.sets,
          }))}
          formatValue={(value) => t('progress.setsFmt', { value })}
          ariaLabel={t('progress.muscleSetsAria')}
          emptyText={t('progress.chartEmpty')}
        />
      </div>

      <PersonalRecords records={stats.records} units={units} />

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
              emptyText={t('progress.chartEmpty')}
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

      {checkins.length > 0 ? (
        <>
          <div className="section-title">{t('progress.tendon')}</div>
          <TendonTrend checkins={checkins} site={tendonSite} onSelectSite={setTendonSite} />
        </>
      ) : null}
    </div>
  )
}

function PersonalRecords({
  records,
  units,
}: {
  records: PersonalRecord[]
  units: 'metric' | 'imperial'
}) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const recentSince = addDays(todayKey(), -PR_RECENT_DAYS)
  const freshSince = addDays(todayKey(), -PR_NEW_DAYS)
  const [period, setPeriod] = useState<'recent' | 'all'>(() =>
    records.some((record) => record.date >= addDays(todayKey(), -PR_RECENT_DAYS))
      ? 'recent'
      : 'all',
  )

  const groups = useMemo(() => groupPersonalRecords(records), [records])
  const recentCount = useMemo(
    () => groups.filter((group) => group.latestDate >= recentSince).length,
    [groups, recentSince],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return groups.filter((group) => {
      if (period === 'recent' && group.latestDate < recentSince) return false
      if (needle === '') return true
      if (group.exerciseName.toLowerCase().includes(needle)) return true
      return displaySnapshotName(group.exerciseName, group.exerciseId, 'sr')
        .toLowerCase()
        .includes(needle)
    })
  }, [groups, period, query, recentSince])

  const searching = query.trim() !== ''
  const visible = searching || expanded ? filtered : filtered.slice(0, PR_VISIBLE)
  const hiddenCount = filtered.length - visible.length

  function selectPeriod(next: 'recent' | 'all') {
    setPeriod(next)
    setExpanded(false)
  }

  return (
    <>
      <div className="section-title pr-head">
        <span className="pr-head__title">
          <IconTrophy width={16} height={16} /> {t('progress.prs')}
        </span>
      </div>
      {records.length === 0 ? (
        <p className="muted">{t('progress.prEmpty')}</p>
      ) : (
        <div className="card pr-panel">
          <div className="pr-toolbar">
            <input
              id="pr-search"
              className="input"
              type="search"
              value={query}
              placeholder={t('progress.prSearchPlaceholder')}
              aria-label={t('progress.prSearch')}
              onChange={(e) => {
                const value = e.target.value
                setQuery(value)
                setExpanded(false)
                if (value.trim() !== '') setPeriod('all')
              }}
            />
            <div className="row row--wrap" role="group" aria-label={t('progress.prFilterAria')}>
              <button
                type="button"
                className={`btn btn--small${period === 'recent' ? ' btn--primary' : ''}`}
                aria-pressed={period === 'recent'}
                onClick={() => selectPeriod('recent')}
              >
                {t('progress.prFilterRecent', { count: recentCount })}
              </button>
              <button
                type="button"
                className={`btn btn--small${period === 'all' ? ' btn--primary' : ''}`}
                aria-pressed={period === 'all'}
                onClick={() => selectPeriod('all')}
              >
                {t('progress.prFilterAll', { count: groups.length })}
              </button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="pr-empty">
              <p className="muted" style={{ margin: 0 }}>
                {searching ? t('progress.prNoMatch') : t('progress.prRecentEmpty')}
              </p>
              {!searching && period === 'recent' ? (
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => selectPeriod('all')}
                >
                  {t('progress.prSeeAll')}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="pr-list">
                {visible.map((group) => {
                  const name = displaySnapshotName(group.exerciseName, group.exerciseId)
                  const hasFresh = group.records.some((record) => record.date >= freshSince)
                  return (
                    <li key={group.key} className="pr-group">
                      <div className="pr-group__head">
                        <strong className="pr-group__name" title={name}>
                          {name}
                        </strong>
                        {hasFresh ? (
                          <span className="badge badge--completed">{t('progress.prNew')}</span>
                        ) : null}
                      </div>
                      <div className="pr-kinds">
                        {group.records.map((record) => (
                          <div
                            key={record.kind}
                            className={`pr-kind${record.date >= freshSince ? ' pr-kind--fresh' : ''}`}
                          >
                            <span className="pr-kind__label">{prLabel(record.kind)}</span>
                            <span className="pr-kind__value mono">{formatPrValue(record, units)}</span>
                            <span className="pr-kind__date">{formatDateCompact(record.date)}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  className="btn btn--small pr-more"
                  onClick={() => setExpanded(true)}
                >
                  {t('progress.prShowMore', { count: hiddenCount })}
                </button>
              ) : null}
              {expanded && !searching && filtered.length > PR_VISIBLE ? (
                <button
                  type="button"
                  className="btn btn--small btn--ghost pr-more"
                  onClick={() => setExpanded(false)}
                >
                  {t('progress.prShowLess')}
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
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
            formatValue={(value) => t('progress.painFmt', { value })}
            ariaLabel={t('progress.painFor', { site: displayTendonSite(selected) })}
            emptyText={t('progress.chartEmpty')}
          />
          <LineChart
            points={rows.map((row) => ({ label: row.label, value: row.stiffness }))}
            formatValue={(value) => t('progress.stiffnessFmt', { value })}
            ariaLabel={t('progress.stiffnessFor', { site: displayTendonSite(selected) })}
            emptyText={t('progress.chartEmpty')}
          />
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('progress.oneEntry')}
        </p>
      )}
      <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
        {rows.slice(-5).reverse().map((row) => (
          <li key={row.id}>
            {t('progress.checkinLine', {
              date: row.recorded_on,
              stiffness: row.stiffness,
              pain: row.pain,
            })}
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
      return translate('progress.prE1rm')
    case 'weight':
      return translate('progress.prWeight')
    case 'reps':
      return translate('progress.prReps')
    case 'distance':
      return translate('progress.prDistance')
    case 'duration':
      return translate('progress.prDuration')
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
      return String(record.value)
    case 'distance':
      return formatDistance(record.value, units)
    case 'duration':
      return formatDuration(record.value)
    default:
      return String(record.value)
  }
}
