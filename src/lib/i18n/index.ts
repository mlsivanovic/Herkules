import { useCallback } from 'react'
import {
  AEROBIC_ACTIVITY_TYPES,
  isAerobicActivityType,
  type AerobicActivityType,
  type ExerciseCategory,
} from '../../types/db'
import { useLocale, type Locale } from './locale'
import { t, type MessageKey, type Vars } from './translate'

export function categoryLabel(value: ExerciseCategory | 'all'): string {
  if (value === 'all') return t('category.all')
  if (value === 'cardio') return t('category.cardio')
  if (value === 'mobility') return t('category.mobility')
  return t('category.strength')
}

const WORKOUT_ROLES = [
  'warmup',
  'strength',
  'assistance',
  'power',
  'carry',
  'core',
  'conditioning',
  'zone_2',
  'tendon',
] as const

export function workoutRoleLabel(value: string): string {
  if ((WORKOUT_ROLES as readonly string[]).includes(value)) {
    return t(`workoutRole.${value as (typeof WORKOUT_ROLES)[number]}`)
  }
  return value.replaceAll('_', ' ')
}

const BLOCK_FORMATS = ['straight', 'superset', 'circuit', 'interval'] as const

export function blockFormatLabel(value: string): string {
  if ((BLOCK_FORMATS as readonly string[]).includes(value)) {
    return t(`blockFormat.${value as (typeof BLOCK_FORMATS)[number]}`)
  }
  return value
}

const AEROBIC_LABELS: Record<AerobicActivityType, MessageKey> = {
  walking: 'aerobic.walking',
  cycling: 'aerobic.cycling',
  rowing: 'aerobic.rowing',
  basketball: 'aerobic.basketball',
  table_tennis: 'aerobic.tableTennis',
  tennis: 'aerobic.tennis',
  swimming: 'aerobic.swimming',
  football: 'aerobic.football',
  volleyball: 'aerobic.volleyball',
  other: 'aerobic.other',
}

export function aerobicActivityTypes(): readonly AerobicActivityType[] {
  return AEROBIC_ACTIVITY_TYPES
}

export function aerobicActivityLabel(type: string, locale?: Locale): string {
  if (!isAerobicActivityType(type)) return type
  return t(AEROBIC_LABELS[type], undefined, locale)
}

export {
  applyLocale,
  applySavedLocale,
  bcp47,
  currentLocale,
  parsePreference,
  resolveLocale,
  savedPreference,
  setPreference,
  startSystemLocaleListener,
  systemLocale,
  useLocale,
  type Locale,
  type LocalePreference,
} from './locale'
export { pickPlural, pluralForm, t, type MessageKey, type Vars } from './translate'
export {
  displayExerciseInstructions,
  displayExerciseName,
  displaySnapshotName,
  displayTag,
  displayTags,
  displayTendonSite,
  exerciseMatchesQuery,
  SR_EXERCISES,
  tendonSiteValue,
} from './catalog'

export function useT(): {
  t: (key: MessageKey, vars?: Vars) => string
  locale: Locale
} {
  const { locale } = useLocale()
  const translate = useCallback(
    (key: MessageKey, vars?: Vars) => t(key, vars, locale),
    [locale],
  )
  return { t: translate, locale }
}
