import { describe, expect, it } from 'vitest'
import { appBaseUrl, PUBLIC_APP_URL } from './appUrl'

describe('appBaseUrl', () => {
  it('uses the public site inside the APK', () => {
    expect(appBaseUrl(true, 'https://localhost', './')).toBe(PUBLIC_APP_URL)
  })

  it('keeps the GitHub Pages subpath on the web', () => {
    expect(appBaseUrl(false, 'https://mlsivanovic.github.io', '/Herkules/')).toBe(
      'https://mlsivanovic.github.io/Herkules/',
    )
  })

  it('keeps the dev server origin', () => {
    expect(appBaseUrl(false, 'http://localhost:5173', '/')).toBe('http://localhost:5173/')
  })

  it('falls back to the public site without a window', () => {
    expect(appBaseUrl(false, '', '/Herkules/')).toBe(PUBLIC_APP_URL)
  })
})
