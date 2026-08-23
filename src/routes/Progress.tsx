// Progress: totals, streak, adherence, combined body/volume trends, muscle sets,
// personal records and per-exercise trend charts.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { SessionDoc, TendonCheckinRow } from '../types/db'
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
import { compositionTrend, type CompositionTrendPoint } from '../lib/bodyComposition'
import { trendWindowStart, weekCountInclusive, weeklyValues, type TrendRange } from '../lib/trendChart'
import { formatWeight, formatDistance, formatDuration } from '../lib/units'
import { BarChart, LineChart, MultiLineChart, type MultiChartSeries } from '../components/Chart'
import { EmptyState, Loader } from '../components/ui'
import { IconTrophy } from '../components/Icons'
import { BodyComposition } from '../components/BodyComposition'
import { displayExerciseName, displaySnapshotName, displayTag, displayTendonSite, t as translate, useT } from '../lib/i18n'
import './progress.css'

const PR_VISIBLE = 6
const PR_RECENT_DAYS = 30
const PR_NEW_DAYS = 7

export function Progress() {
  const { t } = useT()
  const navigate = useNavigate()
  const { sessions, exercises, schedules, rules, profile, ready, bodyWeights, bodyMeasures, checkins } =
    useStore()
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

    const muscleSets = setsPerMuscleGroup(sessions, exercises, addDays(today, -30))
    const records = personalRecords(sessions)

    return { totals, plan, muscleSets, records }
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

  const compositionTrendRows = useMemo(
    () =>
      compositionTrend({
        sex: profile?.sex ?? null,
        birthDate: profile?.birth_date ?? null,
        heightCm: profile?.height_cm ?? null,
        weights: bodyWeights,
        measures: bodyMeasures,
      }),
    [profile?.sex, profile?.birth_date, profile?.height_cm, bodyWeights, bodyMeasures],
  )

  if (!ready) return <Loader />

  const composition = <BodyComposition />

  const trends = (
    <TrendsPanel
      sessions={sessions}
      bodyWeights={bodyWeights}
      composition={compositionTrendRows}
      weekStartDay={weekStartDay}
      today={today}
      units={units}
    />
  )

  if (sessions.length === 0) {
    return (
      <div>
        <h1>{t('progress.title')}</h1>
        {composition}
        {trends}
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

      {trends}

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

type TrendId = 'volume' | 'weight' | 'fat' | 'lean'

const TREND_RANGES: TrendRange[] = ['1m', '3m', '6m', '1y', 'all']

function TrendsPanel({
  sessions,
  bodyWeights,
  composition,
  weekStartDay,
  today,
  units,
}: {
  sessions: SessionDoc[]
  bodyWeights: { recorded_on: string; weight_kg: number }[]
  composition: CompositionTrendPoint[]
  weekStartDay: 'monday' | 'sunday'
  today: string
  units: 'metric' | 'imperial'
}) {
  const { t } = useT()
  const [range, setRange] = useState<TrendRange>('3m')
  const [enabled, setEnabled] = useState<Partial<Record<TrendId, boolean>>>({})

  const earliest = useMemo(() => {
    const dates = [
      ...sessions.map((session) => session.started_at.slice(0, 10)),
      ...bodyWeights.map((row) => row.recorded_on),
      ...composition.map((row) => row.date),
    ]
    if (dates.length === 0) return null
    return dates.reduce((min, date) => (date < min ? date : min))
  }, [bodyWeights, composition, sessions])

  const volumeByWeek = useMemo(() => {
    const start = trendWindowStart(range, today, earliest)
    const weeks = weekCountInclusive(start, today, weekStartDay)
    return weeklyVolume(sessions, weeks, weekStartDay, today)
  }, [earliest, range, sessions, today, weekStartDay])

  const weekStarts = volumeByWeek.map((week) => week.weekStart)
  const labels = weekStarts.map((start) => formatDateCompact(start))

  const catalog = useMemo((): MultiChartSeries[] => {
    const series: MultiChartSeries[] = []
    if (sessions.length > 0) {
      series.push({
        id: 'volume',
        label: t('progress.trendsVolume'),
        color: 'var(--c-primary)',
        areaFill: 'var(--c-primary-soft)',
        zeroBased: true,
        formatValue: (value) => formatWeight(Math.round(value), units),
        values: volumeByWeek.map((week) => week.volume),
        marks: volumeByWeek.map((week) => week.volume > 0),
      })
    }
    const weight = weeklyValues(
      weekStarts,
      bodyWeights.map((row) => ({ date: row.recorded_on, value: row.weight_kg })),
    )
    if (weight.some((row) => row.value !== null)) {
      series.push({
        id: 'weight',
        label: t('progress.trendsWeight'),
        color: 'var(--c-accent)',
        areaFill: 'var(--c-accent-soft)',
        formatValue: (value) => formatWeight(value, units),
        values: weight.map((row) => row.value),
        marks: weight.map((row) => row.recorded),
      })
    }
    const fat = weeklyValues(
      weekStarts,
      composition.flatMap((row) =>
        row.bodyFatPct === null ? [] : [{ date: row.date, value: row.bodyFatPct }],
      ),
    )
    if (fat.some((row) => row.value !== null)) {
      series.push({
        id: 'fat',
        label: t('body.bodyFat'),
        color: 'var(--c-warning)',
        dash: '6 4',
        areaFill: 'var(--c-warning-soft)',
        formatValue: (value) => t('body.percent', { n: value.toFixed(1) }),
        values: fat.map((row) => row.value),
        marks: fat.map((row) => row.recorded),
      })
    }
    const lean = weeklyValues(
      weekStarts,
      composition.flatMap((row) =>
        row.leanMassKg === null ? [] : [{ date: row.date, value: row.leanMassKg }],
      ),
    )
    if (lean.some((row) => row.value !== null)) {
      series.push({
        id: 'lean',
        label: t('body.leanMass'),
        color: 'var(--c-success)',
        dash: '2 3',
        areaFill: 'var(--c-success-soft)',
        formatValue: (value) => formatWeight(value, units),
        values: lean.map((row) => row.value),
        marks: lean.map((row) => row.recorded),
      })
    }
    return series
  }, [bodyWeights, composition, sessions.length, t, units, volumeByWeek, weekStarts])

  if (catalog.length === 0) return null

  const visible = catalog.filter((row) => enabled[row.id as TrendId] !== false)

  function toggle(id: TrendId) {
    setEnabled((prev) => {
      const next = { ...prev, [id]: prev[id] === false }
      const onCount = catalog.filter((row) => next[row.id as TrendId] !== false).length
      return onCount === 0 ? prev : next
    })
  }

  const rangeLabel: Record<TrendRange, 'progress.trendsRange1m' | 'progress.trendsRange3m' | 'progress.trendsRange6m' | 'progress.trendsRange1y' | 'progress.trendsRangeAll'> =
    {
      '1m': 'progress.trendsRange1m',
      '3m': 'progress.trendsRange3m',
      '6m': 'progress.trendsRange6m',
      '1y': 'progress.trendsRange1y',
      all: 'progress.trendsRangeAll',
    }

  return (
    <>
      <div className="section-title">{t('progress.trends')}</div>
      <div className="card trends-panel">
        <div className="row row--wrap" role="group" aria-label={t('progress.trendsRangeAria')}>
          {TREND_RANGES.map((value) => (
            <button
              key={value}
              type="button"
              className={`btn btn--small${range === value ? ' btn--primary' : ''}`}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {t(rangeLabel[value])}
            </button>
          ))}
        </div>
        <div className="row row--wrap" role="group" aria-label={t('progress.trendsSeriesAria')}>
          {catalog.map((row) => {
            const on = enabled[row.id as TrendId] !== false
            return (
              <button
                key={row.id}
                type="button"
                className={`btn btn--small${on ? ' btn--primary' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(row.id as TrendId)}
              >
                <span
                  className="chart-legend__swatch"
                  style={{ background: row.color }}
                  aria-hidden="true"
                />
                {row.label}
              </button>
            )
          })}
        </div>
        {visible.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('progress.trendsNone')}
          </p>
        ) : (
          <div className="trends-chart">
            <MultiLineChart
              labels={labels}
              series={visible}
              ariaLabel={t('progress.trendsAria')}
              emptyText={t('progress.chartEmpty')}
            />
            <ul className="chart-legend">
              {visible.map((row) => {
                const latest = [...row.values].reverse().find((value) => value !== null)
                return (
                  <li key={row.id} className="chart-legend__item">
                    <span
                      className={`chart-legend__swatch${row.dash ? ' chart-legend__swatch--dash' : ''}`}
                      style={{ background: row.color }}
                      aria-hidden="true"
                    />
                    {row.label}
                    {latest !== undefined && latest !== null ? ` · ${row.formatValue(latest)}` : ''}
                  </li>
                )
              })}
            </ul>
            {visible.length > 1 ? (
              <p className="muted chart-scale">{t('progress.trendsScale')}</p>
            ) : null}
          </div>
        )}
      </div>
    </>
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
