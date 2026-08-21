import { useCallback } from 'react'
import type { ExerciseCategory } from '../../types/db'
import { useLocale, type Locale } from './locale'
import { t, type MessageKey, type Vars } from './translate'

export function categoryLabel(value: ExerciseCategory | 'all'): string {
  if (value === 'all') return t('category.all')
  if (value === 'cardio') return t('category.cardio')
  if (value === 'mobility') return t('category.mobility')
  return t('category.strength')
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
