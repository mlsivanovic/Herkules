// Theme handling: device-persisted Light / Dark / System, live OS tracking.
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const STORAGE_KEY = 'herkules:theme'
const THEME_COLORS: Record<Theme, string> = { light: '#f1f5f9', dark: '#101a2e' }

type ThemeState = { theme: Theme; preference: ThemePreference }

const listeners = new Set<(state: ThemeState) => void>()
let memoryPreference: ThemePreference | null = null

export function parsePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, system: Theme): Theme {
  return preference === 'system' ? system : preference
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

export function savedPreference(): ThemePreference {
  if (memoryPreference) return memoryPreference
  try {
    return parsePreference(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function writeTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

function notify(): void {
  const state: ThemeState = { theme: currentTheme(), preference: savedPreference() }
  listeners.forEach((listener) => listener(state))
}

export function subscribeTheme(listener: (state: ThemeState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Apply a resolved light/dark appearance without changing the saved preference. */
export function applyTheme(theme: Theme): void {
  writeTheme(theme)
  notify()
}

/** Persist Light / Dark / System and apply the resolved appearance. */
export function setPreference(preference: ThemePreference): Theme {
  memoryPreference = preference
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Private mode — preference stays in memory for this session
  }
  const theme = resolveTheme(preference, systemTheme())
  writeTheme(theme)
  notify()
  return theme
}

/** Follow OS theme changes while the saved preference is System. */
export function startSystemThemeListener(): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const applySystem = () => {
    if (savedPreference() !== 'system') return
    writeTheme(query.matches ? 'dark' : 'light')
    notify()
  }
  applySystem()
  query.addEventListener('change', applySystem)
  return () => query.removeEventListener('change', applySystem)
}

export function useTheme(): ThemeState & { setPreference: typeof setPreference } {
  const [state, setState] = useState<ThemeState>(() => ({
    theme: currentTheme(),
    preference: savedPreference(),
  }))
  useEffect(() => subscribeTheme(setState), [])
  return { ...state, setPreference }
}
