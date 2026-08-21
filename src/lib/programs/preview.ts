// Read-only summaries of catalog recipes (starter plan / routine preview).
import type { ProgramItem } from './recipe'
import { tempoLabel } from './recipe'

export function formatRange(pair: [number, number], suffix = ''): string {
  const core = pair[0] === pair[1] ? String(pair[0]) : `${pair[0]}–${pair[1]}`
  return `${core}${suffix}`
}

/** Compact load line, e.g. "3 × 8–10", "3 × 45–60s", "3 × 20–30 m". */
export function formatProgramLoad(item: ProgramItem): string {
  if (item.reps) return `${item.plannedSets} × ${formatRange(item.reps)}`
  if (item.durationS) return `${item.plannedSets} × ${formatRange(item.durationS, 's')}`
  if (item.distanceM) return `${item.plannedSets} × ${formatRange(item.distanceM, ' m')}`
  return `${item.plannedSets} ×`
}

export function formatProgramMeta(item: ProgramItem): string[] {
  const parts: string[] = []
  if (item.rpe) parts.push(`RPE ${formatRange(item.rpe)}`)
  if (item.rir) parts.push(`RIR ${formatRange(item.rir)}`)
  if (item.restSeconds != null) parts.push(`${item.restSeconds}s`)
  parts.push(tempoLabel(item.tempo))
  return parts
}
