import { describe, expect, it } from 'vitest'
import {
  fetchLatestAndroidRelease,
  isNewerAndroidRelease,
  latestAndroidRelease,
  parseAndroidRelease,
} from './androidRelease'

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

describe('latestAndroidRelease', () => {
  const apk = (tag: string) => ({
    tag_name: tag,
    assets: [{ name: 'app-release.apk', browser_download_url: `https://example.test/${tag}.apk` }],
  })

  it('picks the highest version regardless of list order', () => {
    expect(
      latestAndroidRelease([apk('android-v1.1.0'), apk('android-v1.10.0'), apk('android-v1.2.0')])?.tag,
    ).toBe('android-v1.10.0')
  })

  it('skips web releases and releases without an apk', () => {
    expect(
      latestAndroidRelease([{ tag_name: 'v2.0.0', assets: [] }, { tag_name: 'android-v3.0.0' }, apk('android-v1.1.0')])
        ?.tag,
    ).toBe('android-v1.1.0')
    expect(latestAndroidRelease([])).toBeNull()
  })
})

describe('fetchLatestAndroidRelease', () => {
  it('returns null when GitHub fails', async () => {
    const failing = (async () => new Response('rate limited', { status: 403 })) as typeof fetch
    expect(await fetchLatestAndroidRelease(failing)).toBeNull()
    const offline = (async () => {
      throw new TypeError('offline')
    }) as typeof fetch
    expect(await fetchLatestAndroidRelease(offline)).toBeNull()
  })

  it('reads the release list', async () => {
    const ok = (async () =>
      new Response(
        JSON.stringify([
          {
            tag_name: 'android-v1.1.0',
            assets: [{ name: 'app-release.apk', browser_download_url: 'https://example.test/a.apk' }],
          },
        ]),
      )) as typeof fetch
    expect(await fetchLatestAndroidRelease(ok)).toEqual({
      tag: 'android-v1.1.0',
      url: 'https://example.test/a.apk',
    })
  })
})
