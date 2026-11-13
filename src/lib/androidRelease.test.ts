import { describe, expect, it } from 'vitest'
import { isNewerAndroidRelease, parseAndroidRelease } from './androidRelease'

describe('parseAndroidRelease', () => {
  it('reads an android tag that has an apk asset', () => {
    expect(
      parseAndroidRelease({
        tag_name: 'android-v1.2.0',
        assets: [{ name: 'herkules.apk', browser_download_url: 'https://example.test/app.apk' }],
      }),
    ).toEqual({ tag: 'android-v1.2.0', url: 'https://example.test/app.apk' })
  })

  it('ignores pages releases and tags without an apk', () => {
    expect(parseAndroidRelease({ tag_name: 'v1.2.0', assets: [] })).toBeNull()
    expect(parseAndroidRelease({ tag_name: 'android-v1.2.0', assets: [{ name: 'notes.txt' }] })).toBeNull()
  })
})

describe('isNewerAndroidRelease', () => {
  it('compares dotted versions', () => {
    expect(isNewerAndroidRelease('1.1.0', 'android-v1.2.0')).toBe(true)
    expect(isNewerAndroidRelease('1.2.0', 'android-v1.2.0')).toBe(false)
    expect(isNewerAndroidRelease('1.2.1', 'android-v1.2.0')).toBe(false)
    expect(isNewerAndroidRelease('1.2', 'android-v1.2.1')).toBe(true)
  })
})
