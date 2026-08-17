import { describe, expect, it } from 'vitest'
import { parsePreference, resolveTheme } from './theme'

describe('parsePreference', () => {
  it('accepts light, dark and system', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference('dark')).toBe('dark')
    expect(parsePreference('system')).toBe('system')
  })

  it('falls back to system for missing or unknown values', () => {
    expect(parsePreference(null)).toBe('system')
    expect(parsePreference('')).toBe('system')
    expect(parsePreference('auto')).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('uses the explicit preference as-is', () => {
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })

  it('follows the system theme when preference is system', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
  })
})
