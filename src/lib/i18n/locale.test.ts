import { describe, expect, it } from 'vitest'
import { parsePreference, resolveLocale } from './locale'

describe('parsePreference', () => {
  it('accepts en, sr and system', () => {
    expect(parsePreference('en')).toBe('en')
    expect(parsePreference('sr')).toBe('sr')
    expect(parsePreference('system')).toBe('system')
  })

  it('falls back to system for missing or unknown values', () => {
    expect(parsePreference(null)).toBe('system')
    expect(parsePreference('')).toBe('system')
    expect(parsePreference('fr')).toBe('system')
  })
})

describe('resolveLocale', () => {
  it('uses the explicit preference as-is', () => {
    expect(resolveLocale('en', 'sr')).toBe('en')
    expect(resolveLocale('sr', 'en')).toBe('sr')
  })

  it('follows the system locale when preference is system', () => {
    expect(resolveLocale('system', 'sr')).toBe('sr')
    expect(resolveLocale('system', 'en')).toBe('en')
  })
})
