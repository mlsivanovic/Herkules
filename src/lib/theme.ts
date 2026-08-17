// Theme handling: device-persisted choice, system fallback, live OS tracking.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'herkules:theme'
const THEME_COLORS: Record<Theme, string> = { light: '#f1f5f9', dark: '#101a2e' }

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private mode — theme choice stays per-session
  }
}

/** Follow OS theme changes until the user makes an explicit choice. */
export function followSystemTheme(onChange: (theme: Theme) => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => {
    if (!savedTheme()) {
      const theme: Theme = query.matches ? 'dark' : 'light'
      applyTheme(theme)
      onChange(theme)
    }
  }
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
