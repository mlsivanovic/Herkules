// Language preference: device-persisted English / Serbian / System.
import { useEffect, useState } from 'react'

export type Locale = 'en' | 'sr'
export type LocalePreference = Locale | 'system'

const STORAGE_KEY = 'herkules:locale'

type LocaleState = { locale: Locale; preference: LocalePreference }

const listeners = new Set<(state: LocaleState) => void>()
let memoryPreference: LocalePreference | null = null

export function parsePreference(value: string | null): LocalePreference {
  return value === 'en' || value === 'sr' || value === 'system' ? value : 'system'
}

export function systemLocale(): Locale {
  try {
    const raw = (navigator.language || 'en').toLowerCase()
    if (raw === 'sr' || raw.startsWith('sr-')) return 'sr'
  } catch {
    /* non-browser */
  }
  return 'en'
}

export function resolveLocale(preference: LocalePreference, system: Locale): Locale {
  return preference === 'system' ? system : preference
}

export function bcp47(locale: Locale = currentLocale()): string {
  return locale === 'sr' ? 'sr-Latn' : 'en'
}

export function currentLocale(): Locale {
  try {
    const value = document.documentElement.dataset.locale
    return value === 'sr' ? 'sr' : 'en'
  } catch {
    return 'en'
  }
}

export function savedPreference(): LocalePreference {
  if (memoryPreference) return memoryPreference
  try {
    return parsePreference(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function writeLang(locale: Locale): void {
  document.documentElement.lang = bcp47(locale)
  document.documentElement.dataset.locale = locale
}

function notify(): void {
  const state: LocaleState = { locale: currentLocale(), preference: savedPreference() }
  listeners.forEach((listener) => listener(state))
}

export function subscribeLocale(listener: (state: LocaleState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function applyLocale(locale: Locale): void {
  writeLang(locale)
  notify()
}

export function setPreference(preference: LocalePreference): Locale {
  memoryPreference = preference
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Private mode — preference stays in memory for this session
  }
  const locale = resolveLocale(preference, systemLocale())
  writeLang(locale)
  notify()
  return locale
}

/** Apply the saved (or system) locale before React paints. */
export function applySavedLocale(): Locale {
  const locale = resolveLocale(savedPreference(), systemLocale())
  writeLang(locale)
  return locale
}

/** Follow OS language changes while the saved preference is System. */
export function startSystemLocaleListener(): () => void {
  const applySystem = () => {
    if (savedPreference() !== 'system') return
    writeLang(systemLocale())
    notify()
  }
  window.addEventListener('languagechange', applySystem)
  return () => window.removeEventListener('languagechange', applySystem)
}

export function useLocale(): LocaleState & { setPreference: typeof setPreference } {
  const [state, setState] = useState<LocaleState>(() => ({
    locale: currentLocale(),
    preference: savedPreference(),
  }))
  useEffect(() => subscribeLocale(setState), [])
  return { ...state, setPreference }
}
