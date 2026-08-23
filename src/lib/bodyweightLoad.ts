// Pull-ups, dips and push-ups default to bodyweight; a logged weight is extra
// load (backpack, belt), not the total mass on a bar.
import type { UnitSystem } from '../types/db'
import { SYS } from './programs/exercises'
import { formatWeight } from './units'
import { t } from './i18n'

const BODYWEIGHT_LOAD_IDS = new Set<string>([
  SYS.pullUp,
  SYS.chinUp,
  SYS.dip,
  SYS.pushUp,
  '11111111-1111-4111-8111-111111111175', // Neutral-Grip Pull-Up
])

const BODYWEIGHT_LOAD_NAME =
  /pull[\s-]?ups?|chin[\s-]?ups?|\bdips?\b/i

export function isBodyweightLoadExercise(input: {
  id?: string | null
  name?: string | null
}): boolean {
  if (input.id && BODYWEIGHT_LOAD_IDS.has(input.id)) return true
  const name = input.name?.trim() ?? ''
  return name !== '' && BODYWEIGHT_LOAD_NAME.test(name)
}

/** Empty / zero load on a bodyweight-plus-load movement is a strict BW set. */
export function isBodyweightLoad(weightKg: number | null | undefined): boolean {
  return (weightKg ?? 0) <= 0
}

export function formatSetLoad(
  weightKg: number | null | undefined,
  units: UnitSystem,
  bodyweightLoad: boolean,
): string {
  if (bodyweightLoad) {
    const added = weightKg ?? 0
    if (added <= 0) return t('set.bodyweight')
    return `+${formatWeight(added, units)}`
  }
  if (weightKg == null) return '–'
  return formatWeight(weightKg, units)
}
