// Minimal accessible charts (no chart library). Line charts stay SVG;
// category bars are HTML so long labels stay readable on a 360px screen.
import { t } from '../lib/i18n'
import './chart.css'

export interface ChartPoint {
  label: string
  value: number
}

export interface MultiChartSeries {
  id: string
  label: string
  color: string
  dash?: string
  areaFill?: string
  zeroBased?: boolean
  formatValue(value: number): string
  /** Aligned with the other series; `null` skips that week. */
  values: (number | null)[]
  /** When set, dots are drawn only where the flag is true. */
  marks?: boolean[]
}

export function LineChart({
  points,
  formatValue,
  ariaLabel,
  emptyText,
}: {
  points: ChartPoint[]
  formatValue(value: number): string
  ariaLabel: string
  emptyText?: string
}) {
  if (points.length === 0) {
    return <p className="muted">{emptyText ?? t('progress.chartEmpty')}</p>
  }

  const width = 320
  const height = 140
  const pad = { top: 12, right: 8, bottom: 22, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxValue = Math.max(...points.map((p) => p.value), 1)
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0

  const coords = points.map((point, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + innerH - (point.value / maxValue) * innerH,
  }))
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ')
  const area = `${path} L${coords[coords.length - 1]?.x.toFixed(1)},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`

  const summary = points
    .map((p) => `${p.label}: ${formatValue(p.value)}`)
    .join(', ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={`${ariaLabel}. ${summary}`}
    >
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={width - pad.right}
        y2={pad.top + innerH}
        stroke="var(--c-track)"
        strokeWidth="1"
      />
      {maxValue > 0 ? (
        <line
          x1={pad.left}
          y1={pad.top}
          x2={width - pad.right}
          y2={pad.top}
          stroke="var(--c-track)"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
      ) : null}
      <path d={area} fill="var(--c-primary-soft)" />
      <path d={path} fill="none" stroke="var(--c-primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i]?.label} cx={c.x} cy={c.y} r="3" fill="var(--c-primary)" />
      ))}
      {points.length > 1 ? (
        <>
          <text x={pad.left} y={height - 6} className="chart-label">
            {points[0]?.label}
          </text>
          <text x={width - pad.right} y={height - 6} textAnchor="end" className="chart-label">
            {points[points.length - 1]?.label}
          </text>
        </>
      ) : (
        <text x={width / 2} y={height - 6} textAnchor="middle" className="chart-label">
          {points[0]?.label}
        </text>
      )}
    </svg>
  )
}

function yAt(
  value: number,
  values: number[],
  zeroBased: boolean,
  padTop: number,
  innerH: number,
): number {
  const min = zeroBased ? 0 : Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const pad = span === 0 ? (max === 0 ? 1 : Math.abs(max) * 0.08 || 1) : span * 0.08
  const lo = zeroBased ? 0 : min - pad
  const hi = max + pad
  const range = hi - lo || 1
  return padTop + innerH - ((value - lo) / range) * innerH
}

function linePaths(
  coords: ({ x: number; y: number } | null)[],
): string[] {
  const paths: string[] = []
  let d = ''
  for (const point of coords) {
    if (!point) {
      if (d) {
        paths.push(d)
        d = ''
      }
      continue
    }
    const x = point.x.toFixed(1)
    const y = point.y.toFixed(1)
    d += d === '' ? `M${x},${y}` : `L${x},${y}`
  }
  if (d) paths.push(d)
  return paths
}

export function MultiLineChart({
  labels,
  series,
  ariaLabel,
  emptyText,
}: {
  labels: string[]
  series: MultiChartSeries[]
  ariaLabel: string
  emptyText?: string
}) {
  const drawn = series.filter((row) => row.values.some((value) => value !== null))
  if (labels.length === 0 || drawn.length === 0) {
    return <p className="muted">{emptyText ?? t('progress.chartEmpty')}</p>
  }

  const width = 320
  const height = 160
  const pad = { top: 12, right: 8, bottom: 22, left: 8 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0

  const summary = drawn
    .map((row) => {
      const parts = labels.flatMap((label, i) => {
        const value = row.values[i]
        return value === null || value === undefined ? [] : [`${label}: ${row.formatValue(value)}`]
      })
      return `${row.label}: ${parts.join(', ')}`
    })
    .join('. ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={`${ariaLabel}. ${summary}`}
    >
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={width - pad.right}
        y2={pad.top + innerH}
        stroke="var(--c-track)"
        strokeWidth="1"
      />
      <line
        x1={pad.left}
        y1={pad.top}
        x2={width - pad.right}
        y2={pad.top}
        stroke="var(--c-track)"
        strokeDasharray="3 4"
        strokeWidth="1"
      />
      {drawn.map((row) => {
        const numeric = row.values.filter((value): value is number => value !== null)
        const coords = row.values.map((value, i) => {
          if (value === null) return null
          return {
            x: pad.left + i * stepX,
            y: yAt(value, numeric, row.zeroBased === true, pad.top, innerH),
          }
        })
        const paths = linePaths(coords)
        const last = [...coords].reverse().find((point) => point !== null)
        const first = coords.find((point) => point !== null)
        const area =
          drawn.length === 1 && first && last && paths[0]
            ? `${paths[0]} L${last.x.toFixed(1)},${pad.top + innerH} L${first.x.toFixed(1)},${pad.top + innerH} Z`
            : null
        return (
          <g key={row.id}>
            {area ? <path d={area} fill={row.areaFill ?? 'var(--c-primary-soft)'} /> : null}
            {paths.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke={row.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={row.dash}
              />
            ))}
            {coords.map((point, i) =>
              point && (row.marks === undefined || row.marks[i] === true) ? (
                <circle
                  key={`${row.id}-${labels[i]}-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r="3"
                  fill={row.color}
                />
              ) : null,
            )}
          </g>
        )
      })}
      {labels.length > 1 ? (
        <>
          <text x={pad.left} y={height - 6} className="chart-label">
            {labels[0]}
          </text>
          <text x={width - pad.right} y={height - 6} textAnchor="end" className="chart-label">
            {labels[labels.length - 1]}
          </text>
        </>
      ) : (
        <text x={width / 2} y={height - 6} textAnchor="middle" className="chart-label">
          {labels[0]}
        </text>
      )}
    </svg>
  )
}

export function BarChart({
  bars,
  formatValue,
  ariaLabel,
  emptyText,
}: {
  bars: ChartPoint[]
  formatValue(value: number): string
  ariaLabel: string
  emptyText?: string
}) {
  if (bars.length === 0) {
    return <p className="muted">{emptyText ?? t('progress.chartEmpty')}</p>
  }
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1)
  const summary = bars.map((bar) => `${bar.label}: ${formatValue(bar.value)}`).join(', ')

  return (
    <div className="bar-chart" role="img" aria-label={`${ariaLabel}. ${summary}`}>
      {bars.map((bar, i) => {
        const pct = bar.value <= 0 ? 0 : Math.max((bar.value / maxValue) * 100, 4)
        return (
          <div key={`${bar.label}-${i}`} className="bar-chart-row" aria-hidden="true">
            <div className="bar-chart-head">
              <span className="bar-chart-label">{bar.label}</span>
              <span className="bar-chart-value">{bar.value}</span>
            </div>
            <div className="bar-chart-track">
              <div className="bar-chart-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
