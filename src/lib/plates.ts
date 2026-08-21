// Plate math for barbell loading: greedy largest-plate-first per side.
import type { UnitSystem } from '../types/db'
import { t } from './i18n'

export interface PlateBreakdown {
  /** plates to load on EACH side, largest first */
  perSide: { weight: number; count: number }[]
  /** un-loadable remainder per side, in display units */
  remainder: number
  /** true when the target is below the empty bar */
  belowBar: boolean
}

/** Standard plate denominations in the display unit, largest first. */
export function denominationsFor(units: UnitSystem): number[] {
  return units === 'metric' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]
}

export interface BarOption {
  label: string
  weight: number
}

export function barOptionsFor(units: UnitSystem): BarOption[] {
  return units === 'metric'
    ? [
        { label: t('plates.olympic20'), weight: 20 },
        { label: t('plates.womens15'), weight: 15 },
        { label: t('plates.training10'), weight: 10 },
      ]
    : [
        { label: t('plates.olympic45'), weight: 45 },
        { label: t('plates.bar35'), weight: 35 },
        { label: t('plates.bar25'), weight: 25 },
      ]
}

/**
 * How to load one side of the bar to reach `target` (display units). Greedy
 * largest-first is exact for standard denominations; anything left over is
 * reported as the remainder.
 */
export function platesForTarget(
  target: number,
  barWeight: number,
  denominations: number[],
): PlateBreakdown {
  if (target < barWeight) {
    return { perSide: [], remainder: 0, belowBar: true }
  }
  let perSide = (target - barWeight) / 2
  const perSideList: { weight: number; count: number }[] = []
  for (const plate of [...denominations].sort((a, b) => b - a)) {
    const count = Math.floor((perSide + 1e-9) / plate)
    if (count > 0) {
      perSideList.push({ weight: plate, count })
      perSide -= count * plate
    }
  }
  return {
    perSide: perSideList,
    remainder: Math.abs(perSide) < 1e-9 ? 0 : Math.round(perSide * 100) / 100,
    belowBar: false,
  }
}
