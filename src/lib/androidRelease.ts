// Decides whether a GitHub Release is a newer sideload APK than this build.

export interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

export interface ReleasePayload {
  tag_name?: string
  assets?: ReleaseAsset[]
}

export interface AndroidRelease {
  tag: string
  url: string
}

/** `android-v1.2.0` with an `.apk` asset. Other tags are ignored. */
export function parseAndroidRelease(payload: ReleasePayload): AndroidRelease | null {
  const tag = payload.tag_name ?? ''
  if (!/^android-v\d/.test(tag)) return null
  const apk = (payload.assets ?? []).find(
    (asset) => asset.name?.endsWith('.apk') && typeof asset.browser_download_url === 'string',
  )
  if (!apk?.browser_download_url) return null
  return { tag, url: apk.browser_download_url }
}

function parts(version: string): number[] {
  return version
    .replace(/^android-v/, '')
    .split('.')
    .map((part) => {
      const value = Number.parseInt(part, 10)
      return Number.isFinite(value) ? value : 0
    })
}

/** True when the release tag is a higher x.y.z than the running app. */
export function isNewerAndroidRelease(current: string, tag: string): boolean {
  const local = parts(current)
  const remote = parts(tag)
  const length = Math.max(local.length, remote.length)
  for (let i = 0; i < length; i++) {
    const delta = (remote[i] ?? 0) - (local[i] ?? 0)
    if (delta !== 0) return delta > 0
  }
  return false
}

export const ANDROID_RELEASES_PAGE = 'https://github.com/mlsivanovic/Herkules/releases'
const ANDROID_RELEASES_API = 'https://api.github.com/repos/mlsivanovic/Herkules/releases?per_page=20'

/** `android-v1.2.0` → `1.2.0`. */
export function androidReleaseVersion(tag: string): string {
  return tag.replace(/^android-v/, '')
}

/** Highest-versioned Android release with an APK, whatever order GitHub lists them in. */
export function latestAndroidRelease(payloads: readonly ReleasePayload[]): AndroidRelease | null {
  let best: AndroidRelease | null = null
  for (const payload of payloads) {
    const release = parseAndroidRelease(payload)
    if (!release) continue
    if (!best || isNewerAndroidRelease(androidReleaseVersion(best.tag), release.tag)) best = release
  }
  return best
}

/** Null when GitHub is unreachable or rate-limited; callers fall back to the releases page. */
export async function fetchLatestAndroidRelease(
  fetchImpl: typeof fetch = fetch,
): Promise<AndroidRelease | null> {
  try {
    const response = await fetchImpl(ANDROID_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null
    const payloads = (await response.json()) as unknown
    return Array.isArray(payloads) ? latestAndroidRelease(payloads as ReleasePayload[]) : null
  } catch {
    return null
  }
}
