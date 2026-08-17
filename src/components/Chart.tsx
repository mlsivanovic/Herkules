// Minimal accessible SVG charts (no chart library).
import './chart.css'

export interface ChartPoint {
  label: string
  value: number
}

export function LineChart({
  points,
  formatValue,
  ariaLabel,
}: {
  points: ChartPoint[]
  formatValue(value: number): string
  ariaLabel: string
}) {
  if (points.length === 0) {
    return <p className="muted">No data yet.</p>
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

export function BarChart({
  bars,
  formatValue,
  ariaLabel,
}: {
  bars: ChartPoint[]
  formatValue(value: number): string
  ariaLabel: string
}) {
  if (bars.length === 0) {
    return <p className="muted">No data yet.</p>
  }
  const width = 320
  const height = 160
  const pad = { top: 10, right: 4, bottom: 24, left: 4 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxValue = Math.max(...bars.map((b) => b.value), 1)
  const slot = innerW / bars.length
  const barW = Math.min(slot - 6, 40)

  const summary = bars.map((b) => `${b.label}: ${formatValue(b.value)}`).join(', ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="chart"
      role="img"
      aria-label={`${ariaLabel}. ${summary}`}
    >
      {bars.map((bar, i) => {
        const barH = (bar.value / maxValue) * innerH
        const x = pad.left + i * slot + (slot - barW) / 2
        const y = pad.top + innerH - barH
        return (
          <g key={bar.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, 0)}
              rx="4"
              fill="var(--c-accent)"
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={height - 8}
              textAnchor="middle"
              className="chart-label"
            >
              {bar.label}
            </text>
          </g>
        )
      })}
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={width - pad.right}
        y2={pad.top + innerH}
        stroke="var(--c-track)"
      />
    </svg>
  )
}
